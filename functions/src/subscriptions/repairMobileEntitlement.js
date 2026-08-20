/**
 * Client-triggered mobile entitlement repair (Phase 7, Payment Ecosystem Hardening plan).
 *
 * Razorpay is cheaply enumerable server-side (`scheduledRazorpayDriftSweep.js`'s `GET
 * /v1/subscriptions?status=active`); RevenueCat has no equivalent cheap "all active subscribers"
 * endpoint. The RC SDK already hands every device authoritative `CustomerInfo` on launch, so the
 * device is the natural place to *detect* "I look active locally but the last entitlement refresh
 * still reads FREE" -- but per this phase's landmine note, the device is never trusted to say what
 * tier to grant. This callable re-reads the truth from RevenueCat's REST API server-side for
 * `context.auth.uid` (== the RC `app_user_id`, per H4's identity-linking guarantee) and writes
 * only what RevenueCat confirms.
 *
 * `data.claimedTier` (optional) is the client's own last-seen RC tier, used ONLY to detect and
 * alert on a claim RevenueCat doesn't back -- never to decide what gets written. Trusting it for
 * the write would reintroduce C1 (Phase 1) through the back door.
 */

// Same v1 pinning as every other callable in this plan -- see razorpaySubscriptions.js's
// identical comment.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { entitlementIdsToTier } = require('../revenueCatWebhook');
const { resolveSubscriptionDrift, DRIFT_ACTIONS, TIER_RANK } = require('../lib/subscriptionDrift');
const { emitOpsAlert, ALERT_KINDS, SEVERITIES } = require('../lib/opsAlert');
const { enforceEntitlementRepairRateLimit } = require('../lib/subscriptionRateLimit');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const runtimeOptions = {
  maxInstances: 10,
  secrets: ['REVENUECAT_SECRET_KEY']
};

/**
 * Calls RevenueCat's `GET /v1/subscribers/{app_user_id}` and reduces the response to the same
 * `{status, tier, expiryDate}` shape `resolveSubscriptionDrift` consumes. `entitlementIdsToTier`
 * is imported (not re-implemented) from `revenueCatWebhook.js` -- a second hand-typed copy of the
 * entitlement->tier mapping is exactly finding L4, already tracked as tech debt; this must not add
 * a third.
 */
async function fetchRevenueCatSubscriberState(fetchImpl, secretKey, appUserId, nowMillis = Date.now()) {
  const response = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  if (!response.ok) {
    throw new Error(`RevenueCat API error (HTTP ${response.status})`);
  }
  const payload = await response.json();
  const entitlements = payload?.subscriber?.entitlements || {};

  const activeEntries = Object.entries(entitlements).filter(([, e]) => {
    const expiresMs = e?.expires_date ? new Date(e.expires_date).getTime() : null;
    return expiresMs == null || expiresMs > nowMillis;
  });

  if (activeEntries.length === 0) {
    return { status: 'NONE', tier: 'FREE', expiryDate: null };
  }

  const activeIds = new Set(activeEntries.map(([id]) => id));
  const expiryCandidates = activeEntries.map(([, e]) => (e?.expires_date ? new Date(e.expires_date).getTime() : null));
  // A null expires_date on an active entitlement means "never expires" -- treat as furthest-out,
  // matching `revenueCatWebhook.js`'s existing null-means-no-expiry convention.
  const expiryDate = expiryCandidates.some((ms) => ms == null) ? null : Math.max(...expiryCandidates);

  return { status: 'ACTIVE', tier: entitlementIdsToTier(activeIds), expiryDate };
}

async function readStoredSubscription(transaction, subscriptionRef) {
  const doc = await transaction.get(subscriptionRef);
  const data = doc.exists ? doc.data() : {};
  return {
    tier: data.tier || 'FREE',
    expiryDate: data.expiryDate != null ? data.expiryDate : null,
    startDate: data.startDate || null
  };
}

/**
 * The repair decision + write, split out from the `onCall` wrapper so tests can inject a fake
 * `firestoreDb`/`fetchImpl` (this suite's established convention). Never trusts `claimedTier` for
 * the write -- see this file's doc comment.
 */
async function repairMobileEntitlementForUser(firestoreDb, fetchImpl, secretKey, userId, claimedTier = null) {
  let providerState;
  try {
    providerState = await fetchRevenueCatSubscriberState(fetchImpl, secretKey, userId);
  } catch (fetchError) {
    console.error('repairMobileEntitlement: RevenueCat API call failed, rejecting (fail-closed)', fetchError);
    throw new functions.https.HttpsError('internal', 'Unable to verify RevenueCat entitlement, please try again');
  }

  const subscriptionRef = firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

  // The C1-regression guard: a client claiming more than RevenueCat actually confirms is either a
  // stale local cache or an attempt to game this endpoint -- either way, no write happens beyond
  // what `providerState` (the verified truth) justifies, and this gets its own distinct alert so
  // it's never confused with an ordinary "nothing to repair" call.
  if (
    claimedTier != null &&
    claimedTier !== 'FREE' &&
    (providerState.status !== 'ACTIVE' || (TIER_RANK[providerState.tier] ?? 0) < (TIER_RANK[claimedTier] ?? 0))
  ) {
    await emitOpsAlert(firestoreDb, {
      kind: ALERT_KINDS.DRIFT_REPAIR_REJECTED,
      severity: SEVERITIES.HIGH,
      userId,
      detail: { claimedTier, providerStatus: providerState.status, providerTier: providerState.tier }
    });
    throw new functions.https.HttpsError(
      'failed-precondition',
      'RevenueCat does not confirm the claimed entitlement'
    );
  }

  return firestoreDb.runTransaction(async (transaction) => {
    const stored = await readStoredSubscription(transaction, subscriptionRef);
    const drift = resolveSubscriptionDrift(providerState, stored, Date.now());

    if (drift.action === DRIFT_ACTIONS.REPAIR_UP) {
      transaction.set(
        subscriptionRef,
        {
          tier: drift.tier,
          startDate: stored.startDate || Date.now(),
          expiryDate: drift.expiryDate,
          billingCycle: 'MONTHLY',
          source: 'REVENUECAT',
          willRenew: true,
          billingIssueAt: null
        },
        { merge: true }
      );
      await emitOpsAlert(firestoreDb, {
        kind: ALERT_KINDS.DRIFT_REPAIR,
        severity: SEVERITIES.INFO,
        userId,
        detail: { repairedTier: drift.tier, expiryDate: drift.expiryDate, storedTier: stored.tier }
      });
      return { repaired: true, tier: drift.tier };
    }

    if (drift.action === DRIFT_ACTIONS.FLAG_CONFLICT) {
      await emitOpsAlert(firestoreDb, {
        kind: ALERT_KINDS.DRIFT_CONFLICT,
        severity: SEVERITIES.HIGH,
        userId,
        detail: { providerTier: providerState.tier, storedTier: stored.tier }
      });
      return { repaired: false, conflict: true };
    }

    return { repaired: false };
  });
}

exports.repairMobileEntitlement = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to repair entitlement');
  }

  const userId = context.auth.uid;
  await enforceEntitlementRepairRateLimit(db, userId);

  const secretKey = process.env.REVENUECAT_SECRET_KEY;
  if (!secretKey) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      // No live RevenueCat credentials locally -- report nothing to repair rather than silently
      // granting anything (same fail-closed-by-default stance as production's missing-secret
      // branch below, just without the hard error so local dev of the calling flow isn't blocked).
      return { repaired: false };
    }
    throw new functions.https.HttpsError('failed-precondition', 'RevenueCat credentials are missing in production environment');
  }

  const claimedTier = typeof data?.claimedTier === 'string' ? data.claimedTier : null;
  return repairMobileEntitlementForUser(db, fetch, secretKey, userId, claimedTier);
});

exports.repairMobileEntitlementForUser = repairMobileEntitlementForUser;
exports.fetchRevenueCatSubscriberState = fetchRevenueCatSubscriberState;
