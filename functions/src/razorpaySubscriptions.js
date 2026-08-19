/**
 * Razorpay Subscriptions API — subscription creation (Phase B, Razorpay Subscriptions API
 * migration -- see `docs/plans` "SSBMax: Dual-Platform Subscription Billing Hardening").
 *
 * `payments.js`'s `createRazorpayOrder` creates a one-time `Order` -- no recurring billing, no
 * `current_end` for `webhooks.js` to derive `expiryDate` from. This callable creates a real
 * Razorpay `Subscription` instead, whose lifecycle webhooks (`subscription.activated`/`charged`/
 * `completed`/`cancelled`/`halted`/`paused`/`resumed`, handled in `webhooks.js`) keep
 * `expiryDate`/`willRenew` current the same way RevenueCat does for mobile.
 *
 * `createRazorpayOrder` stays deployed (deprecated-but-live) until this path is verified --
 * see this file's plan doc, senior-review fix #8 (checkout cutover is a feature-flagged,
 * atomic client-side switch, not a rip-and-replace).
 */

// Pinned to v1, same reason as `payments.js`'s identical comment: this handler uses the v1
// two-arg `(data, context)` onCall signature (`context.auth`), and bare `require('firebase-functions')`
// resolves to v2 by default on this project's installed firebase-functions@7.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths, PricingTiers } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** Only `{tier}_monthly` planIds exist (monthly billing only, for now) -- same set `payments.js`
 * validates client-supplied planIds against. */
const VALID_PLAN_IDS = new Set(
  PricingTiers.filter((t) => t.tier !== 'FREE').map(({ tier }) => `${tier.toLowerCase()}_monthly`)
);

// Same DoW-defense shape as `payments.js`'s `runtimeOptions`. `RAZORPAY_PLAN_IDS` is a new
// Secret-Manager-backed JSON secret (`firebase functions:secrets:set RAZORPAY_PLAN_IDS`), value
// `{"basic_monthly":"plan_xxx","pro_monthly":"plan_yyy","premium_monthly":"plan_zzz"}` -- the
// Razorpay-dashboard-assigned plan IDs for each of our own planIds. Not a `contracts/` value
// (Razorpay plan IDs are per-Razorpay-account, not app-domain data).
const runtimeOptions = {
  maxInstances: 10,
  secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_PLAN_IDS']
};

// Per-user rate limit on subscription-creation attempts (scale-hardening follow-up to the
// Dual-Platform Subscription Billing Hardening plan). The blanket `maxInstances: 10` above caps
// total concurrency across ALL users -- without a per-user limit, a promo-driven burst or a
// scripted/compromised client hammering this endpoint can monopolize that shared pool, and
// legitimate purchasers get backpressure failures indistinguishable from abuse. Mirrors
// geminiProxy.js's `enforceRateLimit` shape (atomic transaction-based hour-bucket counter),
// scoped here to subscription-creation attempts rather than AI calls. A real purchase flow
// needs at most a couple of attempts (initial + retry after a transient failure); 5/hour is
// generous headroom above that while still capping one account's share of the instance pool.
const HOURLY_SUBSCRIPTION_CREATE_LIMIT = 5;

/** Server owns the hour boundary -- UTC, matches geminiProxy.js's currentHourKey() convention. */
function currentHourKey() {
  const now = new Date();
  return (
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`
  );
}

/**
 * Atomically checks and increments a per-user hourly subscription-creation counter. Reuses the
 * existing USER_SUBSCRIPTION_SUBCOLLECTION ("subscription") rather than a new FirestorePaths
 * entry, same precedent as geminiProxy.js's `ai_usage_{hourKey}` doc alongside eligibility.js's
 * `usage_{month}` docs in the same subcollection.
 */
async function enforceSubscriptionCreationRateLimit(firestoreDb, userId) {
  const hourKey = currentHourKey();
  const docRef = firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION)
    .doc(`subscription_create_usage_${hourKey}`);

  return firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const currentCount = snapshot.exists ? snapshot.data().count || 0 : 0;
    if (currentCount >= HOURLY_SUBSCRIPTION_CREATE_LIMIT) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Too many subscription creation attempts (${currentCount}/${HOURLY_SUBSCRIPTION_CREATE_LIMIT} this hour) -- please try again later`
      );
    }
    tx.set(docRef, { count: currentCount + 1, lastUpdated: Date.now() }, { merge: true });
    return currentCount + 1;
  });
}

/**
 * Phase C (Dual-Platform Subscription Billing Hardening plan): server-side purchase gate --
 * rejects Razorpay subscription creation while the caller holds a still-active
 * RevenueCat-sourced subscription. A plain `.get()` pre-check (not a transaction) since nothing
 * is written here; the write-time cross-platform guard is the reconciliation logic already in
 * `webhooks.js`/`revenueCatWebhook.js` (`resolveReconciliation`).
 *
 * Only closes the Razorpay-blocks-RevenueCat direction. The reverse has no server-side
 * equivalent -- RevenueCat's flow charges the user via the store before any of our server code
 * runs, so it cannot be pre-blocked the way a Razorpay order/subscription creation can (see the
 * plan's "Structural constraint" note in its Context section). `UpgradeViewModel.kt`'s
 * `restorePurchases()` gate plus webhook-to-webhook reconciliation are the best available
 * mitigation for that direction -- see the comment on `activeOnWebInstead` there.
 *
 * Fails CLOSED on any read error -- the *opposite* policy from `GitLiveSubscriptionRepository`/
 * `SubscriptionRepository.ts`'s client-side ownership reads, which deliberately fail open since
 * they're UI-advisory only. A server-side purchase gate is not the place to fail open; do not
 * "fix" this back to fail-open by copy-pasting the client pattern.
 */
async function assertNoActiveRevenueCatSubscription(firestoreDb, userId) {
  let doc;
  try {
    doc = await firestoreDb
      .collection(FirestorePaths.USERS)
      .doc(userId)
      .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
      .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
      .get();
  } catch (readError) {
    console.error('createRazorpaySubscription: ownership pre-check read failed, rejecting (fail-closed)', readError);
    throw new functions.https.HttpsError('internal', 'Unable to verify subscription ownership, please try again');
  }

  if (!doc.exists) {
    return;
  }
  const existing = doc.data() || {};
  if (existing.source !== 'REVENUECAT') {
    return;
  }

  // `expiryDate == null` on a REVENUECAT-sourced doc fails closed (treated as still-active) --
  // RC always writes a real `expiryDate` on grant, so null here means a transient partial write
  // or a pre-Phase-4 doc, not "no expiry".
  const stillActive = existing.expiryDate == null || existing.expiryDate > Date.now();
  if (stillActive) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'An active subscription already exists on the mobile app -- cancel it there before purchasing on web'
    );
  }
}

/**
 * Create Razorpay Subscription Callable Function
 */
exports.createRazorpaySubscription = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to create a subscription'
    );
  }
  if (!context.app) {
    // Same warn-only stance as `payments.js`'s identical check -- App Check isn't wired
    // client-side yet (Phase 1b).
    console.warn(`createRazorpaySubscription: no App Check token, uid=${context.auth.uid}`);
  }

  const userId = context.auth.uid;
  const { planId = 'pro_monthly' } = data || {};

  if (!VALID_PLAN_IDS.has(planId)) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown planId '${planId}'`);
  }

  // Same rule regardless of the emulator/mock fallback below -- rate limiting and the ownership
  // gate are both about protecting/gating this endpoint, not Razorpay connectivity.
  await enforceSubscriptionCreationRateLimit(db, userId);
  await assertNoActiveRevenueCatSubscription(db, userId);

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planIdsJson = process.env.RAZORPAY_PLAN_IDS;

  if (!keyId || !keySecret || !planIdsJson) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      // Mirrors `payments.js`'s exact emulator/dev fallback -- without this, local dev breaks
      // the moment this ships (senior-review fix #7).
      const mockSubscriptionId = `sub_mock_${Date.now()}_${userId.slice(0, 6)}`;
      return {
        success: true,
        subscriptionId: mockSubscriptionId,
        keyId: keyId || 'rzp_test_mockKey123',
        notes: { userId, planId }
      };
    }
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Razorpay subscription credentials are missing in production environment'
    );
  }

  let razorpayPlanId;
  try {
    razorpayPlanId = JSON.parse(planIdsJson)[planId];
  } catch (parseError) {
    console.error('Malformed RAZORPAY_PLAN_IDS secret:', parseError);
    throw new functions.https.HttpsError('internal', 'Subscription plan configuration error');
  }
  if (!razorpayPlanId) {
    throw new functions.https.HttpsError('failed-precondition', `No Razorpay plan configured for '${planId}'`);
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        // Razorpay requires a bound on total billing cycles; 120 (~10 years of monthly cycles)
        // is a practical "unbounded" ceiling -- actual continuation/cancellation is customer-
        // driven via the checkout/cancel flow, not this count.
        total_count: 120,
        notes: {
          userId: userId,
          planId: planId
        }
      })
    });

    const subscriptionData = await response.json();
    if (!response.ok) {
      throw new Error(subscriptionData.error?.description || 'Razorpay subscription creation failed');
    }

    return {
      success: true,
      subscriptionId: subscriptionData.id,
      keyId: keyId,
      notes: subscriptionData.notes
    };
  } catch (error) {
    console.error('Error creating Razorpay subscription:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.VALID_PLAN_IDS = VALID_PLAN_IDS;
exports.assertNoActiveRevenueCatSubscription = assertNoActiveRevenueCatSubscription;
exports.enforceSubscriptionCreationRateLimit = enforceSubscriptionCreationRateLimit;
exports.HOURLY_SUBSCRIPTION_CREATE_LIMIT = HOURLY_SUBSCRIPTION_CREATE_LIMIT;
