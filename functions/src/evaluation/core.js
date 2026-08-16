/**
 * Tier-2 evaluation dispatcher (Phase 1, Web SSB Test Flow Parity plan).
 *
 * `runEvaluation` owns every cross-cutting concern once -- ownership check,
 * status guard, server-side quota re-check, ANALYZING/COMPLETED/FAILED status
 * flips, retry-wrapped Gemini call, result-doc write -- so a per-type callable
 * (Phase 4+) only has to supply its prompt builder and parser. Mirrors the
 * call order of `PsychAnalysisOrchestrators.kt`'s `runPsychAnalysis`.
 *
 * All dependencies (`firestoreDb`, `generateContent`) are injected params,
 * never module-level singletons -- required by this codebase's fake-db test
 * pattern (see `eligibility.test.js`/`oirScoring.test.js`) and so later
 * per-type wrapper tests can reuse the same fake without touching the real
 * Admin SDK or a live Gemini key.
 *
 * No callable wrapper and no `index.js` export here -- nothing calls this yet
 * (Phase 1 scope is scaffolding only, wired up starting Phase 4).
 *
 * **Phase 4 fix:** the real "submissions" document envelope every
 * `GitLive*SubmissionRepository` writes (`SubmissionDocDto` in
 * `data-firebase/.../SubmissionSharedMappers.kt`) nests `analysisStatus`
 * under `data.analysisStatus`, not at the document's top level -- only
 * `userId`/`testType`/`submittedAt` are top-level. This module's status
 * guard/flip logic originally assumed a flat `submission.analysisStatus`
 * (untested against the real shape, since Phase 1 had no real caller yet).
 * Fixed here, as the first real caller (`watEvaluate.js`) surfaced it.
 */

const functions = require('firebase-functions');
const { FirestorePaths, SubscriptionLimits, Enums } = require('../generated/contracts.cjs');
const { withRetry } = require('./retry');
const { recordAndEnforce } = require('../eligibility');

function enforceQuota() {
  return process.env.ENFORCE_QUOTA !== 'false';
}

function bucketFor(testType) {
  const entry = SubscriptionLimits.find((l) => l.testTypes.includes(testType));
  if (!entry) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown testType: ${testType}`);
  }
  return entry;
}

function fieldNameFor(bucket) {
  return `${bucket.toLowerCase()}TestsUsed`;
}

function limitFor(bucketEntry, tier) {
  const key = String(tier || 'FREE').toLowerCase();
  return bucketEntry[key] ?? 0;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function readTier(firestoreDb, userId) {
  const doc = await firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
    .get();
  const tier = doc.exists ? doc.data().tier : 'FREE';
  return Enums.SubscriptionTier.includes(tier) ? tier : 'FREE';
}

/**
 * Read-only quota re-check -- submission-time usage recording already happened
 * (`eligibility.js::recordAndEnforce`); this only guards against a client
 * calling an `evaluate*` callable directly to get a free Gemini call outside
 * that flow. Rejects `FAILED_PRECONDITION` if the current month's usage for
 * this test's bucket is already at/over the tier's limit.
 */
async function checkQuota(firestoreDb, uid, testType) {
  const bucket = bucketFor(testType);
  const tier = await readTier(firestoreDb, uid);
  const limit = limitFor(bucket, tier);
  if (limit === -1) return;

  const fieldName = fieldNameFor(bucket.bucket);
  const month = currentYearMonth();
  const usageDoc = await firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(uid)
    .collection(FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION)
    .doc(`usage_${month}`)
    .get();
  const used = usageDoc.exists ? usageDoc.data()[fieldName] || 0 : 0;

  if (used >= limit) {
    if (enforceQuota()) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Monthly quota reached for ${bucket.bucket} (${used}/${limit})`
      );
    }
    console.warn(`[ENFORCE_QUOTA=false] Would have blocked evaluation for ${uid}/${bucket.bucket} at ${used}/${limit}`);
  }
}

/**
 * @param firestoreDb injected Firestore (real `admin.firestore()` or a test fake)
 * @param generateContent async (prompt) => rawResponseText -- injected Gemini call
 * @param uid authenticated caller's uid
 * @param submissionId `submissions/{submissionId}` doc to evaluate
 * @param testType contract `TestType` id, used for the quota bucket lookup
 * @param buildPrompt (submission) => prompt string
 * @param parseAndValidate (rawResponseText) => result object to persist, or throws/returns
 *   null/undefined if the response isn't acceptable (triggers a retry)
 * @param resultCollection Firestore collection name to write the accepted result into
 * @param retryDelayFn optional override for `withRetry`'s backoff sleep (tests inject a
 *   no-op to skip real timers; production omits it and gets the real jittered delay)
 */
async function runEvaluation({ firestoreDb, generateContent, uid, submissionId, testType, buildPrompt, parseAndValidate, resultCollection, retryDelayFn }) {
  const submissionRef = firestoreDb.collection(FirestorePaths.SUBMISSIONS).doc(submissionId);
  const snapshot = await submissionRef.get();
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', `Submission ${submissionId} not found`);
  }
  const submission = snapshot.data();

  if (submission.userId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Permission denied: ownership check failed');
  }

  const currentStatus = submission.data ? submission.data.analysisStatus : submission.analysisStatus;
  if (currentStatus !== 'PENDING_ANALYSIS') {
    return { success: true, skipped: true, status: currentStatus };
  }

  await checkQuota(firestoreDb, uid, testType);

  await submissionRef.update({ 'data.analysisStatus': 'ANALYZING' });

  const result = await withRetry({
    call: async () => parseAndValidate(await generateContent(buildPrompt(submission))),
    isAcceptable: (r) => r !== null && r !== undefined,
    fillDefaults: (r) => r,
    ...(retryDelayFn ? { delayFn: retryDelayFn } : {})
  });

  if (result === null || result === undefined) {
    await submissionRef.update({ 'data.analysisStatus': 'FAILED' });
    return { success: false, submissionId, status: 'FAILED' };
  }

  await firestoreDb
    .collection(resultCollection)
    .doc(submissionId)
    .set({ submissionId, testType, ...result, analyzedAt: Date.now(), userId: submission.userId });
  await submissionRef.update({ 'data.analysisStatus': 'COMPLETED' });

  // Charge quota here, not left to a separate client-invoked `recordTestUsage` call --
  // a client that simply never calls it would otherwise get unlimited attempts, since
  // `checkQuota` above only re-reads an already-incremented counter. Idempotent by
  // submissionId, so re-running a COMPLETED submission's evaluation never double-charges.
  await recordAndEnforce(firestoreDb, uid, testType, submissionId);

  return { success: true, submissionId, status: 'COMPLETED' };
}

module.exports = {
  runEvaluation,
  checkQuota,
  bucketFor,
  fieldNameFor,
  limitFor,
  readTier,
  currentYearMonth
};
