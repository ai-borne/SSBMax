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

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Pure eligibility predicate, exported separately so it's testable without touching Firestore
 * query semantics at all -- mirrors the query's own filters (`tier != 'FREE' && expiryDate <
 * now`), used here as a defensive re-check on whatever the query actually returns.
 */
function shouldReconcile(doc, now) {
  return (
    doc != null &&
    typeof doc.tier === 'string' &&
    doc.tier !== 'FREE' &&
    typeof doc.expiryDate === 'number' &&
    doc.expiryDate < now
  );
}

/**
 * Sweeps every stale (`tier != FREE`, `expiryDate` in the past) subscription doc and downgrades
 * it to FREE. Legacy grandfathered Razorpay one-time-order docs (`expiryDate == null`) are
 * naturally excluded -- Firestore's `<` comparison never matches a missing/null field.
 *
 * `source` is left untouched (historical record of which platform last owned the doc);
 * `billingIssueAt`/`willRenew` are reset so a downgraded doc doesn't carry stale pre-downgrade
 * metadata forward (senior-review fix #10).
 */
async function reconcileStaleSubscriptions(db, now = Date.now()) {
  const snapshot = await db
    .collectionGroup(FirestorePaths.USER_DATA_SUBCOLLECTION)
    .where('billingCycle', '==', 'MONTHLY')
    .where('tier', '!=', 'FREE')
    .where('expiryDate', '<', now)
    .get();

  let reconciledCount = 0;

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

  return { reconciledCount };
}

exports.scheduledSubscriptionReconciliation = functions.pubsub.schedule('every 6 hours').onRun(async () => {
  const { reconciledCount } = await reconcileStaleSubscriptions(admin.firestore());
  console.log(`[scheduledSubscriptionReconciliation] reconciled ${reconciledCount} stale subscription doc(s)`);
  return null;
});

exports.reconcileStaleSubscriptions = reconcileStaleSubscriptions;
exports.shouldReconcile = shouldReconcile;
