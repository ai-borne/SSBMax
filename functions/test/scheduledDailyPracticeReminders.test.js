/**
 * Notification & Intelligence Sync plan, Phase 3: tests for
 * `src/notifications/scheduledDailyPracticeReminders.js`. Uses the same in-memory fake-Firestore
 * convention as `sendNotification.test.js` (`writeAndPush` writes into `notifications/{id}` and
 * reads `fcmTokens/*` for the push multicast), extended with a `notificationPreferences`
 * collection supporting `.where('enableTestReminders', '==', true).limit(n)`, matching this
 * function's actual query shape.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { sendDailyPracticeReminders, MAX_PRACTICE_REMINDER_RECIPIENTS } = require('../src/notifications/scheduledDailyPracticeReminders');

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
    const prefix = `${collectionPath}/`;
    function allDocs() {
      return Object.keys(store)
        .filter((path) => path.startsWith(prefix))
        .map((path) => ({ ref: docRef(path), data: () => store[path] }));
    }

    function query(filters, limitCount) {
      return {
        where(field, op, value) {
          if (op !== '==') {
            throw new Error(`fake Firestore only supports '==' where clauses, got '${op}'`);
          }
          return query([...filters, [field, value]], limitCount);
        },
        limit(n) {
          return query(filters, n);
        },
        async get() {
          let docs = allDocs().filter(({ data }) => filters.every(([field, value]) => data()[field] === value));
          if (limitCount != null) docs = docs.slice(0, limitCount);
          return { empty: docs.length === 0, docs };
        }
      };
    }

    return {
      doc: (id) => docRef(`${collectionPath}/${id || `auto${++autoIdSeq}`}`),
      ...query([], null)
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

test('sends a TEST_REMINDER notification only to users with enableTestReminders == true', async () => {
  const db = makeFakeDb();
  db._seed('notificationPreferences/user1', { userId: 'user1', enableTestReminders: true });
  db._seed('notificationPreferences/user2', { userId: 'user2', enableTestReminders: false });
  const messaging = makeFakeMessaging();

  const { sentCount } = await sendDailyPracticeReminders(db, messaging);

  assert.equal(sentCount, 1);
  const notifications = Object.entries(db._store).filter(([path]) => path.startsWith('notifications/'));
  assert.equal(notifications.length, 1);
  const [, doc] = notifications[0];
  assert.equal(doc.userId, 'user1');
  assert.equal(doc.type, 'TEST_REMINDER');
});

test('writes one notification + push per matching user', async () => {
  const db = makeFakeDb();
  db._seed('notificationPreferences/user1', { userId: 'user1', enableTestReminders: true });
  db._seed('notificationPreferences/user2', { userId: 'user2', enableTestReminders: true });
  db._seed('fcmTokens/user1_device1', { userId: 'user1', deviceId: 'device1', token: 'tok-1' });
  db._seed('fcmTokens/user2_device1', { userId: 'user2', deviceId: 'device1', token: 'tok-2' });
  const messaging = makeFakeMessaging();

  const { sentCount } = await sendDailyPracticeReminders(db, messaging);

  assert.equal(sentCount, 2);
  assert.equal(messaging.calls.length, 2);
  const sentTokens = messaging.calls.map((call) => call.tokens[0]).sort();
  assert.deepEqual(sentTokens, ['tok-1', 'tok-2']);
});

test('respects the .limit() cap on the preferences query', async () => {
  const db = makeFakeDb();
  for (let i = 0; i < MAX_PRACTICE_REMINDER_RECIPIENTS + 5; i++) {
    db._seed(`notificationPreferences/user${i}`, { userId: `user${i}`, enableTestReminders: true });
  }
  const messaging = makeFakeMessaging();

  const { sentCount } = await sendDailyPracticeReminders(db, messaging);

  assert.equal(sentCount, MAX_PRACTICE_REMINDER_RECIPIENTS);
});

test('sends no notifications when nobody has enableTestReminders == true', async () => {
  const db = makeFakeDb();
  db._seed('notificationPreferences/user1', { userId: 'user1', enableTestReminders: false });
  const messaging = makeFakeMessaging();

  const { sentCount } = await sendDailyPracticeReminders(db, messaging);

  assert.equal(sentCount, 0);
  assert.equal(messaging.calls.length, 0);
});
