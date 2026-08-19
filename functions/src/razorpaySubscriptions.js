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
const { PricingTiers } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

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
