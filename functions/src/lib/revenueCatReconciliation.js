/**
 * RevenueCat entitlement mapping + cross-platform reconciliation -- pure functions extracted out
 * of `revenueCatWebhook.js` (Phase 8, Payment Ecosystem Hardening plan) purely to keep that file
 * under the 300-LOC cap once Phase 8's alert wiring grew it past it. Mirrors Phase 3's identical
 * split of `webhooks.js` into a dispatcher plus `webhooks/paymentCaptured.js` -- same reasoning,
 * applied here. No behavior changed by this extraction.
 *
 * `resolveReconciliation` is also consumed by `lib/razorpaySubscriptionWebhook.js` (Razorpay's
 * subscription-family events run the identical cross-platform conflict check) -- living in `lib/`
 * rather than inside `revenueCatWebhook.js` also fixes the slightly backwards layering that had a
 * `lib/` file importing from a top-level one.
 */

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
 * to-webhook reconciliation" section): neither `revenueCatWebhook.js` nor `webhooks.js`'s Razorpay
 * handler knows what the other already wrote, so without this a race/stale-tab/direct-API-call
 * scenario lets whichever webhook fires last silently clobber an active subscription from the
 * other platform. If the existing doc was written by a different, still-active source, keep
 * whichever side has the higher tier (or, tied, the later expiryDate) instead of blindly taking
 * `incoming`.
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

module.exports = {
  entitlementIdsToTier,
  GRANT_EVENT_TYPES,
  REVOKE_EVENT_TYPES,
  BILLING_ISSUE_EVENT_TYPE,
  TIER_RANK,
  isSubscriptionActive,
  resolveReconciliation
};
