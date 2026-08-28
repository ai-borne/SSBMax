/**
 * Razorpay upward drift-repair sweep (Phase 7, Payment Ecosystem Hardening plan).
 *
 * `scheduledSubscriptionReconciliation.js` only ever downgrades. Razorpay's `GET
 * /v1/subscriptions` enumerates every subscription ever created for this account -- unlike
 * RevenueCat, there's no need for a client-triggered detector on the web side, so this is a
 * server-only scheduled sweep (see `subscriptions/repairMobileEntitlement.js` for RevenueCat's
 * client-triggered counterpart and why the two mechanisms differ).
 *
 * **No server-side status filter exists.** Verified against Razorpay's API reference
 * (razorpay.com/docs/api/payments/subscriptions/fetch-subscriptions): the list endpoint accepts
 * only `plan_id`/`from`/`to`/`count`/`skip` -- there is no `status` query parameter (an earlier
 * version of this sweep sent `status=active`, which Razorpay silently ignores rather than
 * rejecting, so it looked like it worked while actually doing nothing). `toProviderState` below
 * filters on each returned entity's own `status` field instead -- see `lib/razorpayClient.js`'s
 * `listSubscriptions` doc comment. Practical consequence: this sweep pages through the account's
 * FULL subscription history every run, not just active ones, so its cost grows with total
 * lifetime subscription count, not active-subscriber count. Not addressed in this phase -- there
 * is no cheap way to bound it further without risking silently never repairing an old
 * reactivated subscription; `from`/`to` date-windowing is the likely fix but needs a deliberate
 * choice of window size against real subscription-count growth, deferred to a later phase.
 *
 * Every repair decision goes through `lib/subscriptionDrift.js`'s `resolveSubscriptionDrift` --
 * this file's job is only enumeration + I/O, never re-deriving the drift rule itself (SSOT, same
 * discipline `lib/effectiveTier.js` and `scheduledSubscriptionReconciliation.js`'s `shouldReconcile`
 * already follow).
 *
 * Runs less often than the downward cron (daily, not every 6 hours) -- this is repair, not a hot
 * path, and every page costs one Razorpay API call; no need to pay that cost more than daily.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { planIdToTier } = require('../webhooks');
const { listSubscriptions } = require('../lib/razorpayClient');
const { resolveSubscriptionDrift, DRIFT_ACTIONS } = require('../lib/subscriptionDrift');
const { emitOpsAlert, ALERT_KINDS, SEVERITIES } = require('../lib/opsAlert');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Mirrors `scheduledSubscriptionReconciliation.js`'s BATCH_SIZE/MAX_BATCHES_PER_RUN bounding --
// same "the persisted write is the checkpoint" reasoning does NOT apply here (an entity Razorpay
// returns stays in this unfiltered list forever, active or not, so a repaired doc never drops out
// of it the way a downgraded doc drops out of the Firestore query), so this sweep is a plain page
// cursor (`skip`), not a self-checkpointing one -- an incomplete run simply repeats already-fixed
// (now no-op, `NONE`-action) entries on its next scheduled tick, which is cheap (one Firestore
// read, no write) compared to the alternative of hand-rolling cursor persistence for a run that in
// practice finishes well within the cap.
const PAGE_SIZE = 100;
const MAX_PAGES_PER_RUN = 10; // up to 1000 Razorpay subscriptions/invocation (any status; see file header)

/**
 * One Razorpay subscription entity -> the `{status, tier, expiryDate, subscriptionId}` shape
 * `resolveSubscriptionDrift` consumes (`subscriptionId` passes straight through unused by drift
 * resolution itself -- `applyDrift` below writes it into the repaired doc so a REPAIR_UP never
 * produces a `source: 'RAZORPAY'` doc with no `subscriptionId`, which `getSubscriptionSupportSnapshot`'s
 * `dataIncomplete`/`missing-subscription-id` check would otherwise immediately flag). `status` maps
 * only Razorpay's own `'active'` to `'ACTIVE'`
 * (every other status -- cancelled, expired, halted, ... -- becomes `'UNKNOWN'`, which
 * `resolveSubscriptionDrift` always resolves to `NONE`) since the list endpoint has no
 * server-side status filter (see file header) -- this is where that filtering actually happens.
 * `notes.planId` is the app's own planId (`pro_monthly`, echoed back by Razorpay from
 * subscription-creation time, see `razorpaySubscriptions.js`), fed through the same
 * `planIdToTier` webhooks.js already uses -- not a second hand-typed mapping.
 */
function toProviderState(subscriptionEntity) {
  const notes = subscriptionEntity?.notes || {};
  return {
    userId: notes.userId || null,
    providerState: {
      status: subscriptionEntity?.status === 'active' ? 'ACTIVE' : 'UNKNOWN',
      tier: planIdToTier(notes.planId || 'pro_monthly'),
      expiryDate: typeof subscriptionEntity?.current_end === 'number' ? subscriptionEntity.current_end * 1000 : null,
      subscriptionId: subscriptionEntity?.id || null
    }
  };
}

async function readStoredSubscription(firestoreDb, userId) {
  const doc = await firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID)
    .get();
  const data = doc.exists ? doc.data() : {};
  return {
    tier: data.tier || 'FREE',
    expiryDate: data.expiryDate != null ? data.expiryDate : null,
    startDate: data.startDate || null
  };
}

async function applyDrift(firestoreDb, userId, providerState, stored, nowMillis) {
  const drift = resolveSubscriptionDrift(providerState, stored, nowMillis);

  if (drift.action === DRIFT_ACTIONS.REPAIR_UP) {
    const subscriptionRef = firestoreDb
      .collection(FirestorePaths.USERS)
      .doc(userId)
      .collection(FirestorePaths.USER_DATA_SUBCOLLECTION)
      .doc(FirestorePaths.USER_SUBSCRIPTION_TIER_DOC_ID);

    await subscriptionRef.set(
      {
        tier: drift.tier,
        startDate: stored.startDate || nowMillis,
        expiryDate: drift.expiryDate,
        billingCycle: 'MONTHLY',
        source: 'RAZORPAY',
        subscriptionId: providerState.subscriptionId || null,
        willRenew: true,
        billingIssueAt: null
      },
      { merge: true }
    );
    await emitOpsAlert(firestoreDb, {
      kind: ALERT_KINDS.DRIFT_REPAIR,
      severity: SEVERITIES.INFO,
      userId,
      detail: { repairedTier: drift.tier, expiryDate: drift.expiryDate, storedTier: stored.tier, source: 'RAZORPAY_SWEEP' }
    });
    return 'repaired';
  }

  if (drift.action === DRIFT_ACTIONS.FLAG_CONFLICT) {
    await emitOpsAlert(firestoreDb, {
      kind: ALERT_KINDS.DRIFT_CONFLICT,
      severity: SEVERITIES.HIGH,
      userId,
      detail: { providerTier: providerState.tier, storedTier: stored.tier, source: 'RAZORPAY_SWEEP' }
    });
    return 'conflict';
  }

  return 'none';
}

/**
 * Sweeps up to `maxPages * pageSize` Razorpay subscriptions (every status -- see file header) and
 * repairs any currently-active one that's stranded ahead of Firestore. A Razorpay API failure on
 * any page aborts the whole run immediately -- no further pages are fetched and nothing on the
 * failed (or later) page is written, so a transient Razorpay outage never has a chance to be
 * misread as "nothing is active."
 */
async function sweepRazorpayDrift(firestoreDb, fetchImpl, { keyId, keySecret }, nowMillis = Date.now(), { pageSize = PAGE_SIZE, maxPages = MAX_PAGES_PER_RUN } = {}) {
  let repairedCount = 0;
  let conflictCount = 0;
  let scannedCount = 0;

  for (let page = 0; page < maxPages; page++) {
    let response;
    try {
      response = await listSubscriptions(fetchImpl, { keyId, keySecret, count: pageSize, skip: page * pageSize });
    } catch (apiError) {
      console.error('scheduledRazorpayDriftSweep: Razorpay API call failed, aborting run without further writes', apiError);
      return { repairedCount, conflictCount, scannedCount, completed: false, aborted: true };
    }

    const items = response?.items || [];
    for (const subscriptionEntity of items) {
      const { userId, providerState } = toProviderState(subscriptionEntity);
      // Skip non-active entities (and ones with no notes.userId) before touching Firestore at
      // all -- most of the account's lifetime subscription history is cancelled/expired, and
      // resolveSubscriptionDrift would return NONE for it anyway, so this saves a wasted read.
      if (!userId || providerState.status !== 'ACTIVE') {
        continue;
      }
      scannedCount += 1;
      const stored = await readStoredSubscription(firestoreDb, userId);
      const outcome = await applyDrift(firestoreDb, userId, providerState, stored, nowMillis);
      if (outcome === 'repaired') repairedCount += 1;
      if (outcome === 'conflict') conflictCount += 1;
    }

    if (items.length < pageSize) {
      return { repairedCount, conflictCount, scannedCount, completed: true, aborted: false };
    }
  }

  console.warn(`scheduledRazorpayDriftSweep: hit maxPages=${maxPages} cap this run (repaired ${repairedCount}) -- remainder picked up next scheduled run`);
  return { repairedCount, conflictCount, scannedCount, completed: false, aborted: false };
}

// 540s ceiling, same rationale as `scheduledSubscriptionReconciliation.js`'s identical comment --
// headroom for MAX_PAGES_PER_RUN sequential Razorpay API calls plus per-user Firestore reads.
exports.scheduledRazorpayDriftSweep = functions
  .runWith({ timeoutSeconds: 540, secrets: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] })
  .pubsub.schedule('every 24 hours')
  .onRun(async () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.error('scheduledRazorpayDriftSweep: RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing, skipping run');
      return null;
    }
    const result = await sweepRazorpayDrift(admin.firestore(), fetch, { keyId, keySecret });
    console.log(
      `scheduledRazorpayDriftSweep: scanned ${result.scannedCount}, repaired ${result.repairedCount}, ` +
        `flagged ${result.conflictCount} conflict(s), completed=${result.completed}, aborted=${result.aborted}`
    );
    return null;
  });

exports.sweepRazorpayDrift = sweepRazorpayDrift;
exports.toProviderState = toProviderState;
exports.PAGE_SIZE = PAGE_SIZE;
exports.MAX_PAGES_PER_RUN = MAX_PAGES_PER_RUN;
