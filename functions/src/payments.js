/**
 * Razorpay Order Handler
 *
 * Initializes Razorpay payment orders with mandatory notes metadata (userId, planId).
 */

// Pinned to v1 -- see eligibility.js's identical comment: the handler below uses the v1
// two-arg `(data, context)` onCall signature (`context.auth`), and bare
// `require('firebase-functions')` resolves to the v2 API by default on this project's
// installed firebase-functions@7, which would silently make `context.auth` always
// undefined and this function always reject as unauthenticated.
const functions = require('firebase-functions/v1');
const { PricingTiers } = require('./generated/contracts.cjs');

/**
 * planId -> order amount in paise, sourced from the generated pricing contract
 * (contracts/pricing.yaml) -- never the client-supplied `amount` (see below). Only
 * `{tier}_monthly` planIds exist since pricing is monthly-only for now.
 */
const PLAN_AMOUNTS_PAISE = Object.fromEntries(
  PricingTiers.filter((t) => t.tier !== 'FREE').map(({ tier, monthlyInr }) => [`${tier.toLowerCase()}_monthly`, monthlyInr * 100])
);

/**
 * Create Razorpay Order Callable Function
 */
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to create a payment order'
    );
  }

  const userId = context.auth.uid;
  const { currency = 'INR', planId = 'pro_monthly' } = data || {};

  // Security fix (docs/plans/SubscriptionPricingRestructure.md Phase 2): the order amount is
  // always computed server-side from `planId` -- a client-supplied `amount` is never trusted,
  // closing the gap where a client could previously request a Razorpay order for any amount.
  const amount = PLAN_AMOUNTS_PAISE[planId];
  if (!amount) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Unknown planId '${planId}'`
    );
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      // Development fallback mock order ID for testing when Razorpay credentials are unset in emulator
      const mockOrderId = `order_mock_${Date.now()}_${userId.slice(0, 6)}`;
      return {
        success: true,
        orderId: mockOrderId,
        amount: amount,
        currency: currency,
        keyId: keyId || 'rzp_test_mockKey123',
        notes: { userId, planId }
      };
    }
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Razorpay payment credentials are missing in production environment'
    );
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amount,
        currency: currency,
        receipt: `rcpt_${Date.now()}`,
        notes: {
          userId: userId,
          planId: planId
        }
      })
    });

    const orderData = await response.json();
    if (!response.ok) {
      throw new Error(orderData.error?.description || 'Razorpay order creation failed');
    }

    return {
      success: true,
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: keyId,
      notes: orderData.notes
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
