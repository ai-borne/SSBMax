/**
 * Phase 11a (Web SSB Test Flow Parity plan): tests for `src/submissions.js`.
 *
 * Tests the injectable creation functions directly (same convention as
 * `eligibility.test.js`/`evaluationCore.test.js` -- the `onCall` wrappers
 * themselves call `admin.firestore()` internally and aren't unit-testable
 * without a live/emulated Admin SDK, so all the real logic lives in an
 * injectable function each wrapper delegates to).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createStandardSubmission,
  createGTOSubmission,
  createInterviewResponse,
  createPIQSubmission,
  GTO_TEST_TYPES
} = require('../src/submissions');

/** Minimal fake supporting `collection(path).add(value)` and `.doc(id).get()`. */
function makeFakeDb(initialDocs = {}) {
  const store = { ...initialDocs };
  let nextId = 1;

  function docRef(path) {
    return {
      async get() {
        const data = store[path];
        return { exists: data !== undefined, data: () => data };
      }
    };
  }

  function collectionRef(path) {
    return {
      doc: (id) => docRef(`${path}/${id}`),
      async add(value) {
        const id = `auto${nextId++}`;
        store[`${path}/${id}`] = value;
        return { id };
      }
    };
  }

  return { collection: (path) => collectionRef(path), _store: store };
}

test('Phase 11a: createStandardSubmission writes the nested data.analysisStatus envelope evaluate* functions expect', async () => {
  const db = makeFakeDb();
  const result = await createStandardSubmission(db, 'user1', 'WAT', { responses: [{ word: 'DOG', response: 'Bark', timeTakenSeconds: 3 }] });
  assert.equal(result.success, true);
  const doc = db._store[`submissions/${result.submissionId}`];
  assert.equal(doc.userId, 'user1');
  assert.equal(doc.testType, 'WAT');
  assert.equal(doc.data.analysisStatus, 'PENDING_ANALYSIS');
  assert.deepEqual(doc.data.responses, [{ word: 'DOG', response: 'Bark', timeTakenSeconds: 3 }]);
});

test('Phase 11a: createGTOSubmission writes the top-level status field, not data.analysisStatus, matching gtoEvaluate.js', async () => {
  const db = makeFakeDb();
  const result = await createGTOSubmission(db, 'user1', 'GTO_GD', { topic: 'Leadership', response: 'text', charCount: 4 });
  const doc = db._store[`submissions/${result.submissionId}`];
  assert.equal(doc.status, 'PENDING_ANALYSIS');
  assert.equal(doc.data.analysisStatus, undefined);
  assert.equal(doc.testType, 'GTO_GD');
  assert.equal(doc.data.topic, 'Leadership');
});

test('Phase 11a: createGTOSubmission rejects an unknown GTO type', async () => {
  const db = makeFakeDb();
  await assert.rejects(() => createGTOSubmission(db, 'user1', 'GTO_NOPE', {}));
});

test('Phase 11a: GTO_TEST_TYPES covers all 7 real gradeable sub-types (not 8 -- see plan Context correction)', () => {
  assert.deepEqual(
    [...GTO_TEST_TYPES].sort(),
    ['GTO_CT', 'GTO_GD', 'GTO_GOR', 'GTO_GPE', 'GTO_HGT', 'GTO_IO', 'GTO_LECTURETTE', 'GTO_PGT'].sort()
  );
});

test('Phase 11a: createInterviewResponse writes to interview_responses with empty olqScores, not the submissions collection', async () => {
  const db = makeFakeDb({ 'interview_sessions/sess1': { userId: 'user1' } });
  const result = await createInterviewResponse(db, 'user1', {
    sessionId: 'sess1',
    questionId: 'q1',
    responseText: 'my answer',
    responseMode: 'TEXT_BASED'
  });
  assert.equal(result.success, true);
  const doc = db._store[`interview_responses/${result.responseId}`];
  assert.equal(doc.sessionId, 'sess1');
  assert.equal(doc.responseText, 'my answer');
  assert.deepEqual(doc.olqScores, {});
  assert.equal(db._store[`submissions/${result.responseId}`], undefined);
});

test('Phase 11a: createInterviewResponse rejects when the session belongs to a different user', async () => {
  const db = makeFakeDb({ 'interview_sessions/sess1': { userId: 'someone-else' } });
  await assert.rejects(() =>
    createInterviewResponse(db, 'user1', { sessionId: 'sess1', questionId: 'q1', responseText: 'x' })
  );
});

test('Phase 11a: createInterviewResponse rejects when the session does not exist', async () => {
  const db = makeFakeDb();
  await assert.rejects(() =>
    createInterviewResponse(db, 'user1', { sessionId: 'missing', questionId: 'q1', responseText: 'x' })
  );
});

test('Phase 11b: createPIQSubmission writes analysisStatus COMPLETED immediately -- PIQ has no evaluate* function to flip it later', async () => {
  const db = makeFakeDb();
  const result = await createPIQSubmission(db, 'user1', { targetBoard: 'Indian Army (SSB)', entryType: 'NDA' });
  const doc = db._store[`submissions/${result.submissionId}`];
  assert.equal(doc.testType, 'PIQ');
  assert.equal(doc.data.analysisStatus, 'COMPLETED');
  assert.equal(doc.data.targetBoard, 'Indian Army (SSB)');
});
