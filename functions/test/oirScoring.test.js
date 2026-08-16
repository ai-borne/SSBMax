/**
 * Phase 0a: OIR Scoring Hotfix Tests
 *
 * Runs via Node native test runner (node --test)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateOIRSubmission,
  fetchOIRBatchQuestions,
  scoreOIRSubmission,
  scoreOIRQuestionSubset,
  evaluateOIRMultiBatch,
  isAnswerCorrect
} = require('../src/oirScoring');

/**
 * Fake Firestore client that asserts the exact collection path used (read
 * from the generated contract, not a literal), so a regression back to a
 * wrong or fallback path fails this test.
 */
const { FirestorePaths } = require('../src/generated/contracts.cjs');

function makeFakeDb(batchExists, batchData) {
  return {
    collection(name) {
      assert.equal(
        name,
        FirestorePaths.TestContent.OIR_BATCHES,
        'must read the KMP-authoritative OIR batches path, not question_batches/content_oir/oir_batches'
      );
      return {
        doc(batchId) {
          return {
            async get() {
              return { exists: batchExists, data: () => batchData };
            }
          };
        }
      };
    }
  };
}

test('Phase 0a: reads test_content/oir/batches/{batchId}, not a legacy collection', async (t) => {
  const db = makeFakeDb(true, { questions: [{ id: 'q1', correctAnswerId: 'a' }] });
  const questions = await fetchOIRBatchQuestions(db, 'batch_pdf_001');
  assert.equal(questions.length, 1);
});

test('Phase 0a: a missing batch throws not-found, never falls back to scoring everything correct', async (t) => {
  const db = makeFakeDb(false, undefined);
  await assert.rejects(
    () => evaluateOIRSubmission(db, 'batch_pdf_999', { q1: 0 }),
    (err) => {
      assert.equal(err.code, 'not-found');
      return true;
    }
  );
});

test('Phase 0a: batch_pdf_001 + a known answer sheet produces a known score', async (t) => {
  const questions = [
    { id: 'q1', correctAnswerId: 'a' },
    { id: 'q2', correctAnswerId: 'b' },
    { id: 'q3', correctAnswerId: 'c' }
  ];
  const db = makeFakeDb(true, { questions });
  const result = await evaluateOIRSubmission(db, 'batch_pdf_001', { q1: 'a', q2: 'x', q3: 'c' });
  assert.equal(result.score, 2, 'q1 and q3 correct, q2 wrong');
  assert.equal(result.total, 3);
  assert.equal(result.percentage, 67);
  assert.equal(result.oirRating, 3, '67% falls in the >=55 bucket');
});

test('Phase 0a: a wholly-unanswered submission scores 0, not the total', async (t) => {
  const questions = [{ id: 'q1', correctAnswerId: 'a' }, { id: 'q2', correctAnswerId: 'b' }];
  const result = scoreOIRSubmission(questions, {});
  assert.equal(result.score, 0);
  assert.equal(result.total, 2);
  assert.equal(result.percentage, 0);
});

test('Phase 2: scoreOIRSubmission also returns a per-question results array', () => {
  const questions = [{ id: 'q1', correctAnswerId: 'a' }, { id: 'q2', correctAnswerId: 'b' }];
  const result = scoreOIRSubmission(questions, { q1: 'a', q2: 'x' });
  assert.deepEqual(result.results, [
    { questionId: 'q1', isCorrect: true },
    { questionId: 'q2', isCorrect: false }
  ]);
});

test('Phase 2: isAnswerCorrect handles single-select id equality', () => {
  const question = { correctAnswerId: 'a' };
  assert.equal(isAnswerCorrect(question, 'a'), true);
  assert.equal(isAnswerCorrect(question, 'b'), false);
  assert.equal(isAnswerCorrect(question, undefined), false);
  assert.equal(isAnswerCorrect(question, null), false);
});

test('Phase 2: isAnswerCorrect handles multi-select as an order-independent exact set match', () => {
  const question = { correctAnswerId: '', correctAnswerIds: ['a', 'b'] };
  assert.equal(isAnswerCorrect(question, ['b', 'a']), true, 'order must not matter');
  assert.equal(isAnswerCorrect(question, ['a']), false, 'partial selection is wrong');
  assert.equal(isAnswerCorrect(question, ['a', 'b', 'c']), false, 'extra selection is wrong');
  assert.equal(isAnswerCorrect(question, []), false);
});

test('Phase 2: scoreOIRQuestionSubset only scores the submitted question ids, not the whole batch', () => {
  // The fetched batch has 3 questions, but this session only asked about 2 of them.
  const questions = [
    { id: 'q1', correctAnswerId: 'a' },
    { id: 'q2', correctAnswerId: 'b' },
    { id: 'q3', correctAnswerId: 'c' }
  ];
  const result = scoreOIRQuestionSubset(questions, { q1: 'a', q3: 'x' });
  assert.equal(result.total, 2, 'q2 was never asked in this session and must not count toward the total');
  assert.equal(result.score, 1);
  assert.deepEqual(result.results.map((r) => r.questionId).sort(), ['q1', 'q3']);
});

test('Phase 2: scoreOIRQuestionSubset throws invalid-argument for a question id not in the fetched batch', () => {
  const questions = [{ id: 'q1', correctAnswerId: 'a' }];
  assert.throws(
    () => scoreOIRQuestionSubset(questions, { q1: 'a', ghost: 'a' }),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});

test('Phase 2: evaluateOIRMultiBatch fetches and aggregates each batch, scoring only the asked subset of each', async () => {
  const batchDocs = {
    batch_a: { questions: [{ id: 'a1', correctAnswerId: 'x' }, { id: 'a2', correctAnswerId: 'y' }] },
    batch_b: { questions: [{ id: 'b1', correctAnswerId: 'z' }] }
  };
  const db = {
    collection: () => ({
      doc: (batchId) => ({
        async get() {
          return { exists: Boolean(batchDocs[batchId]), data: () => batchDocs[batchId] };
        }
      })
    })
  };

  const result = await evaluateOIRMultiBatch(db, {
    batch_a: { a1: 'x' }, // correct; a2 never asked in this session
    batch_b: { b1: 'z' } // correct
  });

  assert.equal(result.total, 2, 'only the asked questions across both batches, not every question in each batch');
  assert.equal(result.score, 2);
  assert.equal(result.percentage, 100);
  assert.equal(result.results.length, 2);
});

test('Phase 2: evaluateOIRMultiBatch rejects with not-found if any referenced batch is missing', async () => {
  const db = {
    collection: () => ({
      doc: () => ({ async get() { return { exists: false, data: () => undefined }; } })
    })
  };
  await assert.rejects(
    () => evaluateOIRMultiBatch(db, { batch_missing: { q1: 'a' } }),
    (err) => {
      assert.equal(err.code, 'not-found');
      return true;
    }
  );
});

test('Phase 2: evaluateOIRMultiBatch rejects with invalid-argument for an empty batches map', async () => {
  const db = { collection: () => ({ doc: () => ({ async get() { return { exists: false }; } }) }) };
  await assert.rejects(
    () => evaluateOIRMultiBatch(db, {}),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});
