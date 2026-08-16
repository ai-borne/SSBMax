/**
 * Phase 1 (Web SSB Test Flow Parity plan): tests for `src/evaluation/responseParser.js`,
 * a port of shared/.../ai/KtorGeminiResponseParser.kt's evaluation-scoring shapes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractJsonFromResponse, parseEvaluationResponse } = require('../src/evaluation/responseParser');

test('Phase 1: extractJsonFromResponse strips ```json fences', () => {
  const text = '```json\n{"olqScores": []}\n```';
  assert.equal(extractJsonFromResponse(text), '{"olqScores": []}');
});

test('Phase 1: extractJsonFromResponse extracts a bare object without fences', () => {
  const text = 'Here is the result: {"olqScores": []} thanks!';
  assert.equal(extractJsonFromResponse(text), '{"olqScores": []}');
});

test('Phase 1: parseEvaluationResponse handles the olqScores-array shape (interview single-response)', () => {
  const text = JSON.stringify({
    olqScores: [{ olq: 'COURAGE', score: 5, reasoning: 'steady under pressure', evidence: ['quote'] }],
    overallConfidence: 75,
    keyInsights: ['insight'],
    suggestedFollowUp: 'follow up?'
  });
  const result = parseEvaluationResponse(text);
  assert.deepEqual(Object.keys(result.olqScores), ['COURAGE']);
  assert.equal(result.olqScores.COURAGE.score, 5);
  assert.equal(result.overallConfidence, 75);
  assert.deepEqual(result.keyInsights, ['insight']);
  assert.equal(result.suggestedFollowUp, 'follow up?');
});

test('Phase 1: parseEvaluationResponse handles the keyed-object shape (canonical GTO/TAT/WAT/SRT/SD/PPDT)', () => {
  const text = JSON.stringify({
    olqScores: {
      COURAGE: { score: 4, confidence: 80, reasoning: 'r1' },
      STAMINA: { score: 6, confidence: 60, reasoning: 'r2' }
    },
    notRecommended: false
  });
  const result = parseEvaluationResponse(text);
  assert.deepEqual(Object.keys(result.olqScores).sort(), ['COURAGE', 'STAMINA']);
  assert.equal(result.overallConfidence, 70); // average of 80 and 60
});

test('Phase 1: parseEvaluationResponse handles the bare-array shape (alternate GTO/TAT/WAT/SRT/SD/PPDT output)', () => {
  const text = JSON.stringify([
    { olq: 'INITIATIVE', score: 5, confidence: 70, reasoning: 'r1' },
    { olq: 'DETERMINATION', score: 6, confidence: 50, reasoning: 'r2' }
  ]);
  const result = parseEvaluationResponse(text);
  assert.deepEqual(Object.keys(result.olqScores).sort(), ['DETERMINATION', 'INITIATIVE']);
  assert.equal(result.overallConfidence, 60);
});

test('Phase 1: parseEvaluationResponse matches OLQ names case-insensitively against id or displayName', () => {
  const text = JSON.stringify({ olqScores: [{ olq: 'courage', score: 5 }] });
  const result = parseEvaluationResponse(text);
  assert.deepEqual(Object.keys(result.olqScores), ['COURAGE']);

  const text2 = JSON.stringify({ olqScores: [{ olq: 'Courage', score: 5 }] });
  const result2 = parseEvaluationResponse(text2);
  assert.deepEqual(Object.keys(result2.olqScores), ['COURAGE']);
});

test('Phase 1: parseEvaluationResponse throws on empty input', () => {
  assert.throws(() => parseEvaluationResponse(''));
  assert.throws(() => parseEvaluationResponse(null));
});

test('Phase 1: parseEvaluationResponse throws on garbage/unparseable input', () => {
  assert.throws(() => parseEvaluationResponse('not json at all'));
});

test('Phase 1: parseEvaluationResponse throws when no OLQ names in the response match the contract', () => {
  const text = JSON.stringify({ olqScores: [{ olq: 'NOT_A_REAL_OLQ', score: 5 }] });
  assert.throws(() => parseEvaluationResponse(text));
});
