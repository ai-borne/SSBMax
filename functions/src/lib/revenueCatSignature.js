/**
 * RevenueCat HMAC Signature Verification (Phase 12 300-LOC split)
 *
 * Extracted out of `revenueCatWebhook.js` purely to keep that file under the 300-LOC cap once L1's
 * freshness-window check grew it past it -- mirrors `lib/razorpaySignature.js`'s identical
 * extraction for the Razorpay side. No behavior changed by this extraction.
 */

const crypto = require('crypto');

// L1 (Phase 12): the HMAC covers `t=<timestamp>.<body>`, but until this fix nothing ever checked
// that `t` was recent -- a captured, genuinely-signed request (a proxy log, a browser history
// entry on a debugging dashboard, a leaked webhook payload) stayed replayable forever, since the
// signature itself never expires. 5 minutes mirrors Stripe's own documented webhook tolerance
// (https://stripe.com/docs/webhooks/signatures#replay-attacks) -- generous enough for real
// network/queueing delay, tight enough to close the actual replay window.
const SIGNATURE_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

/**
 * Verifies RevenueCat's `X-RevenueCat-Webhook-Signature` header: `t=<unix_ts>,v1=<hex hmac-sha256
 * of "<ts>.<raw body>">`. `nowMs` is injectable so tests can pin a specific instant rather than
 * racing `Date.now()`.
 */
function verifySignature(req, secret, nowMs = Date.now()) {
  const header = req.headers['x-revenuecat-webhook-signature'];
  if (!header) return false;

  const match = /^t=(\d+),v1=([0-9a-f]+)$/.exec(header);
  if (!match) return false;
  const [, timestamp, signature] = match;

  const rawBody = req.rawBody ? req.rawBody.toString('utf-8') : JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  const bufA = Buffer.from(signature, 'utf-8');
  const bufB = Buffer.from(expectedSignature, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  if (!crypto.timingSafeEqual(bufA, bufB)) return false;

  const signedAtMs = Number(timestamp) * 1000;
  return Math.abs(nowMs - signedAtMs) <= SIGNATURE_FRESHNESS_WINDOW_MS;
}

module.exports = { verifySignature, SIGNATURE_FRESHNESS_WINDOW_MS };
