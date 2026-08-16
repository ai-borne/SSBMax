/**
 * Phase 7 (Web SSB Test Flow Parity plan): tests for `src/evaluation/interviewEvaluate.js`.
 *
 * `buildInterviewResult` is tested directly (pure function, the meat of this file's own
 * logic, and the piece that diverges from WAT/SRT/SD: a single interview response only
 * targets a subset of the 15 OLQs, so unlike `finalizeOlqScores` there is no
 * 14-of-15-acceptance gate or neutral-fill here -- any 1+ valid OLQ score is accepted).
 * The full callable's cross-cutting ownership/quota checks mirror the already-tested
 * `checkQuota` (`evaluationCore.test.js`) and the legacy dual-ownership check this file
 * generalizes (`aiAnalysis.js::analyzeInterviewResponse`, tested pre-Phase-7).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildInterviewResult } = require('../src/evaluation/interviewEvaluate');

function arrayResponse(items, extra = {}) {
  return JSON.stringify({ olqScores: items, ...extra });
}

test('Phase 7: buildInterviewResult parses a targeted-subset olqScores array (not all 15)', () => {
  const result = buildInterviewResult(
    arrayResponse([{ olq: 'INITIATIVE', score: 4, reasoning: 'proactive', evidence: ['took charge'] }], {
      overallConfidence: 80
    })
  );
  assert.deepEqual(Object.keys(result.olqScores), ['INITIATIVE']);
  assert.equal(result.olqScores.INITIATIVE.score, 4);
  assert.equal(result.olqScores.INITIATIVE.confidence, 80);
  assert.equal(result.olqScores.INITIATIVE.reasoning, 'proactive');
  assert.equal(result.confidenceScore, 80);
});

test('Phase 7: buildInterviewResult clamps a decimal score to the domain OLQScore 1..10 int invariant', () => {
  const result = buildInterviewResult(arrayResponse([{ olq: 'COURAGE', score: 5.5, reasoning: 'r' }]));
  assert.equal(result.olqScores.COURAGE.score, 6);
  assert.ok(Number.isInteger(result.olqScores.COURAGE.score));
});

test('Phase 7: buildInterviewResult clamps an out-of-range score into 1..10', () => {
  const result = buildInterviewResult(arrayResponse([{ olq: 'STAMINA', score: 14, reasoning: 'r' }]));
  assert.equal(result.olqScores.STAMINA.score, 10);
});

test('Phase 7: buildInterviewResult returns null (triggers retry) on unparseable Gemini output', () => {
  assert.equal(buildInterviewResult('not json at all'), null);
});

test('Phase 7: buildInterviewResult returns null (triggers retry) when no OLQ in the response matches a known id', () => {
  const result = buildInterviewResult(arrayResponse([{ olq: 'NOT_A_REAL_OLQ', score: 5, reasoning: 'r' }]));
  assert.equal(result, null);
});

test('Phase 7: buildInterviewResult ignores unknown OLQ ids but keeps valid ones from the same response', () => {
  const result = buildInterviewResult(
    arrayResponse([
      { olq: 'NOT_A_REAL_OLQ', score: 5, reasoning: 'r' },
      { olq: 'DETERMINATION', score: 3, reasoning: 'persistent' }
    ])
  );
  assert.deepEqual(Object.keys(result.olqScores), ['DETERMINATION']);
});
