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
  createOIRSubmission,
  checkInterviewPrerequisites,
  GTO_TEST_TYPES
} = require('../src/submissions');
const { FirestorePaths } = require('../src/generated/contracts.cjs');

/**
 * Fake supporting `collection(path).add(value)`, `.doc(id).get()`, and the
 * `.where().where().orderBy().limit().get()` query chain `submitInterviewResponse`'s
 * prerequisite check needs to find a user's latest PIQ/OIR/PPDT submission, plus
 * the tier/usage doc reads `checkQuota` (functions/src/evaluation/core.js) needs.
 * Query filtering is a plain in-memory scan over `_store` -- sufficient for unit
 * tests, not a real Firestore query planner.
 */
function makeFakeDb(initialDocs = {}) {
  const store = { ...initialDocs };
  let nextId = 1;

  function docRef(path) {
    return {
      async get() {
        const data = store[path];
        return { exists: data !== undefined, data: () => data };
      },
      collection: (sub) => collectionRef(`${path}/${sub}`)
    };
  }

  function queryRef(path, filters, orderField, orderDir, limitN) {
    return {
      where(field, op, value) {
        return queryRef(path, [...filters, { field, op, value }], orderField, orderDir, limitN);
      },
      orderBy(field, dir = 'asc') {
        return queryRef(path, filters, field, dir, limitN);
      },
      limit(n) {
        return queryRef(path, filters, orderField, orderDir, n);
      },
      async get() {
        let docs = Object.entries(store)
          .filter(([key]) => key.startsWith(`${path}/`))
          .map(([, value]) => value)
          .filter((doc) => filters.every(({ field, value }) => doc[field] === value));
        if (orderField) {
          docs = docs.slice().sort((a, b) => (orderDir === 'desc' ? b[orderField] - a[orderField] : a[orderField] - b[orderField]));
        }
        if (limitN) docs = docs.slice(0, limitN);
        return { empty: docs.length === 0, docs: docs.map((data) => ({ data: () => data })) };
      }
    };
  }

  function collectionRef(path) {
    return {
      doc: (id) => docRef(`${path}/${id}`),
      where(field, op, value) {
        return queryRef(path, [{ field, op, value }]);
      },
      async add(value) {
        const id = `auto${nextId++}`;
        store[`${path}/${id}`] = value;
        return { id };
      }
    };
  }

  return { collection: (path) => collectionRef(path), _store: store };
}

/** Builds a submissions-collection doc matching the real userId/testType/submittedAt shape. */
function submissionDoc({ userId, testType, submittedAt, data = {} }) {
  return { userId, testType, submittedAt, data };
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
  const db = makeFakeDb({
    'interview_sessions/sess1': { userId: 'user1' },
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    'submissions/oir1': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 80 } } }),
    [TIER_DOC_PATH]: { tier: 'PREMIUM' }
  });
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

/**
 * OIR notification/persistence parity fix (2026-08-17): web's OIR flow previously never created a
 * `submissions/{id}` doc at all, unlike every other test type -- so it had no result history and
 * never triggered `onOirSubmissionCreated`'s notification. `createOIRSubmission` closes that gap.
 */
test('createOIRSubmission scores server-side (never trusts a client-supplied score) and persists the result', async () => {
  const db = makeFakeDb({
    [`${FirestorePaths.TestContent.OIR_BATCHES}/batch1`]: {
      questions: [
        { id: 'q1', correctAnswerId: 'a' },
        { id: 'q2', correctAnswerId: 'b' },
        { id: 'q3', correctAnswerId: 'c' },
        { id: 'q4', correctAnswerId: 'd' }
      ]
    }
  });

  const result = await createOIRSubmission(db, 'user1', {
    batchId: 'batch1',
    userAnswers: { q1: 'a', q2: 'x', q3: 'c' }, // q1/q3 correct, q2 wrong, q4 skipped
    timeTakenSeconds: 120
  });

  assert.equal(result.success, true);
  assert.equal(result.score, 2);
  assert.equal(result.total, 4);
  assert.equal(typeof result.oirRating, 'number');

  const doc = db._store[`submissions/${result.submissionId}`];
  assert.equal(doc.userId, 'user1');
  assert.equal(doc.testType, 'OIR');
  assert.equal(doc.status, 'SUBMITTED_PENDING_REVIEW');
  assert.equal(doc.batchId, 'batch1');
  assert.equal(doc.data.testResult.totalQuestions, 4);
  assert.equal(doc.data.testResult.correctAnswers, 2);
  assert.equal(doc.data.testResult.incorrectAnswers, 1);
  assert.equal(doc.data.testResult.skippedQuestions, 1);
  assert.equal(doc.data.testResult.percentageScore, 50);
  assert.equal(doc.data.testResult.oirRating, result.oirRating);
  assert.equal(doc.data.testResult.timeTakenSeconds, 120);
});

test('createOIRSubmission rejects with no batchId', async () => {
  const db = makeFakeDb();
  await assert.rejects(() => createOIRSubmission(db, 'user1', { userAnswers: {} }));
});

test('createOIRSubmission throws not-found for a missing batch, never falling back to scoring everything correct', async () => {
  const db = makeFakeDb();
  await assert.rejects(
    () => createOIRSubmission(db, 'user1', { batchId: 'batch_missing', userAnswers: {} }),
    (err) => {
      assert.equal(err.code, 'not-found');
      return true;
    }
  );
});

test('createOIRSubmission writes a doc that checkInterviewPrerequisites\' OIR gate reads correctly (integration between the two fixes)', async () => {
  const db = makeFakeDb({
    [`${FirestorePaths.TestContent.OIR_BATCHES}/batch1`]: {
      questions: [{ id: 'q1', correctAnswerId: 'a' }, { id: 'q2', correctAnswerId: 'b' }]
    },
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    [TIER_DOC_PATH]: { tier: 'PREMIUM' }
  });

  await createOIRSubmission(db, 'user1', { batchId: 'batch1', userAnswers: { q1: 'a', q2: 'b' } }); // 100%

  await assert.doesNotReject(() => checkInterviewPrerequisites(db, 'user1'));
});

/**
 * Server-side mirror of `CheckInterviewPrerequisitesUseCase.kt` -- this is the fix
 * for the gap the SSOT audit found: `submitInterviewResponse` previously only
 * checked session ownership, so a client bypassing KMP's client-side prerequisite
 * check (e.g. web, or a direct Functions/Firestore call) could submit interview
 * responses without PIQ/OIR/PPDT/quota ever being verified.
 */
const TIER_DOC_PATH = 'users/user1/data/subscription';
function usageDocPath(userId, month) {
  return `users/${userId}/subscription/usage_${month}`;
}
function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

test('checkInterviewPrerequisites rejects when PIQ has never been submitted', async () => {
  const db = makeFakeDb({
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    'submissions/oir1': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 80 } } })
  });
  await assert.rejects(() => checkInterviewPrerequisites(db, 'user1'), /PIQ/);
});

test('checkInterviewPrerequisites rejects when PPDT has never been submitted', async () => {
  const db = makeFakeDb({
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/oir1': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 80 } } })
  });
  await assert.rejects(() => checkInterviewPrerequisites(db, 'user1'), /PPDT/);
});

test('checkInterviewPrerequisites rejects when OIR has never been submitted', async () => {
  const db = makeFakeDb({
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 })
  });
  await assert.rejects(() => checkInterviewPrerequisites(db, 'user1'), /OIR/);
});

test('checkInterviewPrerequisites rejects when OIR score is below the 50% threshold, matching CheckInterviewPrerequisitesUseCase', async () => {
  const db = makeFakeDb({
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    'submissions/oir1': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 49 } } })
  });
  await assert.rejects(() => checkInterviewPrerequisites(db, 'user1'), /OIR/);
});

test('checkInterviewPrerequisites uses the most recent OIR attempt (highest submittedAt), not an earlier failing one', async () => {
  const db = makeFakeDb({
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    'submissions/oirOld': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 20 } } }),
    'submissions/oirNew': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 2, data: { testResult: { percentageScore: 80 } } }),
    [TIER_DOC_PATH]: { tier: 'PREMIUM' }
  });
  await assert.doesNotReject(() => checkInterviewPrerequisites(db, 'user1'));
});

test('checkInterviewPrerequisites rejects when the interview monthly quota is exhausted', async () => {
  const month = currentMonthKey();
  const db = makeFakeDb({
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    'submissions/oir1': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 80 } } }),
    [TIER_DOC_PATH]: { tier: 'FREE' },
    [usageDocPath('user1', month)]: { interviewTestsUsed: 5 }
  });
  await assert.rejects(() => checkInterviewPrerequisites(db, 'user1'), /quota|Quota/);
});

test('checkInterviewPrerequisites passes when PIQ + PPDT are submitted, OIR is >=50%, and quota remains', async () => {
  const db = makeFakeDb({
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    'submissions/oir1': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 50 } } }),
    [TIER_DOC_PATH]: { tier: 'PREMIUM' }
  });
  await assert.doesNotReject(() => checkInterviewPrerequisites(db, 'user1'));
});

test('createInterviewResponse rejects a submission when prerequisites are not met, even with a valid owned session', async () => {
  const db = makeFakeDb({ 'interview_sessions/sess1': { userId: 'user1' } });
  await assert.rejects(
    () => createInterviewResponse(db, 'user1', { sessionId: 'sess1', questionId: 'q1', responseText: 'my answer' }),
    /PIQ/
  );
  assert.equal(Object.keys(db._store).some((k) => k.startsWith('interview_responses/')), false);
});

test('createInterviewResponse succeeds once prerequisites are met', async () => {
  const db = makeFakeDb({
    'interview_sessions/sess1': { userId: 'user1' },
    'submissions/piq1': submissionDoc({ userId: 'user1', testType: 'PIQ', submittedAt: 1 }),
    'submissions/ppdt1': submissionDoc({ userId: 'user1', testType: 'PPDT', submittedAt: 1 }),
    'submissions/oir1': submissionDoc({ userId: 'user1', testType: 'OIR', submittedAt: 1, data: { testResult: { percentageScore: 80 } } }),
    [TIER_DOC_PATH]: { tier: 'PREMIUM' }
  });
  const result = await createInterviewResponse(db, 'user1', { sessionId: 'sess1', questionId: 'q1', responseText: 'my answer' });
  assert.equal(result.success, true);
});
