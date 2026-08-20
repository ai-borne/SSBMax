/**
 * OIR is the one test type whose result is already fully known (server-authoritative-scored via
 * `oirScoring.js::evaluateOIRAnswers`) by the time its `submissions/{id}` doc is written -- unlike
 * WAT/SRT/SD/PPDT/TAT/GTO/Interview, which create their submission doc first and grade later via
 * `evaluation/core.js::runEvaluation` (which calls `notifyEvaluationComplete` itself once grading
 * finishes). `evaluateOIRAnswers` runs *before* any submission id exists (KMP mints it and writes
 * the doc only after scoring -- see `SubmitOIRTestUseCase.kt`), so it has nothing to notify against
 * and never calls `notifyEvaluationComplete`. This trigger closes that gap the same way every other
 * test type gets notified, just on doc-creation instead of a later grading-complete transition,
 * since for OIR those are the same moment.
 *
 * Pinned to v1 (`functions.firestore.document(...).onCreate`), matching every other function in
 * this codebase (`oirScoring.js`, `payments.js`, `webhooks.js` are all v1 or v1-resolving) -- no v2
 * trigger precedent exists here, and mixing styles for one function only adds a second API shape to
 * remember for no benefit (the v1-vs-v2 `context.auth` concern that forces v1 elsewhere doesn't
 * apply to Firestore triggers, which have no auth context at all).
 */
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { notifyEvaluationComplete } = require('./sendNotification');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Exported separately from the trigger registration below so tests can call it directly against a
 * hand-built fake `snap`, without spinning up `firebase-functions-test`'s emulated trigger harness
 * (no existing precedent for that in this codebase -- see `functions/test/sendNotification.test.js`
 * for the same "test the handler as a plain function" convention `evaluationCore.test.js` also uses).
 */
async function handleOirSubmissionCreated(snap, { firestoreDb, messaging } = {}) {
  const data = snap.data();
  if (!data || data.testType !== 'OIR') {
    return null;
  }

  return notifyEvaluationComplete({
    firestoreDb: firestoreDb || admin.firestore(),
    userId: data.userId,
    testType: 'OIR',
    submissionId: snap.id,
    messaging: messaging || admin.messaging()
  });
}

const onOirSubmissionCreated = functions.firestore
  .document('submissions/{submissionId}')
  .onCreate((snap) => handleOirSubmissionCreated(snap));

module.exports = { onOirSubmissionCreated, handleOirSubmissionCreated };
