/**
 * `functions/src/submissions.js` (Phase 11a, Web SSB Test Flow Parity plan).
 *
 * Thin submission-creation callables so web can create `submissions/{id}` docs --
 * required because `web/CLAUDE.md` mandates writes-via-Cloud-Function-only (unlike
 * KMP, which writes Firestore directly via the GitLive SDK; this asymmetry is
 * pre-existing and preserved, not converged, per plan §A).
 *
 * Each callable writes exactly the envelope shape the matching `evaluate*.js` reads,
 * confirmed against those files directly:
 * - PPDT/TAT/WAT/SRT/SD: `{ userId, testType, submittedAt, data: { analysisStatus:
 *   'PENDING_ANALYSIS', ...fields } }` -- the standard nested-status envelope
 *   (`core.js`/`ppdtEvaluate.js`/`tatEvaluate.js` all read `data.analysisStatus`).
 * - GTO: `{ userId, testType, status: 'PENDING_ANALYSIS', submittedAt, data: {
 *   ...fields } }` -- `gtoEvaluate.js`'s documented top-level-`status` quirk, field
 *   name deliberately different from every other type, reproduced here rather than
 *   "fixed", to match what `evaluateGTO` actually reads.
 * - Interview stays outside `submissions/` entirely (per-response shape, not
 *   per-submission): `submitInterviewResponse` writes `interview_responses/{id}`
 *   with `olqScores: {}`, matching what `evaluateInterviewResponse` expects to find
 *   and fill in.
 *
 * Quota recording (`eligibility.js::recordAndEnforce`/`recordTestUsage`) and
 * evaluation-triggering are deliberately NOT done here -- those are the caller's
 * (web's `SubmissionService`, Phase 11b) job, matching the KMP orchestration split
 * (`SubmitXTestUseCase` creates the submission; `SubmissionAnalysisTrigger` fires the
 * analysis step separately).
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('./generated/contracts.cjs');
const { checkQuota } = require('./evaluation/core');
const { evaluateOIRSubmission } = require('./oirScoring');

if (!admin.apps.length) {
  admin.initializeApp();
}

const OIR_PASS_THRESHOLD = 50;

/**
 * Server-side mirror of `CheckInterviewPrerequisitesUseCase.kt` -- until this existed,
 * `submitInterviewResponse` only checked session ownership, so any caller bypassing
 * KMP's client-side check (web, or a direct Functions/Firestore call) could submit
 * interview responses with no PIQ/OIR-threshold/PPDT/quota gate at all (SSOT audit
 * finding: the client-side check was the *only* enforcement in the whole system).
 * Reuses `evaluation/core.js::checkQuota` for the quota leg rather than duplicating
 * it, since it's exactly the same tier/usage read `evaluateInterviewResponse` already
 * performs for its own defense-in-depth re-check.
 */
async function latestSubmission(db, uid, testType) {
  const snap = await db
    .collection(FirestorePaths.SUBMISSIONS)
    .where('userId', '==', uid)
    .where('testType', '==', testType)
    .orderBy('submittedAt', 'desc')
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].data();
}

async function checkInterviewPrerequisites(db, uid) {
  const piq = await latestSubmission(db, uid, 'PIQ');
  if (!piq) {
    throw new functions.https.HttpsError('failed-precondition', 'PIQ must be submitted before starting an interview');
  }

  const ppdt = await latestSubmission(db, uid, 'PPDT');
  if (!ppdt) {
    throw new functions.https.HttpsError('failed-precondition', 'PPDT must be submitted before starting an interview');
  }

  const oir = await latestSubmission(db, uid, 'OIR');
  const oirScore = oir?.data?.testResult?.percentageScore ?? 0;
  if (!oir || oirScore < OIR_PASS_THRESHOLD) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `OIR score of at least ${OIR_PASS_THRESHOLD}% is required before starting an interview`
    );
  }

  await checkQuota(db, uid, 'IO');
}

const GTO_TEST_TYPES = new Set(['GTO_GD', 'GTO_GPE', 'GTO_PGT', 'GTO_HGT', 'GTO_GOR', 'GTO_CT', 'GTO_IO', 'GTO_LECTURETTE']);

function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  return context.auth.uid;
}

function requireObject(data, field) {
  if (!data || typeof data !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', `${field} is required`);
  }
  return data;
}

/** Standard nested-`data.analysisStatus` envelope used by PPDT/TAT/WAT/SRT/SD. */
async function createStandardSubmission(db, uid, testType, fields) {
  const ref = await db.collection(FirestorePaths.SUBMISSIONS).add({
    userId: uid,
    testType,
    submittedAt: Date.now(),
    data: { analysisStatus: 'PENDING_ANALYSIS', ...fields }
  });
  return { success: true, submissionId: ref.id };
}

/**
 * PIQ has no Gemini evaluation -- it's a personal-info/prerequisite form, not a
 * gradeable OLQ test (there is no `evaluatePIQ` function and none is planned). Status
 * is written as `COMPLETED` immediately rather than `PENDING_ANALYSIS`, since nothing
 * will ever flip it -- a permanently-pending status would look like a stuck analysis
 * to anything polling `getSubmissionStatus`.
 */
async function createPIQSubmission(db, uid, fields) {
  const ref = await db.collection(FirestorePaths.SUBMISSIONS).add({
    userId: uid,
    testType: 'PIQ',
    submittedAt: Date.now(),
    data: { analysisStatus: 'COMPLETED', ...fields }
  });
  return { success: true, submissionId: ref.id };
}

/**
 * OIR (Phase: web OIR notification/persistence parity). Unlike every other type here, OIR's
 * result is fully known synchronously (`evaluateOIRSubmission` scores it server-side, same
 * anti-cheat authority `evaluateOIRAnswers` already uses -- a client-supplied score is never
 * trusted), so this writes a `SUBMITTED_PENDING_REVIEW` doc with the result already embedded,
 * matching KMP's `SubmitOIRTestUseCase.kt` (score first, persist once, no PENDING_ANALYSIS ->
 * COMPLETED transition to wait for). Its creation is what `onOirSubmissionCreated` fires
 * `notifyEvaluationComplete` from.
 *
 * `data`'s shape is intentionally a subset of KMP's `OIRSubmissionTestResultDto` -- only the
 * fields something actually reads today (`percentageScore`: `submissions.js`'s own
 * `checkInterviewPrerequisites` OIR gate, and the notification's `actionData`). Web has no OIR
 * result screen yet to render `categoryScores`/`answeredQuestions`/`grade`, and those aren't pure
 * passthroughs of `evaluateOIRSubmission`'s return shape -- computing them here would mean
 * re-deriving `OIRTestScoreCalculator.kt`'s categorization/grading logic a second time in JS, a
 * second copy to keep in sync for a shape nothing reads. Field names that ARE written match
 * KMP's exactly, so extending this later is additive, never a rename.
 */
async function createOIRSubmission(db, uid, { batchId, userAnswers, timeTakenSeconds }) {
  if (!batchId) {
    throw new functions.https.HttpsError('invalid-argument', 'batchId is required');
  }
  const result = await evaluateOIRSubmission(db, batchId, userAnswers || {});
  const totalQuestions = result.total;
  const correctAnswers = result.score;
  const skippedQuestions = totalQuestions - Object.keys(userAnswers || {}).length;
  const incorrectAnswers = totalQuestions - correctAnswers - skippedQuestions;
  const status = 'SUBMITTED_PENDING_REVIEW';
  const submittedAt = Date.now();

  const ref = await db.collection(FirestorePaths.SUBMISSIONS).add({
    userId: uid,
    testType: 'OIR',
    status,
    submittedAt,
    batchId,
    data: {
      testId: batchId,
      userId: uid,
      status,
      submittedAt,
      testResult: {
        testId: batchId,
        totalQuestions,
        correctAnswers,
        incorrectAnswers,
        skippedQuestions,
        rawScore: correctAnswers,
        percentageScore: result.percentage,
        timeTakenSeconds: timeTakenSeconds || 0,
        completedAt: submittedAt
      }
    }
  });
  return {
    success: true,
    submissionId: ref.id,
    score: correctAnswers,
    total: totalQuestions,
    percentage: result.percentage,
    oirRating: result.oirRating
  };
}

const runtimeOptions = { maxInstances: 10, timeoutSeconds: 60 };

exports.submitOIRTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { batchId, userAnswers, timeTakenSeconds } = requireObject(data, 'submission data');
  return createOIRSubmission(admin.firestore(), uid, { batchId, userAnswers, timeTakenSeconds });
});

exports.submitPIQTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const fields = requireObject(data, 'submission data');
  return createPIQSubmission(admin.firestore(), uid, fields);
});

exports.submitPPDTTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { questionId, batchId, story } = requireObject(data, 'submission data');
  if (!questionId || typeof story !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'questionId and story are required');
  }
  return createStandardSubmission(admin.firestore(), uid, 'PPDT', { questionId, batchId, story });
});

exports.submitTATTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { stories, batchId } = requireObject(data, 'submission data');
  if (!Array.isArray(stories) || stories.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'stories (non-empty array) is required');
  }
  return createStandardSubmission(admin.firestore(), uid, 'TAT', { stories, batchId });
});

exports.submitWATTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { responses } = requireObject(data, 'submission data');
  if (!Array.isArray(responses) || responses.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'responses (non-empty array) is required');
  }
  return createStandardSubmission(admin.firestore(), uid, 'WAT', { responses });
});

exports.submitSRTTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { responses } = requireObject(data, 'submission data');
  if (!Array.isArray(responses) || responses.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'responses (non-empty array) is required');
  }
  return createStandardSubmission(admin.firestore(), uid, 'SRT', { responses });
});

exports.submitSDTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { responses } = requireObject(data, 'submission data');
  if (!Array.isArray(responses) || responses.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'responses (non-empty array) is required');
  }
  return createStandardSubmission(admin.firestore(), uid, 'SD', { responses });
});

/**
 * Covers all 7 real gradeable GTO sub-types (`gtoType` = contract `TestType` id, e.g.
 * `GTO_GD`). Only GD/GPE/Lecturette have a matching `evaluateGTO` prompt path today
 * (`GTO_SUBTYPE_CONFIG` in `gtoEvaluate.js`) -- PGT/HGT/GOR/CT/IO submissions are still
 * created and stored (capture-UI groundwork, plan §C.4) but have no server evaluator
 * yet; calling `evaluateGTO` on one fails fast with `invalid-argument` there, by design.
 */
/** Top-level-`status` envelope (GTO's documented quirk, see class doc). */
async function createGTOSubmission(db, uid, gtoType, fields) {
  if (!GTO_TEST_TYPES.has(gtoType)) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown GTO type: ${gtoType}`);
  }
  const ref = await db.collection(FirestorePaths.SUBMISSIONS).add({
    userId: uid,
    testType: gtoType,
    status: 'PENDING_ANALYSIS',
    submittedAt: Date.now(),
    data: fields
  });
  return { success: true, submissionId: ref.id };
}

exports.submitGTOTest = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { gtoType, ...fields } = requireObject(data, 'submission data');
  return createGTOSubmission(admin.firestore(), uid, gtoType, fields);
});

/**
 * Interview stays per-response (plan-locked decision, Context §1) -- writes directly
 * to `interview_responses/{id}`, not `submissions/`. `sessionId` must already exist
 * (created by the interview-start flow); this callable does not create sessions.
 */
async function createInterviewResponse(db, uid, { sessionId, questionId, responseText, responseMode }) {
  const sessionSnap = await db.collection(FirestorePaths.INTERVIEW_SESSIONS).doc(sessionId).get();
  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Interview session ${sessionId} not found`);
  }
  if (sessionSnap.data().userId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Permission denied: ownership check failed');
  }

  await checkInterviewPrerequisites(db, uid);

  const ref = await db.collection(FirestorePaths.INTERVIEW_RESPONSES).add({
    userId: uid,
    sessionId,
    questionId,
    responseText,
    responseMode: responseMode || 'TEXT_BASED',
    submittedAt: Date.now(),
    olqScores: {}
  });
  return { success: true, responseId: ref.id };
}

exports.submitInterviewResponse = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { sessionId, questionId, responseText, responseMode } = requireObject(data, 'submission data');
  if (!sessionId || !questionId || typeof responseText !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'sessionId, questionId and responseText are required');
  }
  return createInterviewResponse(admin.firestore(), uid, { sessionId, questionId, responseText, responseMode });
});

exports.GTO_TEST_TYPES = GTO_TEST_TYPES;
exports.createStandardSubmission = createStandardSubmission;
exports.createPIQSubmission = createPIQSubmission;
exports.createGTOSubmission = createGTOSubmission;
exports.createOIRSubmission = createOIRSubmission;
exports.createInterviewResponse = createInterviewResponse;
exports.checkInterviewPrerequisites = checkInterviewPrerequisites;
