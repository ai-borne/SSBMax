/**
 * `createInterviewSession` Cloud Function -- Interview server-migration plan, Phase 1.
 *
 * Moves session/question creation server-side: `firestore.rules` marks `interview_sessions`/
 * `interview_questions` server-only (`allow write: if false`), but the pre-existing
 * `GitLiveInterviewRepository.createSession()` generated questions client-side and wrote
 * them directly to Firestore -- always PERMISSION_DENIED. This callable is the real write
 * path now; the KMP client only invokes it (see `GitLiveEvaluationFunctionsClient.kt`).
 *
 * Quota is charged here (not just re-checked) via `recordAndEnforce`, keyed by the new
 * session's id -- same idempotency-by-key shape `evaluateInterviewResponse` uses keyed by
 * sessionId, so a retried call after a session already exists doesn't double-charge.
 *
 * `piqContext` is resolved server-side from `piqSnapshotId` (fetches `submissions/{id}` itself
 * and runs it through `piqContextBuilder.js`, a port of `PIQContextBuilder.kt`) rather than
 * trusting a client-supplied context string -- closes the gap where the initial version of this
 * function took `piqContext` directly in the request payload.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { recordAndEnforce } = require('../eligibility');
const { generateQuestions } = require('./generateQuestions');
const { buildComprehensivePIQContext, ERROR_SENTINEL } = require('./piqContextBuilder');

if (!admin.apps.length) {
  admin.initializeApp();
}

const TARGET_TOTAL_QUESTIONS = 25;
const DEFAULT_DURATION_MINUTES = 30;
const INTERVIEW_TEST_TYPE = 'IO';
const VALID_MODES = ['VOICE_BASED', 'TEXT_BASED'];

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 120,
  secrets: ['GEMINI_API_KEY']
};

/**
 * Fetches the candidate's own `submissions/{piqSnapshotId}` doc and builds the Gemini-ready
 * PIQ text context server-side. Returns `''` (not an error) when the submission is missing or
 * doesn't belong to `uid`, or when `buildComprehensivePIQContext` hits its own error sentinel --
 * `generateQuestions` treats an empty context as "no AI context available" and falls through to
 * its static-fallback tier, matching `InterviewQuestionGenerator.buildPiqContext`'s
 * null-on-failure behavior.
 */
async function resolvePiqContext(db, uid, piqSnapshotId) {
  const snap = await db.collection(FirestorePaths.SUBMISSIONS).doc(piqSnapshotId).get();
  if (!snap.exists) return '';
  const submission = snap.data();
  if (submission.userId !== uid) return '';

  const context = buildComprehensivePIQContext(submission);
  return context === ERROR_SENTINEL ? '' : context;
}

/**
 * Injectable core -- `newIdFn`/question-generation deps default to real implementations but
 * are overridable so tests can exercise the full flow deterministically (matches
 * `interviewEvaluate.js`'s `evaluateInterviewResponseCore` injectable style).
 */
async function createInterviewSessionCore(db, uid, { mode, piqSnapshotId, consentGiven }, deps = {}) {
  if (!piqSnapshotId || typeof piqSnapshotId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'piqSnapshotId is required');
  }
  if (!VALID_MODES.includes(mode)) {
    throw new functions.https.HttpsError('invalid-argument', `mode must be one of ${VALID_MODES.join(', ')}`);
  }

  const newIdFn = deps.newIdFn || (() => crypto.randomUUID());
  const sessionId = newIdFn();

  // Charge/enforce quota before spending any Gemini cost, keyed by the session id
  // being created -- idempotent if this call is retried after already succeeding.
  await recordAndEnforce(db, uid, INTERVIEW_TEST_TYPE, sessionId);

  const resolvePiqContextFn = deps.resolvePiqContextFn || resolvePiqContext;
  const piqContext = await resolvePiqContextFn(db, uid, piqSnapshotId);

  const questions = await generateQuestions(db, piqSnapshotId, TARGET_TOTAL_QUESTIONS, piqContext, deps);

  const now = Date.now();
  const session = {
    id: sessionId,
    userId: uid,
    mode,
    status: 'IN_PROGRESS',
    startedAt: now,
    completedAt: null,
    piqSnapshotId,
    consentGiven: consentGiven === true,
    questionIds: questions.map((q) => q.id),
    currentQuestionIndex: 0,
    estimatedDuration: DEFAULT_DURATION_MINUTES
  };

  // Sequential per-doc writes (not a batch) -- quota is already charged and this Cloud
  // Function is safe to retry (sessionId is fixed per call), so batch atomicity buys
  // little here versus the added test/fake-db complexity of emulating `db.batch()`.
  await Promise.all([
    ...questions.map((q) => db.collection(FirestorePaths.INTERVIEW_QUESTIONS).doc(q.id).set(q)),
    db.collection(FirestorePaths.INTERVIEW_SESSIONS).doc(sessionId).set(session)
  ]);

  return { session, questions };
}

exports.createInterviewSession = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const { mode, piqSnapshotId, consentGiven } = data || {};
  const { session } = await createInterviewSessionCore(admin.firestore(), context.auth.uid, {
    mode,
    piqSnapshotId,
    consentGiven
  });
  return { session };
});

exports.createInterviewSessionCore = createInterviewSessionCore;
exports.resolvePiqContext = resolvePiqContext;
exports.TARGET_TOTAL_QUESTIONS = TARGET_TOTAL_QUESTIONS;
