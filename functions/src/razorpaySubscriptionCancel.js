/**
 * Cancel Razorpay Subscription Callable Function (Phase 5, H5a -- Payment Ecosystem Hardening
 * plan). Split out of `razorpaySubscriptions.js` so that file plus this one both stay under the
 * 300-LOC cap; both share `lib/subscriptionRateLimit.js`'s hourly rate limiter.
 *
 * The client never supplies which subscription to cancel -- there is no `subscriptionId` (or any)
 * field read from `data`. The callable always targets the caller's own
 * `users/{context.auth.uid}/data/subscription` doc, so a client cannot target another user's
 * subscription regardless of what it sends. This is the server-side half of cancellation; the
 * already-deployed `subscription.cancelled` webhook (`lib/razorpaySubscriptionWebhook.js`) is what
 * actually flips `willRenew: false` once Razorpay confirms the cancel -- this callable only calls
 * Razorpay's cancel API and reports whether that call succeeded.
 */

// Same v1 pinning as `razorpaySubscriptions.js` -- see that file's identical comment.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('./generated/contracts.cjs');
const { enforceSubscriptionCancelRateLimit } = require('./lib/subscriptionRateLimit');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Same DoW-defense shape as `razorpaySubscriptions.js`'s `createRazorpaySubscription`.
const runtimeOptions = {
  maxInstances: 10,
  secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']
};

/**
 * The actual cancellation logic, against an injectable `firestoreDb`/`fetchImpl` -- split out of
 * the `onCall` wrapper so tests can exercise every branch (missing subscription, Razorpay API
 * success/failure) without a live Firestore doc or a real network call, mirroring
 * `razorpaySubscriptions.js`'s `assertNoActiveRevenueCatSubscription` convention.
 */
async function cancelRazorpaySubscriptionForUser(firestoreDb, userId, fetchImpl = fetch) {
  const subscriptionRef = firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

  let subscriptionDoc;
  try {
    subscriptionDoc = await subscriptionRef.get();
  } catch (readError) {
    console.error('cancelRazorpaySubscription: subscription read failed, rejecting (fail-closed)', readError);
    throw new functions.https.HttpsError('internal', 'Unable to verify subscription, please try again');
  }

  const existing = subscriptionDoc.exists ? subscriptionDoc.data() || {} : {};
  if (!subscriptionDoc.exists || existing.source !== 'RAZORPAY' || !existing.subscriptionId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No active Razorpay subscription found to cancel'
    );
  }
  const subscriptionId = existing.subscriptionId;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      // Same emulator/dev fallback shape as `createRazorpaySubscription` -- local dev must not
      // require live Razorpay credentials.
      return { success: true, subscriptionId, mocked: true };
    }
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Razorpay credentials are missing in production environment'
    );
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetchImpl(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      // `cancel_at_cycle_end`: access continues until `current_end`, mirroring RevenueCat's
      // "cancellation only turns off auto-renew" semantics (see `revenueCatWebhook.js`).
      body: JSON.stringify({ cancel_at_cycle_end: 1 })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.description || 'Razorpay subscription cancellation failed');
    }

    return { success: true, subscriptionId };
  } catch (error) {
    console.error('Error cancelling Razorpay subscription:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
}

exports.cancelRazorpaySubscription = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to cancel a subscription'
    );
  }

  const userId = context.auth.uid;
  await enforceSubscriptionCancelRateLimit(db, userId);
  return cancelRazorpaySubscriptionForUser(db, userId);
});

exports.cancelRazorpaySubscriptionForUser = cancelRazorpaySubscriptionForUser;
