/**
 * Phase 3 (docs/plans/CrossPlatform_SSOT): the test that would have caught web's
 * 'socialAdaptability' wire fork (§3.4) -- parseAnalysisResponse must reject any
 * olqScores[].olq value outside the generated OLQ contract, not silently accept it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAnalysisResponse } = require('../src/aiAnalysis');
const { Enums } = require('../src/generated/contracts.cjs');

function response(olqScores) {
  return JSON.stringify({ olqScores, overallConfidence: 80, keyInsights: [], suggestedFollowUp: '' });
}

test('parseAnalysisResponse accepts every known contract OLQ id', () => {
  const olqScores = Object.keys(Enums.OLQ).map((id) => ({ olq: id, score: 5, reasoning: 'ok' }));
  const parsed = parseAnalysisResponse(response(olqScores));
  assert.equal(parsed.olqScores.length, 15);
});

test('parseAnalysisResponse rejects a wire key not in the OLQ contract', () => {
  const olqScores = [{ olq: 'socialAdaptability', score: 5, reasoning: 'drifted key' }];
  assert.throws(() => parseAnalysisResponse(response(olqScores)), /unknown OLQ id 'socialAdaptability'/);
});

test('parseAnalysisResponse rejects a missing olq field on a score entry', () => {
  const olqScores = [{ score: 5, reasoning: 'no olq id at all' }];
  assert.throws(() => parseAnalysisResponse(response(olqScores)), /unknown OLQ id/);
});
