/**
 * Razorpay Webhook Handler & Cryptographic Verification
 *
 * Implements SSOT for paid membership activation with timing-safe HMAC check,
 * idempotency replay attack prevention, and server-side tier price validation.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

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

  if (secret) {
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

    if (!userId) {
      console.warn('Webhook warning: payment.captured event missing userId in notes');
      return res.status(200).json({ status: 'ok', warning: 'missing_user_id' });
    }

    // Idempotency check: prevent replay attacks
    const logRef = db.collection('webhook_logs').doc(eventId);
    const logDoc = await logRef.get();
    if (logDoc.exists) {
      console.log(`Duplicate webhook event ${eventId} ignored (idempotent entry found)`);
      return res.status(200).json({ status: 'ok', idempotent: true });
    }

    // Server-side tier price verification
    const expectedAmount = TIER_PRICES[planId] || TIER_PRICES.pro_monthly;
    if (amountPaid < expectedAmount) {
      console.error(`Underpayment detected for user ${userId}: paid ${amountPaid}, expected ${expectedAmount}`);
      await logRef.set({
        eventId,
        userId,
        status: 'failed_underpayment',
        amountPaid,
        expectedAmount,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(400).json({ status: 'error', message: 'Underpayment detected' });
    }

    // Activate paid membership
    await db.collection('users').doc(userId).set({
      isPaidMember: true,
      membershipPlan: planId,
      paymentId: payment.id,
      orderId: payment.order_id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Record idempotent webhook processing log
    await logRef.set({
      eventId,
      userId,
      planId,
      paymentId: payment.id,
      amountPaid,
      status: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Successfully upgraded user ${userId} to Paid Member (Plan: ${planId})`);
  }

  return res.status(200).json({ status: 'ok' });
});

exports.timingSafeCompare = timingSafeCompare;
