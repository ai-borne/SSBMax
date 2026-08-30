/**
 * Per-user hourly rate limiting for subscription-lifecycle callables (create, Phase 5's cancel).
 * Extracted out of `razorpaySubscriptions.js` when adding cancel pushed that file over the 300-LOC
 * cap (root CLAUDE.md Quality Limits) -- shared here so create/cancel don't hand-roll two copies
 * of the same hour-bucket counter.
 */

const functions = require('firebase-functions/v1');
const { FirestorePaths } = require('../generated/contracts.cjs');

// Per-user rate limit on subscription-creation attempts (scale-hardening follow-up to the
// Dual-Platform Subscription Billing Hardening plan). The blanket `maxInstances: 10` on the
// callables' `runtimeOptions` caps total concurrency across ALL users -- without a per-user limit,
// a promo-driven burst or a scripted/compromised client hammering the endpoint can monopolize that
// shared pool, and legitimate purchasers get backpressure failures indistinguishable from abuse.
// Mirrors geminiProxy.js's `enforceRateLimit` shape (atomic transaction-based hour-bucket
// counter). A real purchase/cancel flow needs at most a couple of attempts (initial + retry after
// a transient failure); 5/hour is generous headroom above that while still capping one account's
// share of the instance pool.
const HOURLY_SUBSCRIPTION_CREATE_LIMIT = 5;
// Phase 5 (H5a): same abuse-control shape and sizing as create, for the same reason.
const HOURLY_SUBSCRIPTION_CANCEL_LIMIT = 5;
// Phase 7: `repairMobileEntitlement` makes a real RevenueCat REST call per attempt (unlike a plain
// eligibility read) -- capped like create/cancel so a client can't hammer this into a RevenueCat
// API-cost/rate-limit problem. A legitimate repair needs at most one or two attempts (the device
// only calls this when it observes local drift, not on every launch).
const HOURLY_ENTITLEMENT_REPAIR_LIMIT = 5;

/** Server owns the hour boundary -- UTC, matches geminiProxy.js's currentHourKey() convention. */
function currentHourKey() {
  const now = new Date();
  return (
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`
  );
}

/**
 * Atomically checks and increments a per-user hourly action counter. Reuses the existing
 * USER_SUBSCRIPTION_SUBCOLLECTION ("subscription") rather than a new FirestorePaths entry, same
 * precedent as geminiProxy.js's `ai_usage_{hourKey}` doc alongside eligibility.js's `usage_{month}`
 * docs in the same subcollection. `docKeyPrefix` namespaces create vs. cancel counters so a burst
 * of one doesn't consume the other's budget.
 */
async function enforceHourlyActionRateLimit(firestoreDb, userId, docKeyPrefix, limit, actionLabel) {
  const hourKey = currentHourKey();
  const docRef = firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION)
    .doc(`${docKeyPrefix}_${hourKey}`);

  return firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const currentCount = snapshot.exists ? snapshot.data().count || 0 : 0;
    if (currentCount >= limit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Too many ${actionLabel} attempts (${currentCount}/${limit} this hour) -- please try again later`
      );
    }
    tx.set(docRef, { count: currentCount + 1, lastUpdated: Date.now() }, { merge: true });
    return currentCount + 1;
  });
}

async function enforceSubscriptionCreationRateLimit(firestoreDb, userId) {
  return enforceHourlyActionRateLimit(
    firestoreDb,
    userId,
    'subscription_create_usage',
    HOURLY_SUBSCRIPTION_CREATE_LIMIT,
    'subscription creation'
  );
}

async function enforceSubscriptionCancelRateLimit(firestoreDb, userId) {
  return enforceHourlyActionRateLimit(
    firestoreDb,
    userId,
    'subscription_cancel_usage',
    HOURLY_SUBSCRIPTION_CANCEL_LIMIT,
    'subscription cancellation'
  );
}

async function enforceEntitlementRepairRateLimit(firestoreDb, userId) {
  return enforceHourlyActionRateLimit(
    firestoreDb,
    userId,
    'entitlement_repair_usage',
    HOURLY_ENTITLEMENT_REPAIR_LIMIT,
    'entitlement repair'
  );
}

module.exports = {
  HOURLY_SUBSCRIPTION_CREATE_LIMIT,
  HOURLY_SUBSCRIPTION_CANCEL_LIMIT,
  HOURLY_ENTITLEMENT_REPAIR_LIMIT,
  enforceSubscriptionCreationRateLimit,
  enforceSubscriptionCancelRateLimit,
  enforceEntitlementRepairRateLimit
};
