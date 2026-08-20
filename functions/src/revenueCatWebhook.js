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
 * RC entitlement identifiers -> app tier, cumulative (mirrors `RevenueCatEntitlementMapper.toTier`,
 * which is an `object` INSIDE
 * `shared/src/commonMain/kotlin/com/ssbmax/shared/platform/billing/revenuecat/RevenueCatClient.kt`
 * -- there is no RevenueCatEntitlementMapper.kt file; the identifier constants it maps live in
 * `RevenueCatEntitlements` in that same file. The RC dashboard grants basic+pro+premium together
 * on a premium purchase, so this only has to pick the highest one present, never combine tiers
 * itself). Kept in sync by hand since this is a different runtime (Node) than the Kotlin client --
 * both read the same three RC dashboard identifiers, not a generated contract, because RC
 * entitlement IDs aren't a `contracts/` value (finding L4 tracks closing that duplication).
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
 * so an expiring subscription always expires the whole tier, not a partial entitlement set).
 * REFUND gets identical treatment to EXPIRATION -- both are "this entitlement is gone now". */
const REVOKE_EVENT_TYPES = new Set(['EXPIRATION', 'REFUND']);

/** RC's grace-period signal -- entitlement isn't revoked yet (EXPIRATION follows automatically
 * if the billing problem isn't resolved), but worth surfacing so a reconciliation cron/dashboard
 * can flag it. Handled in its own branch rather than the generic grant/revoke sets. */
const BILLING_ISSUE_EVENT_TYPE = 'BILLING_ISSUE';

/** Tier ranking for cross-platform reconciliation (higher wins on conflict). */
const TIER_RANK = { FREE: 0, BASIC: 1, PRO: 2, PREMIUM: 3 };

/** A subscription with no expiry (fails closed to "still active", matching the RC-always-writes-
 * expiryDate-on-grant assumption used elsewhere) or a future expiry is still in force. */
function isSubscriptionActive(expiryDate, nowMillis) {
  return expiryDate == null || expiryDate > nowMillis;
}

/**
 * Cross-cutting webhook-to-webhook reconciliation (see `shimmying-roaming-crane.md`'s "Webhook-
 * to-webhook reconciliation" section): neither this webhook nor `webhooks.js`'s Razorpay handler
 * knows what the other already wrote, so without this a race/stale-tab/direct-API-call scenario
 * lets whichever webhook fires last silently clobber an active subscription from the other
 * platform. If the existing doc was written by a different, still-active source, keep whichever
 * side has the higher tier (or, tied, the later expiryDate) instead of blindly taking `incoming`.
 */
function resolveReconciliation(existing, incoming, nowMillis) {
  const existingIsOtherActiveSource =
    existing.source != null &&
    existing.source !== incoming.source &&
    isSubscriptionActive(existing.expiryDate, nowMillis);

  if (!existingIsOtherActiveSource) {
    return { tier: incoming.tier, expiryDate: incoming.expiryDate, source: incoming.source, conflict: false };
  }

  const existingRank = TIER_RANK[existing.tier] ?? 0;
  const incomingRank = TIER_RANK[incoming.tier] ?? 0;

  let winner;
  if (existingRank !== incomingRank) {
    winner = existingRank > incomingRank ? existing : incoming;
  } else {
    // Same tier -- later expiryDate wins; no expiry (null) is treated as furthest-out.
    const existingExpiry = existing.expiryDate ?? Infinity;
    const incomingExpiry = incoming.expiryDate ?? Infinity;
    winner = existingExpiry >= incomingExpiry ? existing : incoming;
  }

  return { tier: winner.tier, expiryDate: winner.expiryDate, source: winner.source, conflict: true };
}

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

/**
 * Applies one already-validated RC event (grant/revoke/billing-issue) to Firestore. Split out
 * from the `onRequest` handler so tests can inject a fake `firestoreDb` (mirroring
 * `evaluation/core.js`'s `runEvaluation` convention) instead of exercising a live/emulated
 * Firestore transaction, matching this test suite's existing convention.
 */
async function processRevenueCatEvent(event, firestoreDb) {
  const eventId = event.id;
  const userId = event.app_user_id;
  const eventType = event.type;

  const logRef = firestoreDb.collection(FirestorePaths.WEBHOOK_LOGS).doc(`rc_${eventId}`);
  const userRef = firestoreDb.collection(FirestorePaths.USERS).doc(userId);
  const subscriptionRef = userRef
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

  return firestoreDb.runTransaction(async (transaction) => {
    const logDoc = await transaction.get(logRef);
    if (logDoc.exists) {
      return { idempotent: true };
    }

    // H4 (payment ecosystem hardening plan, Phase 4): a real signed-in user always has a
    // `users/{uid}` root doc (written client-side at account creation, `GitLiveUserRepository`) --
    // `event.app_user_id` reaching here with no such doc means RevenueCat's identity was never
    // actually linked to a real Firebase user, the exact "purchase before auth settles" race this
    // phase closes on the client side (`DefaultRevenueCatClient`/`UpgradeViewModel`). Rejecting
    // here instead of `transaction.set(subscriptionRef, ..., { merge: true })`'s previous
    // behavior -- which happily creates `users/{anonymous-rc-id}/data/subscription` for an id that
    // will never be read by any real signed-in session -- stops that from silently granting an
    // orphaned entitlement nobody can ever use or reconcile.
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      console.error(
        `RevenueCat webhook: app_user_id ${userId} has no users/{uid} doc -- rejecting rather than creating an orphan subscription doc`,
        { eventId, eventType }
      );
      return { rejected: 'unknown_app_user_id' };
    }

    const subscriptionDoc = await transaction.get(subscriptionRef);
    const existingData = subscriptionDoc.exists ? subscriptionDoc.data() : {};
    const existingStartDate = existingData.startDate || null;

    if (eventType === BILLING_ISSUE_EVENT_TYPE) {
      // RC's grace period is still active -- do NOT revoke tier here; EXPIRATION follows
      // automatically if the billing problem isn't resolved, and the reconciliation cron is
      // the real backstop. Field-only write so an unrelated platform's source/tier/expiryDate
      // is never touched by a billing-issue notification alone.
      console.warn(`RevenueCat webhook: user ${userId} has a billing issue (event ${eventType}) -- tier unchanged`);
      transaction.set(subscriptionRef, { billingIssueAt: Date.now() }, { merge: true });
      transaction.set(logRef, {
        eventId,
        userId,
        eventType,
        tier: existingData.tier || 'FREE',
        status: 'processed',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, tier: existingData.tier || 'FREE' };
    }

    const incoming = {
      source: 'REVENUECAT',
      tier: GRANT_EVENT_TYPES.has(eventType) ? entitlementIdsToTier(event.entitlement_ids) : 'FREE',
      expiryDate: event.expiration_at_ms || null
    };
    const existing = {
      source: existingData.source || null,
      tier: existingData.tier || 'FREE',
      expiryDate: existingData.expiryDate != null ? existingData.expiryDate : null
    };

    const resolved = resolveReconciliation(existing, incoming, Date.now());

    if (resolved.conflict) {
      console.error('RevenueCat webhook: cross-platform subscription conflict detected -- not overwriting', {
        userId,
        eventType,
        incoming,
        existing,
        resolvedTier: resolved.tier
      });
    }

    const writeData = {
      tier: resolved.tier,
      startDate: GRANT_EVENT_TYPES.has(eventType) ? existingStartDate || Date.now() : existingStartDate || 0,
      expiryDate: resolved.expiryDate,
      billingCycle: 'MONTHLY',
      // Marks this doc as owned by the mobile/RevenueCat path -- see `webhooks.js`'s
      // `applySubscriptionTier` doc comment for why this exists (dual-purchase gate).
      source: resolved.source,
      // A following GRANT/REVOKE clears any earlier billing-issue flag -- it's resolved either
      // way (the subscription renewed, or it's gone).
      billingIssueAt: null
    };
    if (resolved.conflict) {
      writeData.conflictDetectedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    transaction.set(subscriptionRef, writeData, { merge: true });

    transaction.set(logRef, {
      eventId,
      userId,
      eventType,
      tier: resolved.tier,
      status: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, tier: resolved.tier };
  });
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

  if (!GRANT_EVENT_TYPES.has(eventType) && !REVOKE_EVENT_TYPES.has(eventType) && eventType !== BILLING_ISSUE_EVENT_TYPE) {
    // Every other event type (CANCELLATION, TEST, paywall analytics, ...) doesn't change what
    // tier is granted right now -- CANCELLATION only turns off auto-renew, access continues
    // until the already-scheduled EXPIRATION event.
    return res.status(200).json({ status: 'ok', ignored: eventType });
  }

  try {
    const result = await processRevenueCatEvent(event, db);

    if (result.idempotent) {
      console.log(`Duplicate RevenueCat webhook event ${eventId} ignored (idempotent entry found)`);
      return res.status(200).json({ status: 'ok', idempotent: true });
    }

    if (result.rejected) {
      return res.status(200).json({ status: 'ok', warning: result.rejected });
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
exports.isSubscriptionActive = isSubscriptionActive;
exports.resolveReconciliation = resolveReconciliation;
exports.processRevenueCatEvent = processRevenueCatEvent;
