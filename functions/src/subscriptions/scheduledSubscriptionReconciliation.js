/**
 * Reconciliation safety-net cron (Dual-Platform Subscription Billing Hardening plan, Phase F).
 *
 * Phase 0 (read-side `expiryDate` derivation, `GitLiveSubscriptionRepository`/web's
 * `SubscriptionRepository.ts`) is the primary defense against a missed webhook -- an expired
 * doc already reads as FREE everywhere, even if this cron never ran. This function is the
 * cleanup/monitoring backstop: it downgrades the *stored* `tier` field itself so it stops lying
 * on disk, and every correction it makes is itself a signal that some webhook (RC or Razorpay)
 * was missed, worth alerting on.
 *
 * `USER_DATA_SUBCOLLECTION` ("data") is NOT exclusive to the subscription doc --
 * `GitLiveUserProfileRepository` stores user profile docs in the same `users/{uid}/data/{doc}`
 * subcollection (see firestore.rules' `match /data/{document}` comment: "for profile, settings,
 * etc"). A bare `collectionGroup('data')` query would therefore also scan profile docs. Scoped
 * here with `billingCycle == 'MONTHLY'`, a field only ever written by the subscription-tier
 * write paths (`applySubscriptionTier` in webhooks.js, `revenueCatWebhook.js`, and this same
 * file's Razorpay subscription-family handler) -- Firestore excludes documents missing a
 * filtered field, so profile docs (which never set `billingCycle`) never match, before the
 * `tier`/`expiryDate` filters even run.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('../generated/contracts.cjs');
const { deriveEffectiveTier } = require('../lib/effectiveTier');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Pure eligibility predicate, exported separately so it's testable without touching Firestore
 * query semantics at all -- mirrors the query's own filters (`tier != 'FREE' && expiryDate <
 * now`), used here as a defensive re-check on whatever the query actually returns. The actual
 * "is this doc stale" judgment is delegated to [deriveEffectiveTier] (H1, Phase 2) -- the same
 * function `eligibility.js` and both clients use -- so this predicate can never silently drift
 * from what a lapsed doc reads as everywhere else.
 */
function shouldReconcile(doc, now) {
  return (
    doc != null &&
    typeof doc.tier === 'string' &&
    doc.tier !== 'FREE' &&
    typeof doc.expiryDate === 'number' &&
    deriveEffectiveTier(doc.tier, doc.expiryDate, now) === 'FREE'
  );
}

// Scale-hardening follow-up to Phase F: an unbounded `collectionGroup` query with no page limit
// risks pulling the entire stale-doc set into function memory in one call. After an extended
// webhook outage across thousands of paid users, that single `.get()` could time out or OOM
// before finishing the sweep -- and since a naive retry would re-run the exact same query, the
// cron could never catch up. Pagination via `.limit()` bounds the work of any one invocation;
// `MAX_BATCHES_PER_RUN` bounds the total per-run cost even across many pages.
//
// No separate checkpoint/cursor doc is needed to resume across invocations: each downgrade write
// flips `tier` to 'FREE', which immediately drops that doc out of the `tier != 'FREE'` filter --
// so the *next* page (this run) or the *next scheduled tick* (if this run hits its cap) both
// naturally see only what's still unfixed. The persisted write itself is the checkpoint.
const BATCH_SIZE = 250;
const MAX_BATCHES_PER_RUN = 8; // up to 2000 docs/invocation at the default BATCH_SIZE

/**
 * Sweeps stale (`tier != FREE`, `expiryDate` in the past) subscription docs and downgrades them
 * to FREE, paginated in pages of `batchSize` up to `maxBatches` pages this invocation. Legacy
 * grandfathered Razorpay one-time-order docs (`expiryDate == null`) are naturally excluded --
 * Firestore's `<` comparison never matches a missing/null field.
 *
 * `source` is left untouched (historical record of which platform last owned the doc);
 * `billingIssueAt`/`willRenew` are reset so a downgraded doc doesn't carry stale pre-downgrade
 * metadata forward (senior-review fix #10).
 *
 * Returns `completed: false` when `maxBatches` was hit while a full page was still returned --
 * i.e. more stale docs likely remain. That's expected/handled, not an error: the next scheduled
 * run picks up where this one left off (see the pagination/checkpoint note above).
 */
async function reconcileStaleSubscriptions(db, now = Date.now(), { batchSize = BATCH_SIZE, maxBatches = MAX_BATCHES_PER_RUN } = {}) {
  let reconciledCount = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    const snapshot = await db
      .collectionGroup(FirestorePaths.USER_DATA_SUBCOLLECTION)
      .where('billingCycle', '==', 'MONTHLY')
      .where('tier', '!=', 'FREE')
      .where('expiryDate', '<', now)
      .limit(batchSize)
      .get();

    if (snapshot.docs.length === 0) {
      return { reconciledCount, completed: true };
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!shouldReconcile(data, now)) {
        continue;
      }

      await doc.ref.set(
        {
          tier: 'FREE',
          billingIssueAt: null,
          willRenew: false,
          reconciledAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      reconciledCount += 1;
      console.warn(
        `[scheduledSubscriptionReconciliation] downgraded stale subscription (source=${data.source || 'unknown'}, ` +
          `wasTier=${data.tier}, expiryDate=${data.expiryDate}) -- indicates a missed webhook`
      );
    }

    if (snapshot.docs.length < batchSize) {
      return { reconciledCount, completed: true };
    }
  }

  console.warn(
    `[scheduledSubscriptionReconciliation] hit maxBatches=${maxBatches} cap this run (reconciled ${reconciledCount}) -- ` +
      'remaining stale docs will be picked up by the next scheduled run'
  );
  return { reconciledCount, completed: false };
}

// Bumped from the implicit 60s/256MB default to 540s (Cloud Functions v1's ceiling) -- headroom
// for MAX_BATCHES_PER_RUN pages of sequential writes under a large stale-doc backlog. Mirrors
// tatEvaluate.js's documented precedent for extending a single function's timeout when its own
// bulk workload genuinely needs it (functions/CLAUDE.md).
exports.scheduledSubscriptionReconciliation = functions
  .runWith({ timeoutSeconds: 540 })
  .pubsub.schedule('every 6 hours')
  .onRun(async () => {
    const { reconciledCount, completed } = await reconcileStaleSubscriptions(admin.firestore());
    console.log(
      `[scheduledSubscriptionReconciliation] reconciled ${reconciledCount} stale subscription doc(s), completed=${completed}`
    );
    return null;
  });

exports.reconcileStaleSubscriptions = reconcileStaleSubscriptions;
exports.shouldReconcile = shouldReconcile;
exports.BATCH_SIZE = BATCH_SIZE;
exports.MAX_BATCHES_PER_RUN = MAX_BATCHES_PER_RUN;
