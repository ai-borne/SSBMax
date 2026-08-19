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
// Reused, not duplicated, for Phase B's subscription-family events -- both this file and
// `revenueCatWebhook.js` need the identical "don't let a different, still-active source's
// write get clobbered" rule (see that file's `resolveReconciliation` doc comment).
const { resolveReconciliation } = require('./revenueCatWebhook');

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

/**
 * Writes the tier every real gating read path actually consults --
 * `users/{uid}/data/subscription` (`GitLiveSubscriptionRepository`/web's `SubscriptionRepository`/
 * `eligibility.js`, see Phase 3's `SubscriptionTierDto` schema) -- inside the same transaction as
 * the legacy `isPaidMember`/`membershipPlan` flags on the root `users/{uid}` doc.
 *
 * Amendment (found during Phase 3's deep check, Phase 4 RevenueCat integration plan): this
 * write never existed before -- a real Razorpay payment updated `isPaidMember` but never
 * `data/subscription.tier`, so a completed payment did not actually elevate the tier any real
 * gating check reads. `startDate` only gets set on a user's *first* transition into this tier
 * (an existing paid user's `startDate` is preserved across renewal webhooks), matching Phase 3's
 * billing-anniversary reset semantics -- a renewal must not reset the anniversary day.
 *
 * `source: 'RAZORPAY'` marks this doc as owned by the web/Razorpay payment path -- read by
 * `SubscriptionPage.tsx`'s dual-purchase gate (and `UpgradeViewModel.kt`'s KMP-side mirror) to
 * block a purchase on the *other* platform while a Razorpay-sourced tier is still active, since
 * neither webhook reconciles against what the other already wrote (last write wins otherwise).
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
 * Razorpay subscription-family events (Phase B, Razorpay Subscriptions API migration) -- these
 * ride the same webhook endpoint as `payment.captured` (one configured URL in the Razorpay
 * dashboard covers every subscribed event type).
 */
const RAZORPAY_SUBSCRIPTION_GRANT_EVENTS = new Set(['subscription.activated', 'subscription.charged']);
/** `refund.processed` gets identical treatment to `subscription.completed` -- both mean "this
 * entitlement is gone now", mirroring `revenueCatWebhook.js`'s REFUND/EXPIRATION pairing. */
const RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS = new Set(['subscription.completed', 'refund.processed']);
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
  const notes = subEntity?.notes || paymentEntity?.notes || {};
  return {
    userId: notes.userId || null,
    planId: notes.planId || null,
    // Razorpay timestamps are unix seconds; Firestore/JS convention here is epoch millis.
    currentEndMs: typeof subEntity?.current_end === 'number' ? subEntity.current_end * 1000 : null
  };
}

/**
 * Applies one already-validated Razorpay subscription-family event to Firestore. Mirrors
 * `revenueCatWebhook.js`'s `processRevenueCatEvent` shape (read idempotency log, transaction,
 * cross-cutting reconciliation, write `webhook_logs/{eventId}`) so both webhook handlers stay
 * readable side by side; split out from the `onRequest` handler so tests can inject a fake
 * `firestoreDb` instead of exercising a live/emulated transaction (this suite's existing
 * convention -- see `revenueCatWebhook.test.js`).
 */
async function processRazorpaySubscriptionEvent(eventType, payload, eventId, firestoreDb) {
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
    const existing = {
      source: existingData.source || null,
      tier: existingData.tier || 'FREE',
      expiryDate: existingData.expiryDate != null ? existingData.expiryDate : null
    };

    let writeData;
    let conflict = false;

    if (RAZORPAY_SUBSCRIPTION_GRANT_EVENTS.has(eventType) || RAZORPAY_SUBSCRIPTION_REVOKE_EVENTS.has(eventType)) {
      const isGrant = RAZORPAY_SUBSCRIPTION_GRANT_EVENTS.has(eventType);
      const incoming = {
        source: 'RAZORPAY',
        tier: isGrant ? planIdToTier(ctx.planId || 'pro_monthly') : 'FREE',
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
        billingIssueAt: null
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

    transaction.set(subscriptionRef, writeData, { merge: true });
    transaction.set(logRef, {
      eventId,
      userId: ctx.userId,
      eventType,
      status: 'processed',
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, tier: writeData.tier };
  });
}

/**
 * Handle Razorpay Webhooks (payment.captured, plus Phase B's subscription-family events)
 */
// DoW-defense cap (Phase 5, cost & scale guardrails) -- this endpoint is unauthenticated by
// nature (Razorpay calls it directly), so it had no instance ceiling at all before this.
// `secrets` pulls RAZORPAY_WEBHOOK_SECRET from Secret Manager, same as payments.js.
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
