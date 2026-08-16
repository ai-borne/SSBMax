/**
 * Phase 10 (Web SSB Test Flow Parity plan): tests for `src/evaluation/tatEvaluate.js`.
 *
 * `buildTATResult` is tested directly (pure, the meat of the synthesis-stage logic).
 * `resolveImageBatch`/`fetchImageBytes` cover the SSRF-guard behavior (host
 * allowlisting, one-batch-read resolution, graceful degradation) with fakes -- no real
 * Firestore/network calls. The full `evaluateTAT` callable's cross-cutting behavior
 * (ownership, quota, retry, status flips) reuses `core.js::checkQuota`/
 * `retry.js::withRetry`, already covered by `evaluationCore.test.js`/
 * `evaluationRetry.test.js`. Per-story Gemini orchestration (`analyzeStory`) and the
 * concurrency cap itself are covered structurally by `concurrency.test.js` (the piece
 * `analyzeStory` is driven through) rather than re-mocking the Gemini client here.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTATResult,
  resolveImageBatch,
  fetchImageBytes,
  ALLOWED_IMAGE_HOSTS,
  MIN_STORY_THRESHOLD,
  STORY_CONCURRENCY
} = require('../src/evaluation/tatEvaluate');
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

function fiveAssessments() {
  return Array.from({ length: 5 }, (_, i) => ({
    questionId: `q${i}`,
    storyIndex: i,
    story: `story ${i}`,
    overallScore: 6,
    overallRating: 'Good',
    aiConfidence: 70,
    olqScores: { COURAGE: { score: 6, confidence: 70, reasoning: 'r' } }
  }));
}

test('Phase 10: MIN_STORY_THRESHOLD matches TATAnalysisOrchestrator.kt\'s 6-of-12 minimum', () => {
  assert.equal(MIN_STORY_THRESHOLD, 6);
});

test('Phase 10: STORY_CONCURRENCY stays within the plan\'s 4-6 target range', () => {
  assert.ok(STORY_CONCURRENCY >= 4 && STORY_CONCURRENCY <= 6, `got ${STORY_CONCURRENCY}`);
});

test('Phase 10: buildTATResult throws (triggers retry, via withRetry catch) on unparseable Gemini output', () => {
  assert.throws(() => buildTATResult('not json at all', fiveAssessments(), 0));
});

test('Phase 10: buildTATResult returns null (triggers retry) when fewer than 14 OLQs are present', () => {
  const olqScores = {};
  for (const id of ALL_OLQ_IDS.slice(0, 10)) {
    olqScores[id] = { score: 6, confidence: 80, reasoning: 'r' };
  }
  assert.equal(buildTATResult(JSON.stringify({ olqScores }), fiveAssessments(), 0), null);
});

test('Phase 10: buildTATResult computes overallScore as the mean of all 15 (clamped) synthesis scores', () => {
  const result = buildTATResult(fullOlqScoresResponse(), fiveAssessments(), 0);
  assert.equal(result.overallScore, 6);
  assert.equal(result.overallRating, 'Good');
});

test('Phase 10: buildTATResult picks the 3 lowest scores as strengths (SSB scale: lower is better)', () => {
  const result = buildTATResult(fullOlqScoresResponse({ COURAGE: { score: 5, confidence: 90, reasoning: 'r' } }), fiveAssessments(), 0);
  assert.ok(result.strengths.some((s) => s.startsWith('Courage (5)')), `expected COURAGE in strengths, got ${result.strengths}`);
});

test('Phase 10: buildTATResult picks the 3 highest scores as weaknesses', () => {
  const result = buildTATResult(fullOlqScoresResponse({ STAMINA: { score: 9, confidence: 90, reasoning: 'r' } }), fiveAssessments(), 0);
  assert.ok(result.weaknesses.some((w) => w.startsWith('Stamina (9)')), `expected STAMINA in weaknesses, got ${result.weaknesses}`);
});

test('Phase 10: buildTATResult includes the weaknesses-referencing recommendation in the middle slot, matching TATAnalysisOrchestrator.kt order', () => {
  const result = buildTATResult(fullOlqScoresResponse(), fiveAssessments(), 0);
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.recommendations[0], 'Review your narrative arcs across all stories');
  assert.ok(result.recommendations[1].startsWith('Focus on strengthening:'));
  assert.equal(result.recommendations[2], 'Maintain proactive and optimistic storytelling');
});

test('Phase 10: buildTATResult reports validStoriesCount/failedStoriesCount/usedPartialAssessment from the per-story pipeline', () => {
  const assessments = fiveAssessments();
  const result = buildTATResult(fullOlqScoresResponse(), assessments, 2);
  assert.equal(result.validStoriesCount, 5);
  assert.equal(result.failedStoriesCount, 2);
  assert.equal(result.usedPartialAssessment, true);
});

test('Phase 10: buildTATResult sets usedPartialAssessment to false when no stories failed', () => {
  const result = buildTATResult(fullOlqScoresResponse(), fiveAssessments(), 0);
  assert.equal(result.usedPartialAssessment, false);
});

test('Phase 10: buildTATResult sets aiConfidence to the rounded overall (averaged) confidence', () => {
  const result = buildTATResult(fullOlqScoresResponse({ EFFECTIVE_INTELLIGENCE: { score: 6, confidence: 10, reasoning: 'r' } }), fiveAssessments(), 0);
  const expectedAverage = Math.round((10 + 80 * 14) / 15);
  assert.equal(result.aiConfidence, expectedAverage);
});

test('Phase 10: resolveImageBatch returns an empty map when the batch doc does not exist (caller proceeds with empty images, not a thrown error)', async () => {
  const fakeDb = { doc: () => ({ get: async () => ({ exists: false }) }) };
  const map = await resolveImageBatch(fakeDb, 'batch_001');
  assert.equal(map.size, 0);
});

test('Phase 10: resolveImageBatch resolves every question in one batch read, never trusting the submission doc', async () => {
  let requestedPath = null;
  const fakeDb = {
    doc: (path) => {
      requestedPath = path;
      return {
        get: async () => ({
          exists: true,
          data: () => ({
            images: [
              { id: 'q1', imageUrl: 'https://firebasestorage.googleapis.com/1', imageContext: { sceneDescription: 'scene 1' }, genderTag: 'MALE' },
              { id: 'q2', imageUrl: 'https://firebasestorage.googleapis.com/2', imageContext: { sceneDescription: 'scene 2' }, genderTag: 'MIXED' }
            ]
          })
        })
      };
    }
  };
  const map = await resolveImageBatch(fakeDb, 'batch_001');
  assert.equal(requestedPath, 'test_content/tat/image_batches/batch_001');
  assert.equal(map.size, 2);
  assert.equal(map.get('q1').imageUrl, 'https://firebasestorage.googleapis.com/1');
  assert.equal(map.get('q1').genderTag, 'MALE');
  assert.equal(map.get('q2').imageContext.sceneDescription, 'scene 2');
});

test('Phase 10: resolveImageBatch skips entries missing id or imageUrl', async () => {
  const fakeDb = {
    doc: () => ({
      get: async () => ({
        exists: true,
        data: () => ({ images: [{ id: 'q1' }, { imageUrl: 'https://firebasestorage.googleapis.com/x' }] })
      })
    })
  };
  const map = await resolveImageBatch(fakeDb, 'batch_001');
  assert.equal(map.size, 0);
});

test('Phase 10: fetchImageBytes returns an empty buffer (not a thrown error) for a non-allowlisted host (SSRF guard)', async () => {
  const bytes = await fetchImageBytes('https://evil.example.com/image.jpg');
  assert.equal(bytes.length, 0);
});

test('Phase 10: ALLOWED_IMAGE_HOSTS only allows Firebase/Google Cloud Storage domains', () => {
  assert.deepEqual(ALLOWED_IMAGE_HOSTS, ['firebasestorage.googleapis.com', 'storage.googleapis.com']);
});
