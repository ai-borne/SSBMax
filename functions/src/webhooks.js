/**
 * Razorpay Webhook Handler & Cryptographic Verification
 *
 * Implements SSOT for paid membership activation with timing-safe HMAC check,
 * idempotency replay attack prevention, and server-side tier price validation.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FirestorePaths, PricingTiers } = require('./generated/contracts.cjs');
const { timingSafeCompare, verifyRazorpaySignature } = require('./lib/razorpaySignature');
const {
  RAZORPAY_SUBSCRIPTION_GRANT_EVENTS,
  RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS,
  RAZORPAY_SUBSCRIPTION_HALT_EVENT,
  RAZORPAY_SUBSCRIPTION_CANCEL_EVENT,
  RAZORPAY_SUBSCRIPTION_PAUSE_EVENT,
  RAZORPAY_SUBSCRIPTION_RESUME_EVENT,
  RAZORPAY_SUBSCRIPTION_EVENT_TYPES,
  extractRazorpaySubscriptionContext,
  processRazorpaySubscriptionEvent: processSubEvent
} = require('./lib/razorpaySubscriptionWebhook');

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

function processRazorpaySubscriptionEvent(eventType, payload, eventId, firestoreDb) {
  return processSubEvent(eventType, payload, eventId, firestoreDb, planIdToTier);
}

/**
 * Writes the tier every real gating read path actually consults --
 * `users/{uid}/data/subscription` (`GitLiveSubscriptionRepository`/web's `SubscriptionRepository`/
 * `eligibility.js`, see Phase 3's `SubscriptionTierDto` schema) -- inside the same transaction as
 * the legacy `isPaidMember`/`membershipPlan` flags on the root `users/{uid}` doc.
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
 * Handle Razorpay Webhooks (payment.captured, plus Phase B's subscription-family events)
 */
exports.handleRazorpayWebhook = functions.https.onRequest({ maxInstances: 10, secrets: ['RAZORPAY_WEBHOOK_SECRET'] }, async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
      console.error('RAZORPAY_WEBHOOK_SECRET missing in production');
      return res.status(500).json({ status: 'error', message: 'Webhook secret misconfigured' });
    }
  } else if (!req.headers['x-razorpay-signature']) {
    console.error('Missing Razorpay signature header');
    return res.status(400).json({ status: 'error', message: 'Missing signature' });
  } else if (!verifyRazorpaySignature(req, secret)) {
    console.error('Invalid Razorpay Webhook signature (timing-safe check failed)');
    return res.status(400).json({ status: 'error', message: 'Invalid signature' });
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
  } else if (RAZORPAY_SUBSCRIPTION_EVENT_TYPES.has(event)) {
    try {
      const result = await processRazorpaySubscriptionEvent(event, req.body.payload || {}, eventId, db);

      if (result.warning) {
        console.warn(`Webhook warning: ${event} event missing userId in notes`);
        return res.status(200).json({ status: 'ok', warning: result.warning });
      }

      if (result.idempotent) {
        console.log(`Duplicate webhook event ${eventId} ignored (idempotent entry found)`);
        return res.status(200).json({ status: 'ok', idempotent: true });
      }

      console.log(`Razorpay subscription webhook: event ${event} processed (${eventId})`);
    } catch (txError) {
      console.error('Transaction error during Razorpay subscription webhook processing:', txError);
      return res.status(500).json({ status: 'error', message: 'Internal processing error' });
    }
  }

  return res.status(200).json({ status: 'ok' });
});

exports.timingSafeCompare = timingSafeCompare;
exports.TIER_PRICES = TIER_PRICES;
exports.planIdToTier = planIdToTier;
exports.processRazorpaySubscriptionEvent = processRazorpaySubscriptionEvent;
exports.extractRazorpaySubscriptionContext = extractRazorpaySubscriptionContext;
exports.RAZORPAY_SUBSCRIPTION_EVENT_TYPES = RAZORPAY_SUBSCRIPTION_EVENT_TYPES;
exports.RAZORPAY_SUBSCRIPTION_GRANT_EVENTS = RAZORPAY_SUBSCRIPTION_GRANT_EVENTS;
exports.RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS = RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS;
exports.RAZORPAY_SUBSCRIPTION_HALT_EVENT = RAZORPAY_SUBSCRIPTION_HALT_EVENT;
exports.RAZORPAY_SUBSCRIPTION_CANCEL_EVENT = RAZORPAY_SUBSCRIPTION_CANCEL_EVENT;
exports.RAZORPAY_SUBSCRIPTION_PAUSE_EVENT = RAZORPAY_SUBSCRIPTION_PAUSE_EVENT;
exports.RAZORPAY_SUBSCRIPTION_RESUME_EVENT = RAZORPAY_SUBSCRIPTION_RESUME_EVENT;
