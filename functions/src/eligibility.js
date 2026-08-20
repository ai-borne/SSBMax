/**
 * Server-Side Eligibility Enforcement (Phase 5, docs/plans/CrossPlatform_SSOT)
 *
 * The `recordTestUsage` callable is the sole authority on incrementing a user's
 * monthly per-bucket test counters and on refusing a submission that would
 * exceed the tier's quota. Clients (KMP + web) keep their existing optimistic
 * read of `SubscriptionLimits`/`SubscriptionUsageDto` for instant UX, but this
 * function is the real gate at submission time -- firestore.rules denies direct
 * client writes to `users/{uid}/subscription/usage_{period}` entirely, so the
 * Admin SDK write below (which bypasses rules) is the only path left.
 *
 * Phase 3 (`docs/plans/SubscriptionPricingRestructure.md` step 5): the usage doc's period key
 * is no longer always the global calendar month -- a paid tier with a known `startDate` resets
 * on that day-of-month instead (`usage_2026-08-25`, not `usage_2026-08`). See [currentPeriodKey].
 */

// Pinned to v1: the handler below uses the v1 two-arg `(data, context)` onCall signature
// (`context.auth`). Bare `require('firebase-functions')` on this project's installed
// firebase-functions@7 resolves `.https.onCall` to the v2 API by default, which invokes
// handlers as `(request, responseProxy)` instead -- silently making `context.auth` always
// undefined and this function always reject as unauthenticated, regardless of the caller's
// real auth state. Matches `submissions.js`'s explicit v1 import for the same reason.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths, SubscriptionLimits, Enums } = require('./generated/contracts.cjs');
const { deriveEffectiveTier } = require('./lib/effectiveTier');

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

/**
 * `true` unless explicitly disabled -- Phase 3 (`docs/plans/SubscriptionPricingRestructure.md`
 * step 5) kill switch for the billing-anniversary reset, same live-read-not-cached pattern as
 * [enforceQuota]. Flagged in the plan as "the riskiest single change" -- three platforms must
 * compute an identical period key -- so this exists purely as a rollback lever; setting it to
 * 'false' reverts every user (paid or not) back to the legacy global calendar-month key without
 * a redeploy.
 */
function enforceAnniversaryReset() {
  return process.env.ENFORCE_ANNIVERSARY_RESET !== 'false';
}

function daysInMonth(year, month) {
  // Date.UTC's day-of-month is 1-indexed; day 0 of `month` is the last day of `month - 1`,
  // i.e. the last day of `month` (still 1-indexed here) itself.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Billing-anniversary period key -- paid tiers with a known `startDate` reset on that
 * day-of-month (clamped for short months, e.g. a Jan 31 start resets on Feb 28/29) instead of
 * the legacy global calendar-month key. FREE tier (no purchase, no `startDate`) and the
 * `ENFORCE_ANNIVERSARY_RESET=false` kill switch both fall back to [currentYearMonth]. Must stay
 * byte-for-byte identical to `CheckTestEligibilityUseCase.kt`'s `currentPeriodKey` and web's
 * `subscriptionEligibility.ts`'s `currentPeriodKey` -- all three compute in UTC for exactly this
 * reason.
 */
function currentPeriodKey(tier, startDate) {
  if (tier === 'FREE' || !startDate || !enforceAnniversaryReset()) {
    return currentYearMonth();
  }
  const now = new Date();
  const start = new Date(startDate);
  const anchorDay = start.getUTCDate();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  let clampedDay = Math.min(anchorDay, daysInMonth(year, month));
  if (now.getUTCDate() < clampedDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    clampedDay = Math.min(anchorDay, daysInMonth(year, month));
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
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

/**
 * Reads `tier`, `startDate` (Phase 3) and `expiryDate` (H1) off the same doc in one read --
 * `startDate` drives [currentPeriodKey], `expiryDate` drives [deriveEffectiveTier]. The returned
 * `tier` is already the *effective* tier -- a stored `PREMIUM` past its `expiryDate` reads as
 * `FREE` here, matching KMP's `GitLiveSubscriptionRepository`/web's `SubscriptionRepository.ts`
 * read-side contract, so this, "the real gate at submission time" per this file's own header
 * comment, can no longer be tricked by a stale-but-unreconciled doc into honoring a lapsed
 * subscription. Fails closed to `{ tier: 'FREE', startDate: null }` on any missing/malformed doc.
 */
async function readSubscriptionDoc(firestoreDb, userId) {
  const doc = await firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
    .get();
  if (!doc.exists) {
    return { tier: 'FREE', startDate: null };
  }
  const data = doc.data();
  const storedTier = Enums.SubscriptionTier.includes(data.tier) ? data.tier : 'FREE';
  const startDate = typeof data.startDate === 'number' && data.startDate > 0 ? data.startDate : null;
  const expiryDate = typeof data.expiryDate === 'number' ? data.expiryDate : null;
  const tier = deriveEffectiveTier(storedTier, expiryDate, Date.now());
  return { tier, startDate };
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
  const { tier, startDate } = await readSubscriptionDoc(firestoreDb, userId);
  const period = currentPeriodKey(tier, startDate);
  const limit = limitFor(bucket, tier);

  const docRef = firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION)
    .doc(`usage_${period}`);

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
        month: period,
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
exports.currentYearMonth = currentYearMonth;
exports.currentPeriodKey = currentPeriodKey;
exports.daysInMonth = daysInMonth;
exports.readSubscriptionDoc = readSubscriptionDoc;
exports.recordAndEnforce = recordAndEnforce;
