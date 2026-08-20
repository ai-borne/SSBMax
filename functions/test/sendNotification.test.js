/**
 * Centralized Result-Announcement Notifications plan: tests for
 * `src/notifications/sendNotification.js`'s `notifyEvaluationComplete`.
 * Uses the same in-memory fake-Firestore convention as `evaluationCore.test.js`.
 *
 * Phase 1 tests cover the `NOTIFICATIONS` doc write. Phase 2 tests cover the
 * `admin.messaging().sendEachForMulticast()` push send layered on top of it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { notifyEvaluationComplete } = require('../src/notifications/sendNotification');

function makeFakeDb() {
  const store = {};
  let autoIdSeq = 0;

  function docRef(path) {
    return {
      path,
      id: path.split('/').pop(),
      async get() {
        const data = store[path];
        return { exists: data !== undefined, data: () => data };
      },
      async set(value) {
        store[path] = value;
      },
      async delete() {
        delete store[path];
      }
    };
  }

  function collectionRef(collectionPath) {
    return {
      doc: (id) => docRef(`${collectionPath}/${id || `auto${++autoIdSeq}`}`),
      where(field, op, value) {
        if (op !== '==') {
          throw new Error(`fake Firestore only supports '==' where clauses, got '${op}'`);
        }
        return {
          async get() {
            const prefix = `${collectionPath}/`;
            const docs = Object.keys(store)
              .filter((path) => path.startsWith(prefix) && store[path][field] === value)
              .map((path) => ({ ref: docRef(path), data: () => store[path] }));
            return { empty: docs.length === 0, docs };
          }
        };
      }
    };
  }

  return {
    collection: (path) => collectionRef(path),
    _store: store,
    _seed(path, value) {
      store[path] = value;
    }
  };
}

function makeFakeMessaging({ tokenErrors = {} } = {}) {
  const calls = [];
  return {
    calls,
    async sendEachForMulticast(message) {
      calls.push(message);
      return {
        responses: message.tokens.map((token) =>
          tokenErrors[token]
            ? { success: false, error: { code: tokenErrors[token] } }
            : { success: true }
        )
      };
    }
  };
}

test('Phase 1: notifyEvaluationComplete writes a doc matching SSBMaxNotification field-for-field', async () => {
  const db = makeFakeDb();
  const { id } = await notifyEvaluationComplete({
    firestoreDb: db,
    userId: 'user1',
    testType: 'WAT',
    submissionId: 'sub1',
    messaging: makeFakeMessaging()
  });

  const doc = db._store[`notifications/${id}`];
  assert.ok(doc, 'notification doc must be written');
  assert.equal(doc.id, id);
  assert.equal(doc.userId, 'user1');
  assert.equal(doc.type, 'GRADING_COMPLETE');
  assert.equal(doc.priority, 'NORMAL');
  assert.equal(typeof doc.title, 'string');
  assert.ok(doc.title.length > 0);
  assert.ok(doc.message.includes('WAT'));
  assert.equal(doc.isRead, false);
  assert.deepEqual(doc.actionData, { submissionId: 'sub1', testType: 'WAT' });
  assert.equal(typeof doc.createdAt, 'number');
  assert.equal(doc.expiresAt, null);
});

test('Phase 1: notifyEvaluationComplete defaults to GRADING_COMPLETE for every test type', async () => {
  const db = makeFakeDb();
  for (const testType of ['OIR', 'PPDT', 'PIQ', 'TAT', 'SRT', 'SD', 'GTO_GD', 'GTO_LECTURETTE', 'GTO_GPE', 'IO']) {
    const { id } = await notifyEvaluationComplete({
      firestoreDb: db,
      userId: 'u',
      testType,
      submissionId: 's',
      messaging: makeFakeMessaging()
    });
    assert.equal(db._store[`notifications/${id}`].type, 'GRADING_COMPLETE');
  }
});

test('Phase 1: notifyEvaluationComplete writes a fresh doc id per call, not reusing submissionId', async () => {
  const db = makeFakeDb();
  const messaging = makeFakeMessaging();
  const first = await notifyEvaluationComplete({ firestoreDb: db, userId: 'u', testType: 'WAT', submissionId: 'sub1', messaging });
  const second = await notifyEvaluationComplete({ firestoreDb: db, userId: 'u', testType: 'WAT', submissionId: 'sub1', messaging });
  assert.notEqual(first.id, second.id, 're-notifying the same submission must not clobber a prior notification');
});

test('Phase 2: notifyEvaluationComplete sends no push when the user has no FCM tokens', async () => {
  const db = makeFakeDb();
  const messaging = makeFakeMessaging();
  await notifyEvaluationComplete({ firestoreDb: db, userId: 'user-no-tokens', testType: 'WAT', submissionId: 'sub1', messaging });
  assert.equal(messaging.calls.length, 0, 'sendEachForMulticast must not be called with zero tokens');
});

test('Phase 2: notifyEvaluationComplete multicasts to every platform token for the user, and only that user', async () => {
  const db = makeFakeDb();
  db._seed('fcmTokens/user1_deviceAndroid', { userId: 'user1', deviceId: 'deviceAndroid', token: 'tok-android', platform: 'android' });
  db._seed('fcmTokens/user1_deviceIos', { userId: 'user1', deviceId: 'deviceIos', token: 'tok-ios', platform: 'ios' });
  db._seed('fcmTokens/user1_deviceWeb', { userId: 'user1', deviceId: 'deviceWeb', token: 'tok-web', platform: 'web' });
  db._seed('fcmTokens/user2_deviceAndroid', { userId: 'user2', deviceId: 'deviceAndroid', token: 'tok-other-user', platform: 'android' });
  const messaging = makeFakeMessaging();

  await notifyEvaluationComplete({ firestoreDb: db, userId: 'user1', testType: 'TAT', submissionId: 'sub1', messaging });

  assert.equal(messaging.calls.length, 1);
  const sentTokens = messaging.calls[0].tokens.slice().sort();
  assert.deepEqual(sentTokens, ['tok-android', 'tok-ios', 'tok-web']);
});

test('Phase 2: notifyEvaluationComplete sends the notification title/body and stringified actionData in the multicast payload', async () => {
  const db = makeFakeDb();
  db._seed('fcmTokens/user1_device1', { userId: 'user1', deviceId: 'device1', token: 'tok-1', platform: 'android' });
  const messaging = makeFakeMessaging();

  await notifyEvaluationComplete({ firestoreDb: db, userId: 'user1', testType: 'SRT', submissionId: 'sub42', messaging });

  const sent = messaging.calls[0];
  assert.equal(typeof sent.notification.title, 'string');
  assert.ok(sent.notification.body.includes('SRT'));
  assert.equal(sent.data.submissionId, 'sub42');
  assert.equal(sent.data.testType, 'SRT');
  assert.equal(typeof sent.data.actionUrl, 'string');
  assert.equal(sent.data.type, 'GRADING_COMPLETE');
  assert.equal(typeof sent.data.notificationId, 'string');
  assert.ok(sent.data.notificationId.length > 0);
});

test('Phase 2: notifyEvaluationComplete deletes a token row FCM reports as unregistered', async () => {
  const db = makeFakeDb();
  db._seed('fcmTokens/user1_deviceStale', { userId: 'user1', deviceId: 'deviceStale', token: 'tok-stale', platform: 'android' });
  db._seed('fcmTokens/user1_deviceLive', { userId: 'user1', deviceId: 'deviceLive', token: 'tok-live', platform: 'ios' });
  const messaging = makeFakeMessaging({ tokenErrors: { 'tok-stale': 'messaging/registration-token-not-registered' } });

  await notifyEvaluationComplete({ firestoreDb: db, userId: 'user1', testType: 'WAT', submissionId: 'sub1', messaging });

  assert.equal(db._store['fcmTokens/user1_deviceStale'], undefined, 'stale token row must be deleted');
  assert.ok(db._store['fcmTokens/user1_deviceLive'], 'live token row must be left alone');
});

test('Phase 2: notifyEvaluationComplete does not delete a token row on a non-stale-token error', async () => {
  const db = makeFakeDb();
  db._seed('fcmTokens/user1_device1', { userId: 'user1', deviceId: 'device1', token: 'tok-1', platform: 'android' });
  const messaging = makeFakeMessaging({ tokenErrors: { 'tok-1': 'messaging/internal-error' } });

  await notifyEvaluationComplete({ firestoreDb: db, userId: 'user1', testType: 'WAT', submissionId: 'sub1', messaging });

  assert.ok(db._store['fcmTokens/user1_device1'], 'a transient send error must not delete the token row');
});
