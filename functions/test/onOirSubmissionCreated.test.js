/**
 * Regression coverage for the bug reported live on-device (2026-08-17): completing an OIR test
 * never fired a "your result is ready" notification, unlike WAT/SRT/SD/PPDT. Root cause:
 * `oirScoring.js::evaluateOIRAnswers` runs before any submission id exists (KMP mints it and
 * writes `submissions/{id}` only after scoring), so it never had anything to call
 * `notifyEvaluationComplete` against. `onOirSubmissionCreated` closes that gap by firing on the
 * submission doc's creation instead, since for OIR the result is already fully known at that point.
 *
 * Uses the same in-memory fake-Firestore convention as `sendNotification.test.js` (this test seeds
 * an FCM token to also assert the trigger's push side-effect, not just the doc write).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { handleOirSubmissionCreated } = require('../src/notifications/onOirSubmissionCreated');

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

function makeFakeMessaging() {
  const calls = [];
  return {
    calls,
    async sendEachForMulticast(message) {
      calls.push(message);
      return { responses: message.tokens.map(() => ({ success: true })) };
    }
  };
}

function fakeSnap(id, data) {
  return { id, data: () => data };
}

test('fires notifyEvaluationComplete for a newly created OIR submission doc', async () => {
  const db = makeFakeDb();
  db._seed('fcmTokens/user1_device1', { userId: 'user1', deviceId: 'device1', token: 'tok-1', platform: 'android' });
  const messaging = makeFakeMessaging();

  const snap = fakeSnap('sub_oir_1', { userId: 'user1', testType: 'OIR', status: 'SUBMITTED_PENDING_REVIEW' });
  await handleOirSubmissionCreated(snap, { firestoreDb: db, messaging });

  const notifications = Object.entries(db._store).filter(([path]) => path.startsWith('notifications/'));
  assert.equal(notifications.length, 1, 'exactly one notification doc must be written');
  const [, doc] = notifications[0];
  assert.equal(doc.userId, 'user1');
  assert.deepEqual(doc.actionData, { submissionId: 'sub_oir_1', testType: 'OIR' });
  assert.equal(messaging.calls.length, 1, 'push must also fire, same as every other test type');
});

test('does nothing for a non-OIR submission doc (WAT/SRT/etc. are already notified by evaluation/core.js)', async () => {
  const db = makeFakeDb();
  const messaging = makeFakeMessaging();

  const snap = fakeSnap('sub_wat_1', { userId: 'user1', testType: 'WAT', status: 'SUBMITTED_PENDING_REVIEW' });
  const result = await handleOirSubmissionCreated(snap, { firestoreDb: db, messaging });

  assert.equal(result, null);
  const notifications = Object.keys(db._store).filter((path) => path.startsWith('notifications/'));
  assert.equal(notifications.length, 0, 'must not double-notify a test type core.js already handles');
});

test('does nothing for a doc with no data (defensive against a delete-then-recreate race)', async () => {
  const db = makeFakeDb();
  const snap = fakeSnap('sub_x', undefined);
  const result = await handleOirSubmissionCreated(snap, { firestoreDb: db, messaging: makeFakeMessaging() });
  assert.equal(result, null);
});
