/**
 * Razorpay HMAC Signature Verification (shared)
 *
 * Extracted from `webhooks.js` (Phase B, Razorpay Subscriptions API migration --
 * `docs/plans` "SSBMax: Dual-Platform Subscription Billing Hardening" plan, senior-review
 * fix #6) so the new subscriptions webhook handler doesn't hand-duplicate this logic --
 * both `webhooks.js` (order-based `payment.captured`) and the subscriptions handler
 * verify Razorpay's `x-razorpay-signature` header the same way.
 */

const crypto = require('crypto');

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a Razorpay webhook request's `x-razorpay-signature` header against `secret`,
 * HMAC-SHA256 over the raw request body (Razorpay's documented scheme -- same for both the
 * Orders and Subscriptions webhook families).
 */
function verifyRazorpaySignature(req, secret) {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) return false;

  const payload = req.rawBody ? req.rawBody.toString('utf-8') : JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return timingSafeCompare(signature, expectedSignature);
}

module.exports = { timingSafeCompare, verifyRazorpaySignature };
