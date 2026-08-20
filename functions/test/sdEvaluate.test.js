/**
 * Phase 6 (Web SSB Test Flow Parity plan): tests for `src/evaluation/sdEvaluate.js`.
 * `buildSDResult` is tested directly (pure function, the meat of this file's own
 * logic); the full `evaluateSD` callable's cross-cutting behavior (ownership, quota,
 * retry, status flips) is already covered by `evaluationCore.test.js` against
 * `runEvaluation` directly, so this file's integration test only needs to confirm the
 * wiring -- that `evaluateSD` really does plug `buildSDResult`/`buildSDPrompt` into
 * `runEvaluation` and lands a `psych_results` doc shaped like `OLQAnalysisResultDto`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSDResult } = require('../src/evaluation/sdEvaluate');
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

test('Phase 6: buildSDResult throws (triggers retry, via runEvaluation/withRetry catch) on unparseable Gemini output', () => {
  assert.throws(() => buildSDResult('not json at all'));
});

test('Phase 6: buildSDResult returns null (triggers retry) when fewer than 14 OLQs are present', () => {
  const olqScores = {};
  for (const id of ALL_OLQ_IDS.slice(0, 10)) {
    olqScores[id] = { score: 6, confidence: 80, reasoning: 'r' };
  }
  assert.equal(buildSDResult(JSON.stringify({ olqScores })), null);
});

test('Phase 6: buildSDResult computes overallScore as the mean of all 15 (clamped) scores', () => {
  const result = buildSDResult(fullOlqScoresResponse());
  assert.equal(result.overallScore, 6);
  assert.equal(result.overallRating, 'Good');
});

test('Phase 6: buildSDResult picks the 3 lowest scores as strengths (SSB scale: lower is better)', () => {
  const result = buildSDResult(fullOlqScoresResponse({ COURAGE: { score: 5, confidence: 90, reasoning: 'r' } }));
  assert.ok(result.strengths.some((s) => s.startsWith('Courage (5)')), `expected COURAGE in strengths, got ${result.strengths}`);
});

test('Phase 6: buildSDResult picks the 3 highest scores as weaknesses', () => {
  const result = buildSDResult(fullOlqScoresResponse({ STAMINA: { score: 9, confidence: 90, reasoning: 'r' } }));
  assert.ok(result.weaknesses.some((w) => w.startsWith('Stamina (9)')), `expected STAMINA in weaknesses, got ${result.weaknesses}`);
});

test('Phase 6: buildSDResult sets aiConfidence to the overall (averaged) confidence, matching AnalysisRetry.kt overwriting every per-OLQ confidence with the analysis-level value', () => {
  const result = buildSDResult(fullOlqScoresResponse({ EFFECTIVE_INTELLIGENCE: { score: 6, confidence: 10, reasoning: 'r' } }));
  const expectedAverage = (10 + 80 * 14) / 15;
  assert.equal(result.aiConfidence, expectedAverage);
});

test('Phase 6: buildSDResult includes static SD recommendations and zeroed TAT-only fields', () => {
  const result = buildSDResult(fullOlqScoresResponse());
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.validStoriesCount, 0);
  assert.equal(result.failedStoriesCount, 0);
  assert.equal(result.usedPartialAssessment, false);
});
