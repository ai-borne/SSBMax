/**
 * Interview session/result server-migration plan (Phase 2): tests for
 * `src/interview/aggregateInterviewResult.js`, a direct port of
 * `InterviewResultAggregation.kt::aggregateInterviewResult`/`generateInterviewFeedback`.
 * Each assertion pins a Kotlin-side behavior (truncation not rounding, lower-score-is-better
 * strengths/weaknesses ordering, empty-response edge cases) so the JS port can't silently drift.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregateInterviewResult, generateInterviewFeedback } = require('../src/interview/aggregateInterviewResult');

function session(overrides = {}) {
  return { id: 'sess1', userId: 'user1', mode: 'VOICE_BASED', questionIds: ['q1', 'q2'], startedAt: Date.now() - 60000, ...overrides };
}

function response(olqScores, confidenceScore = 70) {
  return { olqScores, confidenceScore };
}

test('aggregateInterviewResult averages multiple responses for the same OLQ and truncates like Kotlin toInt()', () => {
  const responses = [
    response({ COURAGE: { score: 5, confidence: 80 } }),
    response({ COURAGE: { score: 6, confidence: 90 } })
  ];
  const result = aggregateInterviewResult(session(), responses, 'result1');
  // (5+6)/2 = 5.5 -> Math.trunc = 5 (Kotlin's toInt() truncates toward zero, not rounds)
  assert.equal(result.overallOLQScores.COURAGE.score, 5);
  assert.equal(result.overallOLQScores.COURAGE.confidence, 85);
  assert.equal(result.overallOLQScores.COURAGE.reasoning, 'Aggregated from 2 responses');
});

test('aggregateInterviewResult picks the 3 lowest-scored OLQs as strengths (lower score = better in SSB)', () => {
  const responses = [
    response({
      COURAGE: { score: 1, confidence: 90 },
      STAMINA: { score: 2, confidence: 90 },
      DETERMINATION: { score: 3, confidence: 90 },
      INITIATIVE: { score: 9, confidence: 90 }
    })
  ];
  const result = aggregateInterviewResult(session(), responses, 'result1');
  assert.deepEqual(result.strengths, ['COURAGE', 'STAMINA', 'DETERMINATION']);
});

test('aggregateInterviewResult picks the 3 highest-scored OLQs as weaknesses', () => {
  const responses = [
    response({
      COURAGE: { score: 1, confidence: 90 },
      STAMINA: { score: 8, confidence: 90 },
      DETERMINATION: { score: 9, confidence: 90 },
      INITIATIVE: { score: 10, confidence: 90 }
    })
  ];
  const result = aggregateInterviewResult(session(), responses, 'result1');
  assert.deepEqual(result.weaknesses, ['STAMINA', 'DETERMINATION', 'INITIATIVE']);
});

test('aggregateInterviewResult computes categoryScores as the average of that category\'s scored OLQs', () => {
  const responses = [response({ COURAGE: { score: 4, confidence: 90 }, STAMINA: { score: 6, confidence: 90 } })];
  const result = aggregateInterviewResult(session(), responses, 'result1');
  // COURAGE and STAMINA are both CHARACTER-category OLQs (olqData.js)
  assert.equal(result.categoryScores.CHARACTER, 5);
  assert.equal(result.categoryScores.INTELLECTUAL, 0, 'a category with no scored OLQs defaults to 0, not omitted');
});

test('aggregateInterviewResult defaults overallRating to 1 when no response has any OLQ score', () => {
  const result = aggregateInterviewResult(session(), [response({}, 0)], 'result1');
  assert.equal(result.overallRating, 1);
  assert.equal(result.overallConfidence, 0);
});

test('aggregateInterviewResult defaults overallRating/overallConfidence to 1/0 with zero responses', () => {
  const result = aggregateInterviewResult(session(), [], 'result1');
  assert.equal(result.overallRating, 1);
  assert.equal(result.overallConfidence, 0);
  assert.equal(result.totalResponses, 0);
});

test('aggregateInterviewResult sets totalQuestions/totalResponses from session.questionIds and the responses array', () => {
  const responses = [response({ COURAGE: { score: 5, confidence: 80 } }), response({ COURAGE: { score: 5, confidence: 80 } })];
  const result = aggregateInterviewResult(session({ questionIds: ['q1', 'q2', 'q3'] }), responses, 'result1');
  assert.equal(result.totalQuestions, 3);
  assert.equal(result.totalResponses, 2);
});

test('generateInterviewFeedback picks the "excellent" tier at rating <= 5', () => {
  const text = generateInterviewFeedback(['COURAGE'], ['STAMINA'], 5);
  assert.match(text, /^Excellent performance!/);
});

test('generateInterviewFeedback picks the "good" tier at rating 6-7', () => {
  const text = generateInterviewFeedback(['COURAGE'], ['STAMINA'], 7);
  assert.match(text, /^Good performance\./);
});

test('generateInterviewFeedback picks the "needs focus" tier at rating > 7', () => {
  const text = generateInterviewFeedback(['COURAGE'], ['STAMINA'], 8);
  assert.match(text, /^Focus on developing/);
});
