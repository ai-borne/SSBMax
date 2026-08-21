/**
 * Razorpay Subscription Webhook Event Processing
 *
 * Handles subscription-family lifecycle events (activated, charged, completed,
 * cancelled, halted, paused, resumed, refund.processed) with idempotent logging
 * and cross-platform reconciliation.
 */

const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { resolveReconciliation } = require('./revenueCatReconciliation');

/**
 * Razorpay subscription-family events (Phase B, Razorpay Subscriptions API migration) -- these
 * ride the same webhook endpoint as `payment.captured` (one configured URL in the Razorpay
 * dashboard covers every subscribed event type).
 */
const RAZORPAY_SUBSCRIPTION_GRANT_EVENTS = new Set(['subscription.activated', 'subscription.charged']);
/** `refund.processed` gets identical treatment to `subscription.completed` -- both mean "this
 * entitlement is gone now", mirroring `revenueCatWebhook.js`'s REFUND/EXPIRATION pairing. */
const RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS = new Set(['subscription.completed', 'refund.processed']);
/** Pulled out of `RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS` as its own name (M4, Phase 11) -- it's the
 * one revoke event that isn't unconditional; see `isFullRefund`'s doc comment. */
const RAZORPAY_SUBSCRIPTION_REFUND_EVENT = 'refund.processed';
const RAZORPAY_SUBSCRIPTION_HALT_EVENT = 'subscription.halted';
const RAZORPAY_SUBSCRIPTION_CANCEL_EVENT = 'subscription.cancelled';
const RAZORPAY_SUBSCRIPTION_PAUSE_EVENT = 'subscription.paused';
const RAZORPAY_SUBSCRIPTION_RESUME_EVENT = 'subscription.resumed';
const RAZORPAY_SUBSCRIPTION_EVENT_TYPES = new Set([
  ...RAZORPAY_SUBSCRIPTION_GRANT_EVENTS,
  ...RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS,
  RAZORPAY_SUBSCRIPTION_HALT_EVENT,
  RAZORPAY_SUBSCRIPTION_CANCEL_EVENT,
  RAZORPAY_SUBSCRIPTION_PAUSE_EVENT,
  RAZORPAY_SUBSCRIPTION_RESUME_EVENT
]);

/**
 * Pulls `{userId, planId}` out of a subscription-family event's payload. `notes` were set at
 * subscription-creation time (`razorpaySubscriptions.js`'s `createRazorpaySubscription`, mirroring
 * `payments.js`'s `createRazorpayOrder` notes convention) and Razorpay echoes them back on both
 * the `subscription.entity` (subscription.* events) and `payment.entity` (`refund.processed`,
 * which carries a payment entity alongside the refund entity, not a subscription entity).
 */
function extractRazorpaySubscriptionContext(payload) {
  const subEntity = payload?.subscription?.entity || null;
  const paymentEntity = payload?.payment?.entity || null;
  const refundEntity = payload?.refund?.entity || null;
  const notes = subEntity?.notes || paymentEntity?.notes || {};
  return {
    userId: notes.userId || null,
    planId: notes.planId || null,
    // Razorpay timestamps are unix seconds; Firestore/JS convention here is epoch millis.
    currentEndMs: typeof subEntity?.current_end === 'number' ? subEntity.current_end * 1000 : null,
    // Phase 5 (H5a): only present on subscription.* events (subEntity), not the
    // payment.entity-shaped refund.processed -- `razorpaySubscriptionCancel.js`'s
    // `cancelRazorpaySubscription` callable needs this to know what to target.
    subscriptionId: subEntity?.id || null,
    // M4 (Phase 11): `refund.processed` carries both the payment it refunds and the refund itself
    // in the same payload -- comparing the two is what tells a partial (goodwill/dispute) refund
    // apart from a full refund of the charge that funded the current period.
    paymentAmount: typeof paymentEntity?.amount === 'number' ? paymentEntity.amount : null,
    refundAmount: typeof refundEntity?.amount === 'number' ? refundEntity.amount : null
  };
}

/**
 * M4 (Phase 11): a refund only "backs the current period" -- i.e. only earns a full revoke -- when
 * it refunds the entire payment that funded it. A partial refund (a goodwill credit, a dispute
 * settled for less than the full charge) must not revoke access the user is still meant to have
 * for the period they already paid for. Fails safe toward NOT revoking when either amount is
 * unknown (Rule 6) -- an unconditional revoke on incomplete data is exactly M4's original defect.
 */
function isFullRefund(paymentAmount, refundAmount) {
  return typeof paymentAmount === 'number' && typeof refundAmount === 'number' && refundAmount >= paymentAmount;
}

/**
 * Applies one already-validated Razorpay subscription-family event to Firestore. Mirrors
 * `revenueCatWebhook.js`'s `processRevenueCatEvent` shape (read idempotency log, transaction,
 * cross-cutting reconciliation, write `webhook_logs/{eventId}`) so both webhook handlers stay
 * readable side by side; split out from the `onRequest` handler so tests can inject a fake
 * `firestoreDb` instead of exercising a live/emulated transaction (this suite's existing
 * convention -- see `revenueCatWebhook.test.js`).
 *
 * M1 (Phase 11): `eventAtMs` is the webhook envelope's own `created_at` (Razorpay's event-creation
 * timestamp, not this function's call time) -- when it's older than the subscription doc's stored
 * `lastEventAtMs`, this event arrived out of order behind one already applied and is ignored
 * rather than potentially reverting a fresher state. `null` (unknown timestamp) skips the check
 * entirely rather than treating "unknown" as "definitely stale".
 */
async function processRazorpaySubscriptionEvent(eventType, payload, eventId, firestoreDb, planIdToTierFn, eventAtMs = null) {
  const ctx = extractRazorpaySubscriptionContext(payload);
  if (!ctx.userId) {
    return { warning: 'missing_user_id' };
  }

  // Separate namespace (`rzp_sub_`) from `payment.captured`'s raw-eventId dedup keys and from
  // `revenueCatWebhook.js`'s `rc_` prefix -- Razorpay's event IDs are globally unique, but this
  // keeps the three webhook families' log docs unambiguous to a human reading `webhook_logs/`.
  const logRef = firestoreDb.collection(FirestorePaths.WEBHOOK_LOGS).doc(`rzp_sub_${eventId}`);
  const userRef = firestoreDb.collection(FirestorePaths.USERS).doc(ctx.userId);
  const subscriptionRef = userRef
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

  return firestoreDb.runTransaction(async (transaction) => {
    const logDoc = await transaction.get(logRef);
    if (logDoc.exists) {
      return { idempotent: true };
    }

    const subscriptionDoc = await transaction.get(subscriptionRef);
    const existingData = subscriptionDoc.exists ? subscriptionDoc.data() : {};
    const existingStartDate = existingData.startDate || null;
    const existingLastEventAtMs = typeof existingData.lastEventAtMs === 'number' ? existingData.lastEventAtMs : null;
    const existing = {
      source: existingData.source || null,
      tier: existingData.tier || 'FREE',
      expiryDate: existingData.expiryDate != null ? existingData.expiryDate : null
    };

    if (eventAtMs != null && existingLastEventAtMs != null && eventAtMs < existingLastEventAtMs) {
      transaction.set(logRef, {
        eventId,
        userId: ctx.userId,
        eventType,
        status: 'stale_ignored',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { stale: true, tier: existing.tier, userId: ctx.userId };
    }

    let writeData;
    let conflict = false;

    // M4 (Phase 11): `refund.processed` only earns a full revoke when the refund actually covers
    // the whole payment that funded the current period -- a partial refund (goodwill credit,
    // dispute settled for less) must not strip access the user already paid for.
    const isPartialRefund = eventType === RAZORPAY_SUBSCRIPTION_REFUND_EVENT && !isFullRefund(ctx.paymentAmount, ctx.refundAmount);

    if (isPartialRefund) {
      console.warn(
        `Razorpay subscription webhook: partial refund for user ${ctx.userId} (paid=${ctx.paymentAmount}, refunded=${ctx.refundAmount}) -- not revoking, refund does not cover the full period charge`
      );
      writeData = { partialRefundAt: Date.now() };
    } else if (RAZORPAY_SUBSCRIPTION_GRANT_EVENTS.has(eventType) || RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS.has(eventType)) {
      const isGrant = RAZORPAY_SUBSCRIPTION_GRANT_EVENTS.has(eventType);
      const incoming = {
        source: 'RAZORPAY',
        tier: isGrant ? planIdToTierFn(ctx.planId || 'pro_monthly') : 'FREE',
        expiryDate: ctx.currentEndMs != null ? ctx.currentEndMs : existing.expiryDate
      };
      const resolved = resolveReconciliation(existing, incoming, Date.now());
      conflict = resolved.conflict;
      writeData = {
        tier: resolved.tier,
        startDate: isGrant ? (existingStartDate || Date.now()) : (existingStartDate || 0),
        expiryDate: resolved.expiryDate,
        billingCycle: 'MONTHLY',
        source: resolved.source,
        // activated/charged (re)establish auto-renew; completed/refund.processed are a natural/
        // forced end -- willRenew off either way, mirroring RC's grant/revoke tier split.
        willRenew: isGrant,
        // A following grant/revoke clears any earlier billing-issue flag, same as RC's handling.
        billingIssueAt: null,
        // Phase 5 (H5a): persisted at activation so `cancelRazorpaySubscription` has something to
        // target -- Razorpay's cancel API is `POST /v1/subscriptions/{id}/cancel`, id-addressed,
        // not user-addressed. Kept (not cleared) on revoke so a completed/refunded subscription's
        // id remains visible for support lookups; only ever overwritten by a newer grant.
        ...(ctx.subscriptionId != null ? { subscriptionId: ctx.subscriptionId } : {})
      };
      if (conflict) {
        writeData.conflictDetectedAt = admin.firestore.FieldValue.serverTimestamp();
        console.error('Razorpay subscription webhook: cross-platform subscription conflict detected -- not overwriting', {
          userId: ctx.userId,
          eventType,
          incoming,
          existing,
          resolvedTier: resolved.tier
        });
      }
    } else if (eventType === RAZORPAY_SUBSCRIPTION_HALT_EVENT) {
      // Razorpay's grace period is still active -- do NOT revoke tier here; `completed` follows
      // automatically if unresolved, and Phase F's cron is the real backstop. Field-only write,
      // same rationale as `revenueCatWebhook.js`'s BILLING_ISSUE branch.
      console.warn(`Razorpay subscription webhook: user ${ctx.userId} has a billing issue (event ${eventType}) -- tier unchanged`);
      writeData = { billingIssueAt: Date.now() };
    } else if (eventType === RAZORPAY_SUBSCRIPTION_CANCEL_EVENT || eventType === RAZORPAY_SUBSCRIPTION_PAUSE_EVENT) {
      // `cancelled`/`paused` only turn off auto-renew -- access continues until `current_end`,
      // mirroring RC's "CANCELLATION only turns off auto-renew" semantics (see
      // `revenueCatWebhook.js`'s dispatch comment for the identical RC-side rule).
      writeData = { willRenew: false };
    } else if (eventType === RAZORPAY_SUBSCRIPTION_RESUME_EVENT) {
      writeData = { willRenew: true };
    } else {
      return { ignored: eventType };
    }

    if (eventAtMs != null) {
      writeData.lastEventAtMs = eventAtMs;
    }

    transaction.set(subscriptionRef, writeData, { merge: true });
    transaction.set(logRef, {
      eventId,
      userId: ctx.userId,
      eventType,
      status: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, tier: writeData.tier, conflict, userId: ctx.userId };
  });
}

module.exports = {
  RAZORPAY_SUBSCRIPTION_GRANT_EVENTS,
  RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS,
  RAZORPAY_SUBSCRIPTION_REFUND_EVENT,
  RAZORPAY_SUBSCRIPTION_HALT_EVENT,
  RAZORPAY_SUBSCRIPTION_CANCEL_EVENT,
  RAZORPAY_SUBSCRIPTION_PAUSE_EVENT,
  RAZORPAY_SUBSCRIPTION_RESUME_EVENT,
  RAZORPAY_SUBSCRIPTION_EVENT_TYPES,
  extractRazorpaySubscriptionContext,
  isFullRefund,
  processRazorpaySubscriptionEvent
};
