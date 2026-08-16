/**
 * `evaluateSRT` Cloud Function (Phase 5 Ship, Web SSB Test Flow Parity plan).
 *
 * Thin wrapper over `core.js::runEvaluation` -- everything cross-cutting (ownership,
 * status guard, quota re-check, ANALYZING/COMPLETED/FAILED flips, retry, result write)
 * lives there. This file supplies only SRT's prompt builder and its
 * parse-and-validate step, and assembles the `psych_results` document shape that
 * `OLQAnalysisResultDto` (`data-firebase/.../SubmissionSharedMappers.kt`) expects,
 * mirroring `SRTAnalysisOrchestrator.analyze` (`shared/.../PsychAnalysisOrchestrators.kt`)
 * field-for-field, same as `watEvaluate.js`.
 *
 * Only `{ submissionId }` is accepted from the client -- the function fetches the
 * submission itself (ownership-checked in `core.js`), so a client can't forge which
 * submission/testType gets evaluated.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { runEvaluation } = require('./core');
const { buildSRTPrompt } = require('./srtPrompts');
const { parseEvaluationResponse, finalizeOlqScores, ratingFromScore } = require('./responseParser');
const { validateScores } = require('./validation');
const { generateContent } = require('./geminiClient');
const { FirestorePaths, Enums } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const SRT_RECOMMENDATIONS = [
  'Continue practicing SRT with realistic scenarios',
  'Focus on strengthening identified weak areas',
  'Develop balanced and mature reactions to challenges'
];

/**
 * Default entry type for the (non-blocking, log-only) SSB validation call -- see
 * `watEvaluate.js`'s identical constant for the rationale.
 */
const DEFAULT_ENTRY_TYPE = 'GRADUATE';

function olqLabel(olqId, score) {
  const displayName = (Enums.OLQ[olqId] && Enums.OLQ[olqId].displayName) || olqId;
  return `${displayName} (${score})`;
}

/**
 * Builds the `psych_results` document body (everything `core.js` doesn't already add
 * itself -- it separately adds `submissionId`/`testType`/`userId`/`analyzedAt`).
 */
function buildSRTResult(rawResponseText) {
  const parsed = finalizeOlqScores(parseEvaluationResponse(rawResponseText));
  if (!parsed) {
    return null;
  }

  const scoreEntries = Object.entries(parsed.olqScores);
  const overallScore = scoreEntries.reduce((sum, [, s]) => sum + s.score, 0) / scoreEntries.length;
  const sortedAscending = [...scoreEntries].sort((a, b) => a[1].score - b[1].score);
  const strengths = sortedAscending.slice(0, 3).map(([olqId, s]) => olqLabel(olqId, s.score));
  const weaknesses = sortedAscending
    .slice()
    .reverse()
    .slice(0, 3)
    .map(([olqId, s]) => olqLabel(olqId, s.score));

  // Non-blocking, log-only -- matches PsychAnalysisOrchestrators.kt calling
  // ValidationIntegration.validateScores only to log its recommendation, never to
  // gate the write.
  const scoresByOlq = {};
  for (const [olqId, s] of scoreEntries) scoresByOlq[olqId] = s.score;
  const validation = validateScores(scoresByOlq, DEFAULT_ENTRY_TYPE);
  console.log(`SRT SSB validation: ${validation.recommendation}`);

  return {
    olqScores: parsed.olqScores,
    overallScore,
    overallRating: ratingFromScore(overallScore),
    strengths,
    weaknesses,
    recommendations: SRT_RECOMMENDATIONS,
    aiConfidence: scoreEntries[0] ? scoreEntries[0][1].confidence : 50,
    validStoriesCount: 0,
    failedStoriesCount: 0,
    usedPartialAssessment: false
  };
}

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60
};

exports.evaluateSRT = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const { submissionId } = data || {};
  if (!submissionId || typeof submissionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'submissionId is required');
  }

  return runEvaluation({
    firestoreDb: admin.firestore(),
    generateContent,
    uid: context.auth.uid,
    submissionId,
    testType: 'SRT',
    buildPrompt: buildSRTPrompt,
    parseAndValidate: buildSRTResult,
    resultCollection: FirestorePaths.PSYCH_RESULTS
  });
});

exports.buildSRTResult = buildSRTResult;
