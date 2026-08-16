/**
 * Phase 9 (Web SSB Test Flow Parity plan): tests for `src/evaluation/ppdtEvaluate.js`.
 *
 * `buildPPDTResult` and `ppdtRatingFromScore` are tested directly (pure functions, the
 * meat of this file's own logic). `resolveImage`/`fetchImageBytes` cover the SSRF-guard
 * behavior (host allowlisting, graceful degradation) with fakes -- no real Firestore/
 * network calls. The full `evaluatePPDT` callable's cross-cutting behavior (ownership,
 * quota, retry, status flips) is already covered by `evaluationCore.test.js`/
 * `evaluationRetry.test.js` against the same `checkQuota`/`withRetry` primitives this
 * file reuses.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPPDTResult,
  ppdtRatingFromScore,
  resolveImage,
  fetchImageBytes,
  ALLOWED_IMAGE_HOSTS
} = require('../src/evaluation/ppdtEvaluate');
const { Enums } = require('../src/generated/contracts.cjs');

const ALL_OLQ_IDS = Object.keys(Enums.OLQ);

function fullOlqScoresResponse(overrides = {}) {
  const olqScores = {};
  for (const id of ALL_OLQ_IDS) {
    olqScores[id] = { score: 6, confidence: 80, reasoning: `reasoning for ${id}` };
  }
  Object.assign(olqScores, overrides);
  return JSON.stringify({ olqScores });
}

test('Phase 9: buildPPDTResult throws (triggers retry, via withRetry catch) on unparseable Gemini output', () => {
  assert.throws(() => buildPPDTResult('not json at all'));
});

test('Phase 9: buildPPDTResult returns null (triggers retry) when fewer than 14 OLQs are present', () => {
  const olqScores = {};
  for (const id of ALL_OLQ_IDS.slice(0, 10)) {
    olqScores[id] = { score: 6, confidence: 80, reasoning: 'r' };
  }
  assert.equal(buildPPDTResult(JSON.stringify({ olqScores })), null);
});

test('Phase 9: buildPPDTResult computes overallScore as the mean of all 15 (clamped) scores and PPDT-specific rating', () => {
  const result = buildPPDTResult(fullOlqScoresResponse());
  assert.equal(result.overallScore, 6);
  assert.equal(result.overallRating, 'Average');
});

test('Phase 9: ppdtRatingFromScore uses PPDT-specific labels (GOOD/AVERAGE/BELOW_AVERAGE/NEEDS_IMPROVEMENT), not the generic Exceptional/Good/Average set', () => {
  assert.equal(ppdtRatingFromScore(5), 'Good');
  assert.equal(ppdtRatingFromScore(6), 'Average');
  assert.equal(ppdtRatingFromScore(7), 'Below Average');
  assert.equal(ppdtRatingFromScore(8), 'Needs Improvement');
});

test('Phase 9: buildPPDTResult picks the 3 lowest scores as strengths (SSB scale: lower is better)', () => {
  const result = buildPPDTResult(fullOlqScoresResponse({ COURAGE: { score: 5, confidence: 90, reasoning: 'r' } }));
  assert.ok(result.strengths.some((s) => s.startsWith('Courage (5)')), `expected COURAGE in strengths, got ${result.strengths}`);
});

test('Phase 9: buildPPDTResult picks the 3 highest scores as weaknesses', () => {
  const result = buildPPDTResult(fullOlqScoresResponse({ STAMINA: { score: 9, confidence: 90, reasoning: 'r' } }));
  assert.ok(result.weaknesses.some((w) => w.startsWith('Stamina (9)')), `expected STAMINA in weaknesses, got ${result.weaknesses}`);
});

test('Phase 9: buildPPDTResult includes the weaknesses-referencing recommendation in the middle slot, matching PPDTAnalysisOrchestrator.kt order', () => {
  const result = buildPPDTResult(fullOlqScoresResponse());
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.recommendations[0], 'Continue practicing PPDT with diverse scenarios');
  assert.ok(result.recommendations[1].startsWith('Focus on strengthening:'));
  assert.equal(result.recommendations[2], 'Maintain clear and positive storytelling');
});

test('Phase 9: buildPPDTResult sets aiConfidence to the rounded overall (averaged) confidence', () => {
  const result = buildPPDTResult(fullOlqScoresResponse({ EFFECTIVE_INTELLIGENCE: { score: 6, confidence: 10, reasoning: 'r' } }));
  const expectedAverage = Math.round((10 + 80 * 14) / 15);
  assert.equal(result.aiConfidence, expectedAverage);
});

test('Phase 9: resolveImage returns null when the batch doc does not exist (caller proceeds with empty image, not a thrown error)', async () => {
  const fakeDb = { doc: () => ({ get: async () => ({ exists: false }) }) };
  const result = await resolveImage(fakeDb, 'q1', 'batch_001');
  assert.equal(result, null);
});

test('Phase 9: resolveImage returns null when no image in the batch matches questionId', async () => {
  const fakeDb = {
    doc: () => ({
      get: async () => ({ exists: true, data: () => ({ images: [{ id: 'other-question', imageUrl: 'https://firebasestorage.googleapis.com/x' }] }) })
    })
  };
  const result = await resolveImage(fakeDb, 'q1', 'batch_001');
  assert.equal(result, null);
});

test('Phase 9: resolveImage returns the matching image entry\'s imageUrl/imageContext, never trusting anything off a submission doc', async () => {
  const fakeDb = {
    doc: (path) => {
      assert.equal(path, 'test_content/ppdt/image_batches/batch_001');
      return {
        get: async () => ({
          exists: true,
          data: () => ({
            images: [
              { id: 'q1', imageUrl: 'https://firebasestorage.googleapis.com/x', imageContext: { sceneDescription: 'a scene' } }
            ]
          })
        })
      };
    }
  };
  const result = await resolveImage(fakeDb, 'q1', 'batch_001');
  assert.equal(result.imageUrl, 'https://firebasestorage.googleapis.com/x');
  assert.equal(result.imageContext.sceneDescription, 'a scene');
});

test('Phase 9: fetchImageBytes returns an empty buffer (not a thrown error) for a non-allowlisted host (SSRF guard)', async () => {
  const bytes = await fetchImageBytes('https://evil.example.com/image.jpg');
  assert.equal(bytes.length, 0);
});

test('Phase 9: ALLOWED_IMAGE_HOSTS only allows Firebase/Google Cloud Storage domains', () => {
  assert.deepEqual(ALLOWED_IMAGE_HOSTS, ['firebasestorage.googleapis.com', 'storage.googleapis.com']);
});
