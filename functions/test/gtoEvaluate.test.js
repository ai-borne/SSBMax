/**
 * Phase 8 (Web SSB Test Flow Parity plan): tests for `src/evaluation/gtoEvaluate.js`.
 *
 * `buildGTOResult` and `GTO_SUBTYPE_CONFIG` are tested directly (pure functions/data,
 * the meat of this file's own logic). The full `evaluateGTO` callable's cross-cutting
 * behavior (ownership, quota, retry) reuses `checkQuota`/`withRetry` already covered by
 * `evaluationCore.test.js`/`retry.test.js` -- this file's own contribution is the
 * top-level `status` field (not `data.analysisStatus`) and the GD/GPE/Lecturette
 * subtype dispatch, both exercised below.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGTOResult, GTO_SUBTYPE_CONFIG } = require('../src/evaluation/gtoEvaluate');
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

test('Phase 8: GTO_SUBTYPE_CONFIG supports exactly GD/GPE/Lecturette, mapping to their domain GTOTestType names', () => {
  assert.deepEqual(Object.keys(GTO_SUBTYPE_CONFIG).sort(), ['GTO_GD', 'GTO_GPE', 'GTO_LECTURETTE']);
  assert.equal(GTO_SUBTYPE_CONFIG.GTO_GD.resultTestType, 'GROUP_DISCUSSION');
  assert.equal(GTO_SUBTYPE_CONFIG.GTO_GPE.resultTestType, 'GROUP_PLANNING_EXERCISE');
  assert.equal(GTO_SUBTYPE_CONFIG.GTO_LECTURETTE.resultTestType, 'LECTURETTE');
});

test('Phase 8: buildGTOResult throws (triggers retry, via withRetry catch) on unparseable Gemini output', () => {
  assert.throws(() => buildGTOResult('not json at all'));
});

test('Phase 8: buildGTOResult returns null (triggers retry) when fewer than 14 OLQs are present', () => {
  const olqScores = {};
  for (const id of ALL_OLQ_IDS.slice(0, 10)) {
    olqScores[id] = { score: 6, confidence: 80, reasoning: 'r' };
  }
  assert.equal(buildGTOResult(JSON.stringify({ olqScores })), null);
});

test('Phase 8: buildGTOResult computes overallScore as the mean of all 15 (clamped) scores and a matching rating', () => {
  const result = buildGTOResult(fullOlqScoresResponse());
  assert.equal(result.overallScore, 6);
  assert.equal(result.overallRating, 'Good');
});

test('Phase 8: buildGTOResult has no strengths/weaknesses/recommendations fields (GTOResultDto is a leaner shape than psych_results)', () => {
  const result = buildGTOResult(fullOlqScoresResponse());
  assert.equal(result.strengths, undefined);
  assert.equal(result.weaknesses, undefined);
  assert.equal(result.recommendations, undefined);
});

test('Phase 8: buildGTOResult sets aiConfidence to the rounded overall (averaged) confidence', () => {
  const result = buildGTOResult(fullOlqScoresResponse({ EFFECTIVE_INTELLIGENCE: { score: 6, confidence: 10, reasoning: 'r' } }));
  const expectedAverage = Math.round((10 + 80 * 14) / 15);
  assert.equal(result.aiConfidence, expectedAverage);
});
