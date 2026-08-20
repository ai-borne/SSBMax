/**
 * Server-side port of `data-firebase/.../InterviewResultAggregation.kt::aggregateInterviewResult`
 * + `generateInterviewFeedback` for use by `completeInterviewSession.js`. Same OLQ-averaging,
 * strengths/weaknesses (lowest 3 / highest 3 scores -- lower is better in SSB convention),
 * and category-score logic; JS `Math.trunc` matches Kotlin `Double.toInt()`'s truncation.
 */

const { OLQ_DISPLAY_NAMES, OLQ_CATEGORY, CATEGORIES } = require('./olqData');

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function average(nums) {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * @param session {{ id: string, userId: string, mode: string, questionIds: string[], startedAt: number }}
 * @param responses {{ olqScores: Record<string, {score:number, confidence:number}>, confidenceScore: number }[]}
 * @param resultId id to assign to the produced result (caller-supplied, e.g. crypto.randomUUID())
 */
function aggregateInterviewResult(session, responses, resultId) {
  const olqScoresMap = {};
  responses.forEach((response) => {
    Object.entries(response.olqScores || {}).forEach(([olq, score]) => {
      if (!olqScoresMap[olq]) olqScoresMap[olq] = [];
      olqScoresMap[olq].push(score);
    });
  });

  const overallOLQScores = {};
  for (const [olq, scores] of Object.entries(olqScoresMap)) {
    const avgScore = clamp(Math.trunc(average(scores.map((s) => s.score))), 1, 10);
    const avgConfidence = Math.trunc(average(scores.map((s) => s.confidence)));
    overallOLQScores[olq] = {
      score: avgScore,
      confidence: avgConfidence,
      reasoning: `Aggregated from ${scores.length} responses`
    };
  }

  const categoryScores = {};
  CATEGORIES.forEach((category) => {
    const categoryOLQs = Object.entries(OLQ_CATEGORY)
      .filter(([, cat]) => cat === category)
      .map(([olq]) => olq);
    const scores = categoryOLQs.map((olq) => overallOLQScores[olq]?.score).filter((s) => s !== undefined);
    categoryScores[category] = scores.length === 0 ? 0 : average(scores);
  });

  const sortedOLQs = Object.entries(overallOLQScores).sort((a, b) => a[1].score - b[1].score);
  const strengths = sortedOLQs.slice(0, 3).map(([olq]) => olq);
  const weaknesses = sortedOLQs.slice(-3).map(([olq]) => olq);

  const overallConfidence = responses.length > 0 ? Math.trunc(average(responses.map((r) => r.confidenceScore || 0))) : 0;
  const olqAvgScores = Object.values(overallOLQScores).map((s) => s.score);
  const overallRating = olqAvgScores.length > 0 ? clamp(Math.trunc(average(olqAvgScores)), 1, 10) : 1;

  const durationSec = Math.max(0, Math.trunc((Date.now() - (session.startedAt || Date.now())) / 1000));

  return {
    id: resultId,
    sessionId: session.id,
    userId: session.userId,
    mode: session.mode,
    completedAt: Date.now(),
    durationSec,
    totalQuestions: (session.questionIds || []).length,
    totalResponses: responses.length,
    overallOLQScores,
    categoryScores,
    overallConfidence,
    strengths,
    weaknesses,
    feedback: generateInterviewFeedback(strengths, weaknesses, overallRating),
    overallRating
  };
}

function generateInterviewFeedback(strengths, weaknesses, rating) {
  const strengthNames = strengths.map((olq) => OLQ_DISPLAY_NAMES[olq] || olq).join(', ');
  const weaknessNames = weaknesses.map((olq) => OLQ_DISPLAY_NAMES[olq] || olq).join(', ');

  if (rating <= 5) {
    return `Excellent performance! Your strengths in ${strengthNames} stood out. Consider developing: ${weaknessNames}`;
  }
  if (rating <= 7) {
    return `Good performance. Strong areas: ${strengthNames}. Areas for improvement: ${weaknessNames}`;
  }
  return `Focus on developing: ${weaknessNames}. Build on your strengths in: ${strengthNames}`;
}

module.exports = { aggregateInterviewResult, generateInterviewFeedback };
