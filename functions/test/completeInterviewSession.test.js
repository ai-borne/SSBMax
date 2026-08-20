/**
 * Interview session/result server-migration plan (Phase 2): tests for
 * `src/interview/completeInterviewSession.js`. Verifies the fix for the PERMISSION_DENIED bug
 * on `interview_results` (client used to write it directly; `firestore.rules` blocks that) by
 * asserting this callable aggregates and writes server-side, enforces session ownership, and
 * is idempotent against a retried call after the session is already complete.
 *
 * Uses a minimal in-memory collection-scan fake (distinct from interviewEvaluate.test.js's
 * doc-path fake) since this function needs `.where().where().get()`/`.where().limit().get()`
 * query support that fake doesn't provide.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { completeInterviewSessionCore } = require('../src/interview/completeInterviewSession');

function makeFakeDb(collections = {}) {
  const store = {};
  Object.entries(collections).forEach(([path, docs]) => {
    store[path] = new Map(Object.entries(docs));
  });

  function collectionRef(path, filters = []) {
    const docs = () => store[path] || new Map();
    return {
      doc(id) {
        return {
          async get() {
            const data = docs().get(id);
            return { exists: data !== undefined, data: () => data };
          },
          async set(value, opts) {
            const existing = docs().get(id);
            const next = opts?.merge && existing ? { ...existing, ...value } : value;
            if (!store[path]) store[path] = new Map();
            store[path].set(id, next);
          }
        };
      },
      where(field, op, value) {
        return collectionRef(path, [...filters, { field, op, value }]);
      },
      limit(n) {
        return { ...this, _limit: n, get: this._get(this._limit === undefined ? undefined : n) };
      },
      async get() {
        return this._get()();
      },
      _get(limitN) {
        return async () => {
          let entries = Array.from(docs().entries());
          filters.forEach(({ field, op, value }) => {
            entries = entries.filter(([, data]) => (op === '==' ? data[field] === value : true));
          });
          if (limitN !== undefined) entries = entries.slice(0, limitN);
          return {
            empty: entries.length === 0,
            docs: entries.map(([id, data]) => ({ id, data: () => data }))
          };
        };
      }
    };
  }

  return {
    collection: (path) => collectionRef(path),
    _store: store
  };
}

const UID = 'user1';
const SESSION_ID = 'sess1';

function baseFixtures(overrides = {}) {
  return {
    interview_sessions: { [SESSION_ID]: { id: SESSION_ID, userId: UID, mode: 'VOICE_BASED', status: 'IN_PROGRESS', startedAt: Date.now() - 60000, questionIds: ['q1'] } },
    interview_responses: { r1: { sessionId: SESSION_ID, userId: UID, questionId: 'q1', olqScores: { COURAGE: { score: 5, confidence: 80 } }, confidenceScore: 80 } },
    interview_results: {},
    submissions: {},
    ...overrides
  };
}

test('completeInterviewSessionCore rejects with not-found for a nonexistent session', async () => {
  const db = makeFakeDb(baseFixtures());
  await assert.rejects(
    () => completeInterviewSessionCore(db, UID, 'does-not-exist'),
    (err) => {
      assert.equal(err.code, 'not-found');
      return true;
    }
  );
});

test('completeInterviewSessionCore rejects with permission-denied when the caller does not own the session', async () => {
  const db = makeFakeDb(baseFixtures());
  await assert.rejects(
    () => completeInterviewSessionCore(db, 'someone-else', SESSION_ID),
    (err) => {
      assert.equal(err.code, 'permission-denied');
      return true;
    }
  );
});

test('completeInterviewSessionCore writes interview_results, flips the session to COMPLETED, and writes a progress submission (the PERMISSION_DENIED fix)', async () => {
  const db = makeFakeDb(baseFixtures());
  const { result, alreadyCompleted } = await completeInterviewSessionCore(db, UID, SESSION_ID, { newIdFn: () => 'result1' });

  assert.equal(alreadyCompleted, false);
  assert.equal(result.id, 'result1');
  assert.equal(result.sessionId, SESSION_ID);
  assert.ok(db._store.interview_results.get('result1'));

  const session = db._store.interview_sessions.get(SESSION_ID);
  assert.equal(session.status, 'COMPLETED');
  assert.ok(session.completedAt);

  const submission = db._store.submissions.get('interview_result1');
  assert.equal(submission.testType, 'IO');
  assert.equal(submission.status, 'COMPLETED');
  assert.equal(submission.userId, UID);
});

test('completeInterviewSessionCore only aggregates responses belonging to this session and this user', async () => {
  const db = makeFakeDb(
    baseFixtures({
      interview_responses: {
        r1: { sessionId: SESSION_ID, userId: UID, questionId: 'q1', olqScores: { COURAGE: { score: 5, confidence: 80 } }, confidenceScore: 80 },
        rOther: { sessionId: 'other-session', userId: UID, questionId: 'q1', olqScores: { STAMINA: { score: 9, confidence: 80 } }, confidenceScore: 80 }
      }
    })
  );
  const { result } = await completeInterviewSessionCore(db, UID, SESSION_ID, { newIdFn: () => 'result1' });
  assert.equal(result.totalResponses, 1);
  assert.deepEqual(Object.keys(result.overallOLQScores), ['COURAGE']);
});

test('completeInterviewSessionCore is idempotent: a retried call on an already-completed session returns the existing result without re-aggregating', async () => {
  const db = makeFakeDb(
    baseFixtures({
      interview_sessions: { [SESSION_ID]: { id: SESSION_ID, userId: UID, mode: 'VOICE_BASED', status: 'COMPLETED', startedAt: Date.now() - 60000, questionIds: ['q1'] } },
      interview_results: { existingResult: { id: 'existingResult', sessionId: SESSION_ID, userId: UID } }
    })
  );
  const { result, alreadyCompleted } = await completeInterviewSessionCore(db, UID, SESSION_ID, { newIdFn: () => 'shouldNotBeUsed' });
  assert.equal(alreadyCompleted, true);
  assert.equal(result.id, 'existingResult');
  assert.equal(db._store.interview_results.has('shouldNotBeUsed'), false);
});
