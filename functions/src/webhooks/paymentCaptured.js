/**
 * Legacy Razorpay `payment.captured` handling (Phase 3, `docs/plans` payment ecosystem hardening
 * plan, step 3a mechanical split). Split out of `webhooks.js` purely to keep that file's dispatcher
 * under the 300-LOC cap once H2/H3 grew this branch -- `lib/razorpaySubscriptionWebhook.js` already
 * got the same treatment for the subscription-family events, this is the legacy one-time-order
 * counterpart.
 */

const admin = require('firebase-admin');
const { FirestorePaths, PricingTiers } = require('../generated/contracts.cjs');

/**
 * planId -> expected amount in paise, sourced from the generated pricing contract
 * (contracts/pricing.yaml) rather than a hand-typed map -- this used to be missing
 * basic_monthly/premium_monthly entirely, so Basic/Premium purchases via Razorpay
 * could never pass the underpayment check below (see docs/plans/
 * SubscriptionPricingRestructure.md Phase 2). `*_yearly` planIds have no contract
 * entry (monthly billing only, for now) and are intentionally left out here.
 */
const TIER_PRICES = Object.fromEntries(
  PricingTiers.map(({ tier, monthlyInr }) => [`${tier.toLowerCase()}_monthly`, monthlyInr * 100])
);

/**
 * planId ("basic_monthly") -> tier name ("BASIC"), the inverse of the map above. Used to
 * populate `users/{uid}/data/subscription` -- see [applySubscriptionTier]'s doc comment for why
 * this write was missing entirely until Phase 4 (RevenueCat integration)'s amendment.
 */
function planIdToTier(planId) {
  const tier = planId.split('_')[0]?.toUpperCase();
  return tier && TIER_PRICES[planId] !== undefined ? tier : 'PRO';
}

/**
 * One calendar month after `fromMillis`, UTC (Phase 3, H2). Calendar-month arithmetic rather than
 * a flat 30-day constant so it doesn't silently drift a few days short over 31-day months --
 * `Date`'s `setUTCMonth` normalizes month-end overflow (e.g. Jan 31 -> Mar 3) the same way
 * `eligibility.js`'s `currentPeriodKey` anchors and clamps around month boundaries.
 */
function addOneBillingPeriod(fromMillis) {
  const d = new Date(fromMillis);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.getTime();
}

/**
 * H3: a `payment.captured` payment entity that carries `invoice_id` or `subscription_id` belongs
 * to a Razorpay subscription-family charge, not a legacy one-time order -- `RAZORPAY_SUBSCRIPTION_
 * GRANT_EVENTS`'s `subscription.charged` (via `processRazorpaySubscriptionEvent`) already owns
 * that charge and derives `expiryDate` from the subscription's authoritative `current_end`. If the
 * legacy branch below also applied `applySubscriptionTier` to the same payment, the two handlers'
 * writes would race within the same webhook delivery and whichever wrote last (arbitrary order)
 * would silently overwrite the other's `expiryDate`/`startDate`.
 *
 * Per the plan's landmine note: `razorpay_subscriptions_checkout` is off in production today, so
 * this branch is not yet exercised by live traffic -- guarding against it now is why it doesn't
 * regress the moment that flag flips on. Live Razorpay test-mode payment-entity shape was not
 * re-verified in this environment; this checks both fields Razorpay's docs describe as present on
 * a subscription charge's payment entity, so it fails safe (skips) even if only one is populated.
 */
function isSubscriptionLinkedPayment(payment) {
  return Boolean(payment?.invoice_id || payment?.subscription_id);
}

/**
 * Writes the tier every real gating read path actually consults --
 * `users/{uid}/data/subscription` (`GitLiveSubscriptionRepository`/web's `SubscriptionRepository`/
 * `eligibility.js`, see Phase 3's `SubscriptionTierDto` schema) -- inside the same transaction as
 * the legacy `isPaidMember`/`membershipPlan` flags on the root `users/{uid}` doc.
 *
 * H2: also writes `expiryDate`, one billing period out from *now* (the moment this payment was
 * captured), not from `startDate` -- `startDate` stays pinned to the original purchase forever,
 * so anchoring expiry there would compute a date in the past for every renewal after the first.
 * Before this, a re-subscribing lapsed user's doc kept whatever stale `expiryDate` (or none) it
 * already had, and read as FREE the moment Phase 0's read-time derivation shipped -- paid,
 * permanently on FREE, exactly the plan's headline H2 defect.
 */
function applySubscriptionTier(transaction, userRef, tier, existingStartDate, nowMillis = Date.now()) {
  const subscriptionRef = userRef
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);
  transaction.set(
    subscriptionRef,
    {
      tier,
      startDate: existingStartDate || nowMillis,
      expiryDate: addOneBillingPeriod(nowMillis),
      billingCycle: 'MONTHLY',
      source: 'RAZORPAY'
    },
    { merge: true }
  );
}

/**
 * The `payment.captured` business logic, extracted so tests can drive it against a fake
 * `firestoreDb` instead of a live/emulated transaction -- mirroring `processRazorpaySubscriptionEvent`'s
 * existing injectable shape in `lib/razorpaySubscriptionWebhook.js`. Returns a discriminated result
 * object; `webhooks.js`'s `handleRazorpayWebhook` is the only thing that translates it into an HTTP
 * response.
 */
async function processPaymentCaptured(payment, eventId, firestoreDb) {
  const notes = payment?.notes || {};
  const userId = notes.userId;
  const planId = notes.planId || 'pro_monthly';
  const amountPaid = payment?.amount || 0;
  const currency = payment?.currency || 'INR';

  if (isSubscriptionLinkedPayment(payment)) {
    return { subscriptionLinked: true };
  }

  if (!userId) {
    return { warning: 'missing_user_id' };
  }

  if (currency !== 'INR') {
    return { invalidCurrency: currency };
  }

  if (!payment?.id) {
    return { missingPaymentId: true };
  }

  const logRef = firestoreDb.collection(FirestorePaths.WEBHOOK_LOGS).doc(eventId);
  const paymentRef = firestoreDb.collection(FirestorePaths.PAYMENTS).doc(payment.id);
  const userRef = firestoreDb.collection(FirestorePaths.USERS).doc(userId);
  const subscriptionRef = userRef
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

  return firestoreDb.runTransaction(async (transaction) => {
    const logDoc = await transaction.get(logRef);
    if (logDoc.exists) {
      return { idempotent: true };
    }

    const paymentDoc = await transaction.get(paymentRef);
    if (paymentDoc.exists && paymentDoc.data().userId !== userId) {
      return { replayDetected: true };
    }

    // Read before any write in this transaction (Firestore requires all reads first).
    const subscriptionDoc = await transaction.get(subscriptionRef);
    const existingStartDate = subscriptionDoc.exists ? subscriptionDoc.data().startDate : null;

    const expectedAmount = TIER_PRICES[planId] || TIER_PRICES.pro_monthly;
    if (amountPaid < expectedAmount) {
      transaction.set(logRef, {
        eventId,
        userId,
        status: 'failed_underpayment',
        amountPaid,
        expectedAmount,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { underpaid: true, expectedAmount };
    }

    transaction.set(paymentRef, {
      paymentId: payment.id,
      orderId: payment.order_id || null,
      userId,
      planId,
      amountPaid,
      currency,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    transaction.set(userRef, {
      isPaidMember: true,
      membershipPlan: planId,
      paymentId: payment.id,
      orderId: payment.order_id || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    applySubscriptionTier(transaction, userRef, planIdToTier(planId), existingStartDate);

    transaction.set(logRef, {
      eventId,
      userId,
      planId,
      paymentId: payment.id,
      amountPaid,
      status: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, userId, planId };
  });
}

module.exports = {
  TIER_PRICES,
  planIdToTier,
  addOneBillingPeriod,
  isSubscriptionLinkedPayment,
  applySubscriptionTier,
  processPaymentCaptured
};
