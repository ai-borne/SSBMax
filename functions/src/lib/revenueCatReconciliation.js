/**
 * RevenueCat entitlement mapping + cross-platform reconciliation -- pure functions extracted out
 * of `revenueCatWebhook.js` (Phase 8, Payment Ecosystem Hardening plan) purely to keep that file
 * under the 300-LOC cap once Phase 8's alert wiring grew it past it. Mirrors Phase 3's identical
 * split of `webhooks.js` into a dispatcher plus `webhooks/paymentCaptured.js` -- same reasoning,
 * applied here. No behavior changed by this extraction.
 *
 * RevenueCat is the only writer of the tier doc (Razorpay retired 2026-09-25), so there is no
 * cross-platform reconciliation here: an incoming RC event always wins.
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
 * REFUND gets identical treatment to EXPIRATION -- both are "this entitlement is gone now".
 * SUBSCRIPTION_PAUSED (L3, Phase 12) is Google Play's explicit user-initiated pause -- a paused
 * Play subscription stops granting access immediately, so it belongs with the revokes, not a
 * field-only write. Before this fix it fell through the dispatcher's ignored-event-types filter
 * entirely and a paused user kept their tier indefinitely. */
const REVOKE_EVENT_TYPES = new Set(['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED']);

/** RC's grace-period signal -- entitlement isn't revoked yet (EXPIRATION follows automatically
 * if the billing problem isn't resolved), but worth surfacing so a reconciliation cron/dashboard
 * can flag it. Handled in its own branch rather than the generic grant/revoke sets. */
const BILLING_ISSUE_EVENT_TYPE = 'BILLING_ISSUE';

/** L3 (Phase 12): RC's ownership-transfer signal (e.g. Play Family Library, an account merge) --
 * structurally different from every other event type (it names OTHER users via
 * `transferred_from`/`transferred_to`, not just `event.app_user_id`), so it's handled by its own
 * `lib/revenueCatTransfer.js` path rather than the generic grant/revoke/billing-issue branches.
 * Before this fix it fell through the dispatcher's ignored-event-types filter and the original
 * owner kept their tier forever, even after RevenueCat moved the entitlement to someone else. */
const TRANSFER_EVENT_TYPE = 'TRANSFER';

/** A subscription with no expiry (fails closed to "still active", matching the RC-always-writes-
 * expiryDate-on-grant assumption used elsewhere) or a future expiry is still in force. */
function isSubscriptionActive(expiryDate, nowMillis) {
  return expiryDate == null || expiryDate > nowMillis;
}

module.exports = {
  entitlementIdsToTier,
  GRANT_EVENT_TYPES,
  REVOKE_EVENT_TYPES,
  BILLING_ISSUE_EVENT_TYPE,
  TRANSFER_EVENT_TYPE,
  isSubscriptionActive
};
