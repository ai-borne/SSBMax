/**
 * Server-Side Eligibility Enforcement (Phase 5, docs/plans/CrossPlatform_SSOT)
 *
 * The `recordTestUsage` callable is the sole authority on incrementing a user's
 * monthly per-bucket test counters and on refusing a submission that would
 * exceed the tier's quota. Clients (KMP + web) keep their existing optimistic
 * read of `SubscriptionLimits`/`SubscriptionUsageDto` for instant UX, but this
 * function is the real gate at submission time -- firestore.rules denies direct
 * client writes to `users/{uid}/subscription/usage_{month}` entirely, so the
 * Admin SDK write below (which bypasses rules) is the only path left.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FirestorePaths, SubscriptionLimits, Enums } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * `true` unless explicitly disabled -- see rollback plan in the Phase 5 handoff.
 * Read live (not cached at module load) so tests can flip it per-case and so an
 * operator can update it via `firebase functions:config` without a redeploy of
 * this constant's capture semantics surprising them.
 */
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

/** Server owns the month boundary -- UTC, so it can't be skewed by device timezone. */
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
  // Fail closed to FREE on any missing/malformed doc -- matches
  // GitLiveSubscriptionRepository/web SubscriptionRepository's existing read-side contract.
  const tier = doc.exists ? doc.data().tier : 'FREE';
  return Enums.SubscriptionTier.includes(tier) ? tier : 'FREE';
}

/**
 * Atomically checks quota and increments the usage counter for one test attempt.
 * Idempotent by `submissionId`: charging the same submission twice increments
 * the counter once (`recordedSubmissionIds` dedupes within the transaction).
 *
 * Takes `firestoreDb` explicitly (same pattern as oirScoring.js's
 * evaluateOIRSubmission) so tests can pass a fake without touching the real
 * Admin SDK.
 */
async function recordAndEnforce(firestoreDb, userId, testType, submissionId) {
  const bucket = bucketFor(testType);
  const fieldName = fieldNameFor(bucket.bucket);
  const month = currentYearMonth();
  const tier = await readTier(firestoreDb, userId);
  const limit = limitFor(bucket, tier);

  const docRef = firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION)
    .doc(`usage_${month}`);

  return firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const existing = snapshot.exists ? snapshot.data() : {};
    const recordedSubmissionIds = existing.recordedSubmissionIds || [];

    if (submissionId && recordedSubmissionIds.includes(submissionId)) {
      return { success: true, alreadyRecorded: true, used: existing[fieldName] || 0, limit };
    }

    const currentUsed = existing[fieldName] || 0;
    if (limit !== -1 && currentUsed >= limit) {
      if (enforceQuota()) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Monthly quota reached for ${bucket.bucket} (${currentUsed}/${limit})`
        );
      }
      console.warn(`[ENFORCE_QUOTA=false] Would have blocked ${userId}/${bucket.bucket} at ${currentUsed}/${limit}`);
    }

    const newUsed = currentUsed + 1;
    const newRecordedIds = submissionId ? [...recordedSubmissionIds, submissionId] : recordedSubmissionIds;

    tx.set(
      docRef,
      {
        userId,
        month,
        ...existing,
        [fieldName]: newUsed,
        recordedSubmissionIds: newRecordedIds,
        lastUpdated: Date.now()
      },
      { merge: true }
    );

    return { success: true, alreadyRecorded: false, used: newUsed, limit };
  });
}

exports.recordTestUsage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to record test usage');
  }

  const { testType, submissionId } = data || {};
  if (!testType || typeof testType !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'testType is required');
  }
  if (!Enums.TestType.includes(testType)) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown testType: ${testType}`);
  }

  try {
    return await recordAndEnforce(db, context.auth.uid, testType, submissionId || null);
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('Error recording test usage:', error);
    throw new functions.https.HttpsError('internal', `Recording failed: ${error.message}`);
  }
});

exports.bucketFor = bucketFor;
exports.fieldNameFor = fieldNameFor;
exports.limitFor = limitFor;
exports.recordAndEnforce = recordAndEnforce;
