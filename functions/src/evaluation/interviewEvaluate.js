/**
 * `evaluateInterviewResponse` Cloud Function (Phase 7 Ship, Web SSB Test Flow Parity
 * plan) -- generalizes the existing `aiAnalysis.js::analyzeInterviewResponse` into the
 * same ownership/retry/quota shape every other `evaluation/*Evaluate.js` callable
 * has, while keeping Interview's **per-response** (not per-submission) evaluation
 * contract per the plan's locked-in decision (Context, plan line 9).
 *
 * Interview's Firestore shape doesn't fit `core.js::runEvaluation` (built for a single
 * `submissions/{id}` doc with one `PENDING_ANALYSIS`->`COMPLETED` flip): a session has
 * many `interview_responses` docs, each evaluated independently, with no per-response
 * `analysisStatus` field to guard on -- so this file is a bespoke, `runEvaluation`-
 * shaped wrapper rather than a thin call into it, reusing `core.js::checkQuota`,
 * `retry.js::withRetry`, and `responseParser.js::parseEvaluationResponse` directly.
 *
 * `interview_responses/{id}` doesn't carry `questionText`/`expectedOLQs` fields (only
 * `questionId`) -- the pre-existing `aiAnalysis.js::analyzeInterviewResponse` assumed
 * those lived on the response doc itself, which was already stale against
 * `InterviewResponseDto`'s real wire shape (`data-firebase/.../InterviewFirestoreDtos.kt`).
 * Fixed here by fetching the `interview_questions/{questionId}` doc, matching
 * `InterviewAnalysisOrchestrator.kt`'s own `interviewRepository.getQuestion(...)` call.
 *
 * Only `{ responseId, sessionId }` accepted from the client -- ownership is
 * dual-checked against the session doc (`sessionDoc.userId === uid`) and, if present,
 * the response doc's own `userId` side-channel field, mirroring the legacy function's
 * "Dual-Ownership Verification".
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { checkQuota } = require('./core');
const { withRetry } = require('./retry');
const { parseEvaluationResponse } = require('./responseParser');
const { buildInterviewPrompt } = require('./interviewPrompts');
const { generateContent } = require('./geminiClient');
const { FirestorePaths } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const MAX_RESPONSE_CHARACTERS = 4000;
const INTERVIEW_TEST_TYPE = 'IO';

function clampOlqScore(score) {
  const n = Number.isFinite(score) ? Math.round(score) : 6;
  return Math.min(10, Math.max(1, n));
}

/**
 * Builds the `interview_responses/{id}` update body -- `olqScores` keyed by OLQ id
 * (matching `InterviewResponseDto.olqScores: Map<String, OLQScoreDto>`, score/confidence
 * clamped to the domain `OLQScore` invariants of 1..10/0..100) plus `confidenceScore`.
 * Returns `null` (triggers a retry via `withRetry`) on unparseable/empty output.
 */
function buildInterviewResult(rawResponseText) {
  let parsed;
  try {
    parsed = parseEvaluationResponse(rawResponseText);
  } catch (e) {
    return null;
  }
  if (!parsed || Object.keys(parsed.olqScores).length === 0) {
    return null;
  }

  const olqScores = {};
  for (const [olqId, scoreDto] of Object.entries(parsed.olqScores)) {
    olqScores[olqId] = {
      score: clampOlqScore(scoreDto.score),
      confidence: Math.min(100, Math.max(0, Math.round(parsed.overallConfidence))),
      reasoning: scoreDto.reasoning || ''
    };
  }

  return {
    olqScores,
    confidenceScore: Math.min(100, Math.max(0, Math.round(parsed.overallConfidence)))
  };
}

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60
};

exports.evaluateInterviewResponse = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const uid = context.auth.uid;
  const { responseId, sessionId } = data || {};
  if (!responseId || typeof responseId !== 'string' || !sessionId || typeof sessionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'responseId and sessionId are required');
  }

  const db = admin.firestore();
  const responseRef = db.collection(FirestorePaths.INTERVIEW_RESPONSES).doc(responseId);

  const [responseSnap, sessionSnap] = await Promise.all([
    responseRef.get(),
    db.collection(FirestorePaths.INTERVIEW_SESSIONS).doc(sessionId).get()
  ]);

  if (!responseSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Response ${responseId} not found`);
  }
  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Session ${sessionId} not found`);
  }

  const responseData = responseSnap.data();
  const sessionData = sessionSnap.data();
  if (sessionData.userId !== uid || (responseData.userId && responseData.userId !== uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Permission denied: ownership check failed');
  }

  if (Object.keys(responseData.olqScores || {}).length > 0) {
    return { success: true, skipped: true, responseId };
  }

  const candidateText = responseData.responseText || '';
  if (candidateText.length > MAX_RESPONSE_CHARACTERS) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Response text exceeds maximum allowed length of ${MAX_RESPONSE_CHARACTERS} characters`
    );
  }

  await checkQuota(db, uid, INTERVIEW_TEST_TYPE);

  const questionSnap = await db.collection(FirestorePaths.INTERVIEW_QUESTIONS).doc(responseData.questionId).get();
  const questionText = questionSnap.exists ? questionSnap.data().questionText || 'Question' : 'Question';
  const expectedOLQs = questionSnap.exists ? questionSnap.data().targetOLQs || [] : [];

  const prompt = buildInterviewPrompt(questionText, candidateText, expectedOLQs, responseData.responseMode || 'VOICE_BASED');

  const result = await withRetry({
    call: async () => buildInterviewResult(await generateContent(prompt)),
    isAcceptable: (r) => r !== null && r !== undefined,
    fillDefaults: (r) => r
  });

  if (!result) {
    return { success: false, responseId };
  }

  await responseRef.update({ olqScores: result.olqScores, confidenceScore: result.confidenceScore });

  return { success: true, responseId };
});

exports.buildInterviewResult = buildInterviewResult;
exports.MAX_RESPONSE_CHARACTERS = MAX_RESPONSE_CHARACTERS;
