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
const { withRetry } = require('./retry');
const { parseEvaluationResponse } = require('./responseParser');
const { buildInterviewPrompt } = require('./interviewPrompts');
const { generateContent } = require('./geminiClient');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { recordAndEnforce } = require('../eligibility');
const { notifyEvaluationComplete } = require('../notifications/sendNotification');

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
  timeoutSeconds: 60,
  secrets: ['GEMINI_API_KEY']
};

/**
 * Interview has no session-level `COMPLETED` flip (per-response evaluation, plan-locked
 * decision -- see this file's class doc), so "the interview is done" has to be derived
 * from the session's own `questionIds` list (the one place a session already records its
 * expected response count -- `GitLiveInterviewRepository.createSession` writes it at
 * session-creation time). Tracks which responses have been evaluated on the session doc
 * itself (`evaluatedResponseIds`), transactionally, and fires exactly one notification --
 * guarded by a `notifiedComplete` flag so a retried/duplicate call after the session is
 * already complete can't re-notify -- the same session-keyed idempotency shape
 * `recordAndEnforce` (above) uses for quota charging, applied here to notification instead.
 * Returns whether this call is the one that completed the session (caller notifies
 * outside the transaction so a transaction retry can't send a duplicate push).
 */
async function markResponseEvaluatedAndMaybeCompleteSession(db, sessionRef, sessionData, responseId) {
  const totalExpected = (sessionData.questionIds || []).length;
  if (totalExpected === 0) {
    // No expected-count signal on this session (legacy/malformed doc) -- fail loud by
    // falling back to per-response notification rather than silently never notifying.
    return true;
  }

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    const current = snap.exists ? snap.data() : sessionData;
    const evaluatedResponseIds = current.evaluatedResponseIds || [];
    const alreadyNotified = current.notifiedComplete === true;
    const updatedIds = evaluatedResponseIds.includes(responseId)
      ? evaluatedResponseIds
      : [...evaluatedResponseIds, responseId];
    const isComplete = updatedIds.length >= totalExpected;
    const willNotifyNow = isComplete && !alreadyNotified;

    tx.set(
      sessionRef,
      {
        ...current,
        evaluatedResponseIds: updatedIds,
        ...(willNotifyNow ? { notifiedComplete: true } : {})
      },
      { merge: true }
    );

    return willNotifyNow;
  });
}

/**
 * Injectable core -- the `onCall` wrapper below only fetches `admin.firestore()`/auth.
 * `generateContentFn`/`retryDelayFn` default to the real Gemini call/backoff but are
 * overridable so tests can exercise the full flow without a live Gemini key or real timers.
 */
async function evaluateInterviewResponseCore(db, uid, responseId, sessionId, generateContentFn = generateContent, retryDelayFn) {
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

  // Enforce AND charge here, keyed by sessionId (not responseId or a read-only
  // pre-check): a session has many evaluated responses, but the interview quota
  // counts one interview attempt. A plain read-only `checkQuota` pre-check would
  // see this session's own already-recorded charge as "at limit" and incorrectly
  // block every response after the first in the same session -- `recordAndEnforce`'s
  // idempotency-by-key makes the first response in a session the one that enforces
  // the limit and charges; every later response in that same session is a no-op.
  await recordAndEnforce(db, uid, INTERVIEW_TEST_TYPE, sessionId);

  const questionSnap = await db.collection(FirestorePaths.INTERVIEW_QUESTIONS).doc(responseData.questionId).get();
  const questionText = questionSnap.exists ? questionSnap.data().questionText || 'Question' : 'Question';
  const expectedOLQs = questionSnap.exists ? questionSnap.data().targetOLQs || [] : [];

  const prompt = buildInterviewPrompt(questionText, candidateText, expectedOLQs, responseData.responseMode || 'VOICE_BASED');

  const result = await withRetry({
    call: async () => buildInterviewResult(await generateContentFn(prompt)),
    isAcceptable: (r) => r !== null && r !== undefined,
    fillDefaults: (r) => r,
    ...(retryDelayFn ? { delayFn: retryDelayFn } : {})
  });

  if (!result) {
    return { success: false, responseId };
  }

  await responseRef.update({ olqScores: result.olqScores, confidenceScore: result.confidenceScore });

  const sessionRef = db.collection(FirestorePaths.INTERVIEW_SESSIONS).doc(sessionId);
  const sessionComplete = await markResponseEvaluatedAndMaybeCompleteSession(db, sessionRef, sessionData, responseId);
  if (sessionComplete) {
    await notifyEvaluationComplete({ firestoreDb: db, userId: uid, testType: INTERVIEW_TEST_TYPE, submissionId: sessionId });
  }

  return { success: true, responseId };
}

exports.evaluateInterviewResponse = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const { responseId, sessionId } = data || {};
  if (!responseId || typeof responseId !== 'string' || !sessionId || typeof sessionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'responseId and sessionId are required');
  }
  return evaluateInterviewResponseCore(admin.firestore(), context.auth.uid, responseId, sessionId);
});

exports.buildInterviewResult = buildInterviewResult;
exports.MAX_RESPONSE_CHARACTERS = MAX_RESPONSE_CHARACTERS;
exports.evaluateInterviewResponseCore = evaluateInterviewResponseCore;
exports.markResponseEvaluatedAndMaybeCompleteSession = markResponseEvaluatedAndMaybeCompleteSession;
