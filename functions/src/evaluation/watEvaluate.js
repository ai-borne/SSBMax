/**
 * `evaluateWAT` Cloud Function (Phase 4 Ship, Web SSB Test Flow Parity plan).
 *
 * Thin wrapper over `core.js::runEvaluation` -- everything cross-cutting (ownership,
 * status guard, quota re-check, ANALYZING/COMPLETED/FAILED flips, retry, result write)
 * lives there. This file supplies only WAT's prompt builder and its
 * parse-and-validate step, and assembles the `psych_results` document shape that
 * `OLQAnalysisResultDto` (`data-firebase/.../SubmissionSharedMappers.kt`) expects,
 * mirroring `WATAnalysisOrchestrator.analyze` (`shared/.../PsychAnalysisOrchestrators.kt`)
 * field-for-field: `overallScore` is the mean OLQ score, `strengths`/`weaknesses` are the
 * 3 lowest/highest-scoring OLQs (SSB scale: lower is better), `aiConfidence` is the
 * *first* OLQ's confidence (not an average) -- an existing KMP quirk, reproduced here
 * rather than "fixed", to keep the two paths' output comparable during the bake period.
 *
 * Only `{ submissionId }` is accepted from the client -- the function fetches the
 * submission itself (ownership-checked in `core.js`), so a client can't forge which
 * submission/testType gets evaluated.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { runEvaluation } = require('./core');
const { buildWATPrompt } = require('./watPrompts');
const { parseEvaluationResponse, finalizeOlqScores, ratingFromScore } = require('./responseParser');
const { validateScores } = require('./validation');
const { generateContent } = require('./geminiClient');
const { FirestorePaths, Enums } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const WAT_RECOMMENDATIONS = [
  'Continue practicing WAT with diverse word associations',
  'Focus on improving identified weak areas',
  'Maintain quick and positive responses'
];

/**
 * Default entry type for the (non-blocking, log-only) SSB validation call, matching
 * `PsychAnalysisOrchestrators.kt`'s fallback when the user profile's entry type can't
 * be resolved server-side (`ScoringUtils.toScoringEntryType(null)` defaults to GRADUATE
 * in the KMP original). The recommendation isn't part of the persisted result -- see
 * class doc.
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
function buildWATResult(rawResponseText) {
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
  console.log(`WAT SSB validation: ${validation.recommendation}`);

  return {
    olqScores: parsed.olqScores,
    overallScore,
    overallRating: ratingFromScore(overallScore),
    strengths,
    weaknesses,
    recommendations: WAT_RECOMMENDATIONS,
    aiConfidence: scoreEntries[0] ? scoreEntries[0][1].confidence : 50,
    validStoriesCount: 0,
    failedStoriesCount: 0,
    usedPartialAssessment: false
  };
}

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60,
  secrets: ['GEMINI_API_KEY']
};

exports.evaluateWAT = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
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
    testType: 'WAT',
    buildPrompt: buildWATPrompt,
    parseAndValidate: buildWATResult,
    resultCollection: FirestorePaths.PSYCH_RESULTS
  });
});

exports.buildWATResult = buildWATResult;
