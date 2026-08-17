/**
 * Client-invoked counterpart to `onOirSubmissionCreated`/`evaluation/core.js`'s automatic
 * `notifyEvaluationComplete` calls, for the legacy client-side-graded paths that finish grading
 * entirely on-device and were never wired to either of those (e.g. TAT's `TATSynthesisWorker.kt`,
 * which keeps its own resilient WorkManager chain rather than delegating to the server -- see
 * `app/CLAUDE.md`'s note on process-death resilience). A client calls this itself, right after it
 * finalizes a submission's result locally, so it needs its own auth + ownership check -- unlike
 * `core.js`/`onOirSubmissionCreated`, which only ever run server-initiated against data the server
 * already trusts.
 *
 * Pinned to v1, matching every other callable in this codebase (`oirScoring.js`'s comment explains
 * why: bare `require('firebase-functions')` resolves to v2 by default on this project's installed
 * firebase-functions@7, which would silently make `context.auth` always undefined).
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { notifyEvaluationComplete, TEST_TYPE_LABELS } = require('./sendNotification');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Exported separately from the callable registration below so tests can call it directly with a
 * fake `firestoreDb`, the same "test the handler as a plain function" convention
 * `onOirSubmissionCreated.js`/`sendNotification.test.js` use.
 */
async function handleNotifyGradingComplete(data, context, { firestoreDb } = {}) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { submissionId } = data || {};
  if (!submissionId || typeof submissionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'submissionId is required');
  }

  const firestoreDbToUse = firestoreDb || db;
  const submissionDoc = await firestoreDbToUse.collection(FirestorePaths.SUBMISSIONS).doc(submissionId).get();
  if (!submissionDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Submission ${submissionId} not found`);
  }

  const submission = submissionDoc.data();
  if (submission.userId !== context.auth.uid) {
    // Never leak whether a submissionId belonging to someone else exists.
    throw new functions.https.HttpsError('not-found', `Submission ${submissionId} not found`);
  }
  if (!Object.prototype.hasOwnProperty.call(TEST_TYPE_LABELS, submission.testType)) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown testType '${submission.testType}'`);
  }

  return notifyEvaluationComplete({
    firestoreDb: firestoreDbToUse,
    userId: submission.userId,
    testType: submission.testType,
    submissionId
  });
}

exports.notifyGradingComplete = functions.https.onCall((data, context) =>
  handleNotifyGradingComplete(data, context)
);
exports.handleNotifyGradingComplete = handleNotifyGradingComplete;
