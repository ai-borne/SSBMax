/**
 * Razorpay Webhook Handler & Cryptographic Verification
 *
 * Implements SSOT for paid membership activation with timing-safe HMAC check,
 * idempotency replay attack prevention, and server-side tier price validation.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { FirestorePaths, PricingTiers } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

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
 * Writes the tier every real gating read path actually consults --
 * `users/{uid}/data/subscription` (`GitLiveSubscriptionRepository`/web's `SubscriptionRepository`/
 * `eligibility.js`, see Phase 3's `SubscriptionTierDto` schema) -- inside the same transaction as
 * the legacy `isPaidMember`/`membershipPlan` flags on the root `users/{uid}` doc.
 *
 * Amendment (found during Phase 3's deep check, Phase 4 RevenueCat integration plan): this
 * write never existed before -- a real Razorpay payment updated `isPaidMember` but never
 * `data/subscription.tier`, so a completed payment did not actually elevate the tier any real
 * gating check reads. `startDate` only gets set on a user's *first* transition into this tier
 * (an existing paid user's `startDate` is preserved across renewal webhooks), matching Phase 3's
 * billing-anniversary reset semantics -- a renewal must not reset the anniversary day.
 *
 * `source: 'RAZORPAY'` marks this doc as owned by the web/Razorpay payment path -- read by
 * `SubscriptionPage.tsx`'s dual-purchase gate (and `UpgradeViewModel.kt`'s KMP-side mirror) to
 * block a purchase on the *other* platform while a Razorpay-sourced tier is still active, since
 * neither webhook reconciles against what the other already wrote (last write wins otherwise).
 */
function applySubscriptionTier(transaction, userRef, tier, existingStartDate) {
  const subscriptionRef = userRef
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);
  transaction.set(
    subscriptionRef,
    {
      tier,
      startDate: existingStartDate || Date.now(),
      billingCycle: 'MONTHLY',
      source: 'RAZORPAY'
    },
    { merge: true }
  );
}

/**
 * Perform constant-time string comparison to prevent timing side-channel attacks
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Handle Razorpay Webhooks (payment.captured)
 */
// DoW-defense cap (Phase 5, cost & scale guardrails) -- this endpoint is unauthenticated by
// nature (Razorpay calls it directly), so it had no instance ceiling at all before this.
// `secrets` pulls RAZORPAY_WEBHOOK_SECRET from Secret Manager, same as payments.js.
exports.handleRazorpayWebhook = functions.https.onRequest({ maxInstances: 10, secrets: ['RAZORPAY_WEBHOOK_SECRET'] }, async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
      console.error('RAZORPAY_WEBHOOK_SECRET missing in production');
      return res.status(500).json({ status: 'error', message: 'Webhook secret misconfigured' });
    }
  } else {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.error('Missing Razorpay signature header');
      return res.status(400).json({ status: 'error', message: 'Missing signature' });
    }

    const payload = req.rawBody ? req.rawBody.toString('utf-8') : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (!timingSafeCompare(signature, expectedSignature)) {
      console.error('Invalid Razorpay Webhook signature (timing-safe check failed)');
      return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }
  }

  const event = req.body.event;
  const eventId = req.body.event_id || req.headers['x-razorpay-event-id'] || `event_${Date.now()}`;

  if (event === 'payment.captured') {
    const payment = req.body.payload?.payment?.entity;
    const notes = payment?.notes || {};
    const userId = notes.userId;
    const planId = notes.planId || 'pro_monthly';
    const amountPaid = payment?.amount || 0;
    const currency = payment?.currency || 'INR';

    if (!userId) {
      console.warn('Webhook warning: payment.captured event missing userId in notes');
      return res.status(200).json({ status: 'ok', warning: 'missing_user_id' });
    }

    if (currency !== 'INR') {
      console.error(`Invalid currency ${currency} for user ${userId}`);
      return res.status(400).json({ status: 'error', message: 'Invalid currency' });
    }

    if (!payment?.id) {
      console.error('Webhook error: missing payment.id');
      return res.status(400).json({ status: 'error', message: 'Missing payment id' });
    }

    try {
      const logRef = db.collection(FirestorePaths.WEBHOOK_LOGS).doc(eventId);
      const paymentRef = db.collection(FirestorePaths.PAYMENTS).doc(payment.id);
      const userRef = db.collection(FirestorePaths.USERS).doc(userId);
      const subscriptionRef = userRef
        .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
        .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

      const result = await db.runTransaction(async (transaction) => {
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

        return { success: true };
      });

      if (result.idempotent) {
        console.log(`Duplicate webhook event ${eventId} ignored (idempotent entry found)`);
        return res.status(200).json({ status: 'ok', idempotent: true });
      }

      if (result.replayDetected) {
        console.error(`Replay attack detected: payment ${payment.id} already claimed by another user`);
        return res.status(400).json({ status: 'error', message: 'Payment ID already claimed by another user' });
      }

      if (result.underpaid) {
        console.error(`Underpayment detected for user ${userId}: paid ${amountPaid}`);
        return res.status(400).json({ status: 'error', message: 'Underpayment detected' });
      }

      console.log(`Successfully upgraded user ${userId} to Paid Member (Plan: ${planId})`);
    } catch (txError) {
      console.error('Transaction error during webhook processing:', txError);
      return res.status(500).json({ status: 'error', message: 'Internal processing error' });
    }
  }

  return res.status(200).json({ status: 'ok' });
});

exports.timingSafeCompare = timingSafeCompare;
exports.TIER_PRICES = TIER_PRICES;
exports.planIdToTier = planIdToTier;
