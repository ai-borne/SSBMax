/**
 * Razorpay Webhook Handler & Cryptographic Verification
 *
 * Implements SSOT for paid membership activation with timing-safe HMAC check,
 * idempotency replay attack prevention, and server-side tier price validation.
 *
 * Dispatcher only (Phase 3, step 3a mechanical split) -- the two event families' business logic
 * lives in `webhooks/paymentCaptured.js` (legacy one-time `payment.captured`) and
 * `lib/razorpaySubscriptionWebhook.js` (subscription-family events), both built to run against an
 * injectable `firestoreDb` so they're testable without a live/emulated transaction.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { verifyRazorpaySignature, timingSafeCompare } = require('./lib/razorpaySignature');
const { emitOpsAlert, ALERT_KINDS, SEVERITIES } = require('./lib/opsAlert');
const {
  TIER_PRICES,
  planIdToTier,
  addOneBillingPeriod,
  isSubscriptionLinkedPayment,
  applySubscriptionTier,
  processPaymentCaptured
} = require('./webhooks/paymentCaptured');
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

function processRazorpaySubscriptionEvent(eventType, payload, eventId, firestoreDb) {
  return processSubEvent(eventType, payload, eventId, firestoreDb, planIdToTier);
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
    await emitOpsAlert(db, {
      kind: ALERT_KINDS.SIGNATURE_VERIFICATION_FAILED,
      severity: SEVERITIES.HIGH,
      detail: { provider: 'RAZORPAY' }
    });
    return res.status(400).json({ status: 'error', message: 'Invalid signature' });
  }

  const event = req.body.event;
  const eventId = req.body.event_id || req.headers['x-razorpay-event-id'] || `event_${Date.now()}`;

  if (event === 'payment.captured') {
    const payment = req.body.payload?.payment?.entity;

    try {
      const result = await processPaymentCaptured(payment, eventId, db);

      if (result.warning) {
        console.warn('Webhook warning: payment.captured event missing userId in notes');
        return res.status(200).json({ status: 'ok', warning: result.warning });
      }

      if (result.invalidCurrency) {
        console.error(`Invalid currency ${result.invalidCurrency} for user ${payment?.notes?.userId}`);
        return res.status(400).json({ status: 'error', message: 'Invalid currency' });
      }

      if (result.missingPaymentId) {
        console.error('Webhook error: missing payment.id');
        return res.status(400).json({ status: 'error', message: 'Missing payment id' });
      }

      if (result.subscriptionLinked) {
        console.log(`payment.captured for payment ${payment?.id} belongs to a Razorpay subscription -- skipped, the subscription-family handler owns it`);
        return res.status(200).json({ status: 'ok', skipped: 'subscription_linked_payment' });
      }

      if (result.idempotent) {
        console.log(`Duplicate webhook event ${eventId} ignored (idempotent entry found)`);
        return res.status(200).json({ status: 'ok', idempotent: true });
      }

      if (result.replayDetected) {
        console.error(`Replay attack detected: payment ${payment.id} already claimed by another user`);
        return res.status(400).json({ status: 'error', message: 'Payment ID already claimed by another user' });
      }

      if (result.underpaid) {
        console.error(`Underpayment detected for user ${payment?.notes?.userId}: paid ${payment?.amount || 0}`);
        return res.status(400).json({ status: 'error', message: 'Underpayment detected' });
      }

      console.log(`Successfully upgraded user ${result.userId} to Paid Member (Plan: ${result.planId})`);
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

      if (result.conflict) {
        await emitOpsAlert(db, {
          kind: ALERT_KINDS.WEBHOOK_RECONCILIATION_CONFLICT,
          severity: SEVERITIES.HIGH,
          userId: result.userId,
          detail: { source: 'RAZORPAY', eventType: event, resolvedTier: result.tier }
        });
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
exports.addOneBillingPeriod = addOneBillingPeriod;
exports.isSubscriptionLinkedPayment = isSubscriptionLinkedPayment;
exports.applySubscriptionTier = applySubscriptionTier;
exports.processPaymentCaptured = processPaymentCaptured;
exports.processRazorpaySubscriptionEvent = processRazorpaySubscriptionEvent;
exports.extractRazorpaySubscriptionContext = extractRazorpaySubscriptionContext;
exports.RAZORPAY_SUBSCRIPTION_EVENT_TYPES = RAZORPAY_SUBSCRIPTION_EVENT_TYPES;
exports.RAZORPAY_SUBSCRIPTION_GRANT_EVENTS = RAZORPAY_SUBSCRIPTION_GRANT_EVENTS;
exports.RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS = RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS;
exports.RAZORPAY_SUBSCRIPTION_HALT_EVENT = RAZORPAY_SUBSCRIPTION_HALT_EVENT;
exports.RAZORPAY_SUBSCRIPTION_CANCEL_EVENT = RAZORPAY_SUBSCRIPTION_CANCEL_EVENT;
exports.RAZORPAY_SUBSCRIPTION_PAUSE_EVENT = RAZORPAY_SUBSCRIPTION_PAUSE_EVENT;
exports.RAZORPAY_SUBSCRIPTION_RESUME_EVENT = RAZORPAY_SUBSCRIPTION_RESUME_EVENT;
