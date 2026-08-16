/**
 * Phase 1 (Centralized Result-Announcement Notifications plan): tests for
 * `src/notifications/sendNotification.js`'s `notifyEvaluationComplete`.
 * Uses the same in-memory fake-Firestore convention as `evaluationCore.test.js`.
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
      }
    };
  }

  function collectionRef(path) {
    return {
      doc: (id) => docRef(`${path}/${id || `auto${++autoIdSeq}`}`)
    };
  }

  return {
    collection: (path) => collectionRef(path),
    _store: store
  };
}

test('Phase 1: notifyEvaluationComplete writes a doc matching SSBMaxNotification field-for-field', async () => {
  const db = makeFakeDb();
  const { id } = await notifyEvaluationComplete({
    firestoreDb: db,
    userId: 'user1',
    testType: 'WAT',
    submissionId: 'sub1'
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
    const { id } = await notifyEvaluationComplete({ firestoreDb: db, userId: 'u', testType, submissionId: 's' });
    assert.equal(db._store[`notifications/${id}`].type, 'GRADING_COMPLETE');
  }
});

test('Phase 1: notifyEvaluationComplete writes a fresh doc id per call, not reusing submissionId', async () => {
  const db = makeFakeDb();
  const first = await notifyEvaluationComplete({ firestoreDb: db, userId: 'u', testType: 'WAT', submissionId: 'sub1' });
  const second = await notifyEvaluationComplete({ firestoreDb: db, userId: 'u', testType: 'WAT', submissionId: 'sub1' });
  assert.notEqual(first.id, second.id, 're-notifying the same submission must not clobber a prior notification');
});
