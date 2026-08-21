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
const { FirestorePaths } = require('./generated/contracts.cjs');
const { emitOpsAlert, ALERT_KINDS, SEVERITIES } = require('./lib/opsAlert');
const {
  entitlementIdsToTier,
  GRANT_EVENT_TYPES,
  REVOKE_EVENT_TYPES,
  BILLING_ISSUE_EVENT_TYPE,
  TRANSFER_EVENT_TYPE,
  isSubscriptionActive,
  resolveReconciliation
} = require('./lib/revenueCatReconciliation');
const { processRevenueCatTransferEvent } = require('./lib/revenueCatTransfer');
const { verifySignature, SIGNATURE_FRESHNESS_WINDOW_MS } = require('./lib/revenueCatSignature');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

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
    const existingLastEventAtMs = typeof existingData.lastEventAtMs === 'number' ? existingData.lastEventAtMs : null;

    // M1 (Phase 11): RC's `event.event_timestamp_ms` is when the event actually happened, not when
    // this handler ran -- a fresher event (e.g. a RENEWAL) may have already applied by the time an
    // out-of-order-delivered older event (e.g. the EXPIRATION it superseded) arrives. `null` (no
    // timestamp on either side) skips the check rather than treating "unknown" as "stale".
    const eventAtMs = typeof event.event_timestamp_ms === 'number' ? event.event_timestamp_ms : null;
    if (eventAtMs != null && existingLastEventAtMs != null && eventAtMs < existingLastEventAtMs) {
      transaction.set(logRef, {
        eventId,
        userId,
        eventType,
        status: 'stale_ignored',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { stale: true, tier: existingData.tier || 'FREE' };
    }

    if (eventType === BILLING_ISSUE_EVENT_TYPE) {
      // RC's grace period is still active -- do NOT revoke tier here; EXPIRATION follows
      // automatically if the billing problem isn't resolved, and the reconciliation cron is
      // the real backstop. Field-only write so an unrelated platform's source/tier/expiryDate
      // is never touched by a billing-issue notification alone.
      console.warn(`RevenueCat webhook: user ${userId} has a billing issue (event ${eventType}) -- tier unchanged`);
      transaction.set(
        subscriptionRef,
        { billingIssueAt: Date.now(), ...(eventAtMs != null ? { lastEventAtMs: eventAtMs } : {}) },
        { merge: true }
      );
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
    if (eventAtMs != null) {
      writeData.lastEventAtMs = eventAtMs;
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

    return { success: true, tier: resolved.tier, conflict: resolved.conflict, userId };
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
    await emitOpsAlert(db, {
      kind: ALERT_KINDS.SIGNATURE_VERIFICATION_FAILED,
      severity: SEVERITIES.HIGH,
      detail: { provider: 'REVENUECAT' }
    });
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

  if (
    !GRANT_EVENT_TYPES.has(eventType) &&
    !REVOKE_EVENT_TYPES.has(eventType) &&
    eventType !== BILLING_ISSUE_EVENT_TYPE &&
    eventType !== TRANSFER_EVENT_TYPE
  ) {
    // Every other event type (CANCELLATION, TEST, paywall analytics, ...) doesn't change what
    // tier is granted right now -- CANCELLATION only turns off auto-renew, access continues
    // until the already-scheduled EXPIRATION event.
    return res.status(200).json({ status: 'ok', ignored: eventType });
  }

  try {
    // L3 (Phase 12): TRANSFER names OTHER users (transferred_from/transferred_to), not just
    // event.app_user_id -- it needs its own multi-doc transaction, not the generic single-doc path.
    if (eventType === TRANSFER_EVENT_TYPE) {
      const transferResult = await processRevenueCatTransferEvent(event, db);
      if (transferResult.idempotent) {
        console.log(`Duplicate RevenueCat webhook event ${eventId} ignored (idempotent entry found)`);
      } else {
        console.log(`RevenueCat webhook: TRANSFER revoked ${transferResult.revokedUserIds.length} prior owner(s) (${eventId})`);
      }
      return res.status(200).json({ status: 'ok' });
    }

    const result = await processRevenueCatEvent(event, db);

    if (result.idempotent) {
      console.log(`Duplicate RevenueCat webhook event ${eventId} ignored (idempotent entry found)`);
      return res.status(200).json({ status: 'ok', idempotent: true });
    }

    if (result.rejected) {
      return res.status(200).json({ status: 'ok', warning: result.rejected });
    }

    if (result.stale) {
      console.warn(`RevenueCat webhook: event ${eventType} (${eventId}) is older than the last applied event -- ignored`);
      return res.status(200).json({ status: 'ok', stale: true });
    }

    if (result.conflict) {
      await emitOpsAlert(db, {
        kind: ALERT_KINDS.WEBHOOK_RECONCILIATION_CONFLICT,
        severity: SEVERITIES.HIGH,
        userId,
        detail: { source: 'REVENUECAT', eventType, resolvedTier: result.tier }
      });
    }

    console.log(`RevenueCat webhook: user ${userId} -> ${result.tier} (event ${eventType})`);
    return res.status(200).json({ status: 'ok' });
  } catch (txError) {
    console.error('Transaction error during RevenueCat webhook processing:', txError);
    return res.status(500).json({ status: 'error', message: 'Internal processing error' });
  }
});

// Re-exported for backward compatibility -- these now live in lib/revenueCatReconciliation.js
// (Phase 8's 300-LOC split) or lib/revenueCatSignature.js (Phase 12's), but every existing
// test/caller imports them from this module.
exports.entitlementIdsToTier = entitlementIdsToTier;
exports.verifySignature = verifySignature;
exports.SIGNATURE_FRESHNESS_WINDOW_MS = SIGNATURE_FRESHNESS_WINDOW_MS;
exports.isSubscriptionActive = isSubscriptionActive;
exports.resolveReconciliation = resolveReconciliation;
exports.processRevenueCatEvent = processRevenueCatEvent;
exports.TRANSFER_EVENT_TYPE = TRANSFER_EVENT_TYPE;
exports.processRevenueCatTransferEvent = processRevenueCatTransferEvent;
