/**
 * RevenueCat Webhook Handler (Phase 4, RevenueCat integration)
 *
 * Receives RevenueCat's server-to-server lifecycle events (INITIAL_PURCHASE/RENEWAL/
 * EXPIRATION/CANCELLATION/PRODUCT_CHANGE/...) and writes `tier`/`startDate`/`expiryDate`/
 * `billingCycle` to `users/{uid}/data/subscription` -- the same Firestore doc shape Phase 3
 * built (`SubscriptionTierDto`) and the one every real gating read path consults
 * (`GitLiveSubscriptionRepository`/web's `SubscriptionRepository`/`eligibility.js`). This is
 * Android/iOS's equivalent of `webhooks.js`'s `applySubscriptionTier` -- RevenueCat doesn't
 * support Razorpay, so web keeps its own Razorpay webhook path.
 *
 * Auth: RevenueCat's HMAC signature scheme -- header `X-RevenueCat-Webhook-Signature`,
 * format `t=<unix_ts>,v1=<hex hmac-sha256 of "<ts>.<raw body>">`, keyed on the signing
 * secret configured alongside the webhook URL in the RC dashboard. Mirrors
 * `webhooks.js`'s `timingSafeCompare` HMAC pattern for Razorpay.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { FirestorePaths } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * RC entitlement identifiers -> app tier, cumulative (mirrors
 * `shared/.../platform/billing/revenuecat/RevenueCatEntitlementMapper.kt` -- the RC dashboard
 * grants basic+pro+premium together on a premium purchase, so this only has to pick the
 * highest one present, never combine tiers itself). Kept in sync by hand since this is a
 * different runtime (Node) than the Kotlin client -- both read the same three RC dashboard
 * identifiers, not a generated contract, because RC entitlement IDs aren't a `contracts/` value.
 */
function entitlementIdsToTier(entitlementIds) {
  const ids = new Set(entitlementIds || []);
  if (ids.has('premium')) return 'PREMIUM';
  if (ids.has('pro')) return 'PRO';
  if (ids.has('basic')) return 'BASIC';
  return 'FREE';
}

/** Event types that grant/renew an entitlement -- tier is (re)computed from `entitlement_ids`. */
const GRANT_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']);

/** Event types that end an entitlement -- downgrades to FREE (single cumulative product per tier,
 * so an expiring subscription always expires the whole tier, not a partial entitlement set). */
const REVOKE_EVENT_TYPES = new Set(['EXPIRATION']);

function verifySignature(req, secret) {
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
  return crypto.timingSafeEqual(bufA, bufB);
}

// DoW-defense cap (Phase 5, cost & scale guardrails) -- same rationale as webhooks.js's
// identical addition: an unauthenticated-by-nature endpoint with no prior instance ceiling.
exports.handleRevenueCatWebhook = functions.https.onRequest({ maxInstances: 10 }, async (req, res) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
      console.error('REVENUECAT_WEBHOOK_SECRET missing in production');
      return res.status(500).json({ status: 'error', message: 'Webhook secret misconfigured' });
    }
  } else if (!verifySignature(req, secret)) {
    console.error('Invalid RevenueCat webhook signature');
    return res.status(400).json({ status: 'error', message: 'Invalid signature' });
  }

  const event = req.body?.event;
  if (!event) {
    return res.status(400).json({ status: 'error', message: 'Missing event' });
  }

  const eventId = event.id;
  const userId = event.app_user_id;
  const eventType = event.type;

  if (!eventId || !userId) {
    console.warn('RevenueCat webhook missing event.id or event.app_user_id');
    return res.status(200).json({ status: 'ok', warning: 'missing_id_or_app_user_id' });
  }

  if (!GRANT_EVENT_TYPES.has(eventType) && !REVOKE_EVENT_TYPES.has(eventType)) {
    // Every other event type (BILLING_ISSUE, CANCELLATION, TEST, paywall analytics, ...)
    // doesn't change what tier is granted right now -- CANCELLATION only turns off
    // auto-renew, access continues until the already-scheduled EXPIRATION event.
    return res.status(200).json({ status: 'ok', ignored: eventType });
  }

  try {
    const logRef = db.collection(FirestorePaths.WEBHOOK_LOGS).doc(`rc_${eventId}`);
    const userRef = db.collection(FirestorePaths.USERS).doc(userId);
    const subscriptionRef = userRef
      .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
      .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

    const result = await db.runTransaction(async (transaction) => {
      const logDoc = await transaction.get(logRef);
      if (logDoc.exists) {
        return { idempotent: true };
      }
      const subscriptionDoc = await transaction.get(subscriptionRef);
      const existingStartDate = subscriptionDoc.exists ? subscriptionDoc.data().startDate : null;

      const tier = GRANT_EVENT_TYPES.has(eventType) ? entitlementIdsToTier(event.entitlement_ids) : 'FREE';

      transaction.set(
        subscriptionRef,
        {
          tier,
          startDate: GRANT_EVENT_TYPES.has(eventType) ? existingStartDate || Date.now() : existingStartDate || 0,
          expiryDate: event.expiration_at_ms || null,
          billingCycle: 'MONTHLY',
          // Marks this doc as owned by the mobile/RevenueCat path -- see `webhooks.js`'s
          // `applySubscriptionTier` doc comment for why this exists (dual-purchase gate).
          source: 'REVENUECAT'
        },
        { merge: true }
      );

      transaction.set(logRef, {
        eventId,
        userId,
        eventType,
        tier,
        status: 'processed',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, tier };
    });

    if (result.idempotent) {
      console.log(`Duplicate RevenueCat webhook event ${eventId} ignored (idempotent entry found)`);
      return res.status(200).json({ status: 'ok', idempotent: true });
    }

    console.log(`RevenueCat webhook: user ${userId} -> ${result.tier} (event ${eventType})`);
    return res.status(200).json({ status: 'ok' });
  } catch (txError) {
    console.error('Transaction error during RevenueCat webhook processing:', txError);
    return res.status(500).json({ status: 'error', message: 'Internal processing error' });
  }
});

exports.entitlementIdsToTier = entitlementIdsToTier;
exports.verifySignature = verifySignature;
