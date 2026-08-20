/**
 * `completeInterviewSession` Cloud Function -- Interview server-migration plan, Phase 2.
 *
 * The same PERMISSION_DENIED gap `createInterviewSession.js` fixes also applies to
 * `interview_results` (`firestore.rules`: `allow write: if false`): the pre-existing
 * `GitLiveInterviewRepository.completeInterview()` aggregated the result client-side and
 * wrote it directly to Firestore. This callable is the real write path now, using
 * `aggregateInterviewResult.js` (a JS port of `InterviewResultAggregation.kt`).
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { aggregateInterviewResult } = require('./aggregateInterviewResult');

if (!admin.apps.length) {
  admin.initializeApp();
}

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60
};

async function completeInterviewSessionCore(db, uid, sessionId, deps = {}) {
  const newIdFn = deps.newIdFn || (() => crypto.randomUUID());

  const sessionRef = db.collection(FirestorePaths.INTERVIEW_SESSIONS).doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Session ${sessionId} not found`);
  }
  const session = sessionSnap.data();
  if (session.userId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Permission denied: ownership check failed');
  }

  if (session.status === 'COMPLETED') {
    // Idempotent -- a retried call after the session is already complete returns the
    // existing result instead of re-aggregating (which would mint a second result id
    // and a second progress-feed submission for the same interview).
    const existing = await db.collection(FirestorePaths.INTERVIEW_RESULTS).where('sessionId', '==', sessionId).limit(1).get();
    if (!existing.empty) {
      return { result: existing.docs[0].data(), alreadyCompleted: true };
    }
  }

  const responsesSnap = await db.collection(FirestorePaths.INTERVIEW_RESPONSES).where('sessionId', '==', sessionId).where('userId', '==', uid).get();
  const responses = responsesSnap.docs.map((d) => d.data());

  const resultId = newIdFn();
  const result = aggregateInterviewResult({ ...session, id: sessionId }, responses, resultId);

  const submissionId = `interview_${result.id}`;
  const submission = {
    id: submissionId,
    userId: session.userId,
    testId: sessionId,
    testType: 'IO',
    status: 'COMPLETED',
    submittedAt: result.completedAt,
    score: (10 - result.overallRating) * 10,
    resultId: result.id,
    mode: result.mode
  };

  await Promise.all([
    db.collection(FirestorePaths.INTERVIEW_RESULTS).doc(result.id).set(result),
    sessionRef.set({ ...session, status: 'COMPLETED', completedAt: result.completedAt }, { merge: true }),
    db.collection(FirestorePaths.SUBMISSIONS).doc(submissionId).set(submission)
  ]);

  return { result, alreadyCompleted: false };
}

exports.completeInterviewSession = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const { sessionId } = data || {};
  if (!sessionId || typeof sessionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'sessionId is required');
  }
  const { result } = await completeInterviewSessionCore(admin.firestore(), context.auth.uid, sessionId);
  return { result };
});

exports.completeInterviewSessionCore = completeInterviewSessionCore;
