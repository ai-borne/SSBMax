/**
 * Razorpay Webhook Handler & Cryptographic Verification
 *
 * Implements SSOT for paid membership activation with timing-safe HMAC check,
 * idempotency replay attack prevention, and server-side tier price validation.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { FirestorePaths } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Tier price map (amount in paise)
const TIER_PRICES = {
  pro_monthly: 49900,
  pro_yearly: 499900,
};

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
exports.handleRazorpayWebhook = functions.https.onRequest(async (req, res) => {
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

      const result = await db.runTransaction(async (transaction) => {
        const logDoc = await transaction.get(logRef);
        if (logDoc.exists) {
          return { idempotent: true };
        }

        const paymentDoc = await transaction.get(paymentRef);
        if (paymentDoc.exists && paymentDoc.data().userId !== userId) {
          return { replayDetected: true };
        }

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
