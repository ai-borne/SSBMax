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
  scoreOIRSubmission
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
