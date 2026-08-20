/**
 * SSOT for cross-platform subscription drift repair (Phase 7, Payment Ecosystem Hardening plan).
 *
 * `scheduledSubscriptionReconciliation.js` only ever downgrades a stale doc to FREE -- there was
 * no path that detected "the provider (Razorpay/RevenueCat) says this subscription is active, but
 * Firestore says FREE (or a lower tier)". A missed grant/renewal webhook silently strands a paying
 * customer with no detection and no repair, which is commercially worse than a missed downgrade
 * (which merely leaks a little free access). `subscriptions/scheduledRazorpayDriftSweep.js`
 * (server-enumerable Razorpay) and `subscriptions/repairMobileEntitlement.js` (client-triggered,
 * RC-verified) both call this single pure function rather than hand-writing a second copy of the
 * drift rule -- this is exactly the H1 mistake (four hand-written copies of "is this tier still
 * active") this plan already spent a phase closing; see `lib/effectiveTier.js`'s doc comment.
 *
 * No I/O here by design -- every case is a same-tick judgment over two already-fetched states, so
 * it's testable without Firestore, HTTP, or a fake clock library (`functions/test/subscriptionDrift.test.js`).
 */

const { deriveEffectiveTier } = require('./effectiveTier');

const TIER_RANK = { FREE: 0, BASIC: 1, PRO: 2, PREMIUM: 3 };

/** Frozen action tags -- consumers switch on these, never on a hand-typed string literal. */
const DRIFT_ACTIONS = Object.freeze({
  /** No repair needed -- provider and stored state already agree, or the provider isn't reporting
   * an active subscription (fail-closed: never downgrades here, the existing cron owns that). */
  NONE: 'NONE',
  /** Provider reports a higher (or fresher-expiry, same-tier) entitlement than Firestore has on
   * record -- the "paid but locked out" case this phase exists for. Safe to write. */
  REPAIR_UP: 'REPAIR_UP',
  /** Provider reports an active subscription at a LOWER tier than what's already stored -- e.g. a
   * user with both a mobile and a web subscription. Never silently downgrade; surface it instead
   * (the existing dual-purchase gate assumes exactly this). */
  FLAG_CONFLICT: 'FLAG_CONFLICT'
});

/**
 * @param providerState `{ status: 'ACTIVE'|'CANCELLED'|'HALTED'|'UNKNOWN', tier, expiryDate }` as
 *   read straight from the provider (Razorpay subscription entity / RevenueCat CustomerInfo) --
 *   `tier`/`expiryDate` are only consulted when `status === 'ACTIVE'`. `null`/`undefined` is
 *   treated the same as `status: 'UNKNOWN'`.
 * @param storedState `{ tier, expiryDate }` as currently written to `users/{uid}/data/subscription`.
 * @param nowMillis epoch millis, passed in rather than read internally so this stays pure.
 * @returns `{ action, tier?, expiryDate? }` -- `tier`/`expiryDate` are only present on `REPAIR_UP`,
 *   and are exactly what the caller should write (the provider's values, never a merge/guess).
 */
function resolveSubscriptionDrift(providerState, storedState, nowMillis) {
  if (providerState == null || providerState.status !== 'ACTIVE' || !(providerState.tier in TIER_RANK)) {
    // Fail closed on any ambiguity (unknown/missing/non-active provider state): never revoke or
    // grant here. The downward cron already owns "provider says gone, stored is stale" via its
    // own expiry-based sweep -- this function's job is only the upward direction.
    return { action: DRIFT_ACTIONS.NONE };
  }

  const storedTier = storedState?.tier ?? 'FREE';
  const storedExpiry = storedState?.expiryDate ?? null;
  const storedEffectiveTier = deriveEffectiveTier(storedTier, storedExpiry, nowMillis);

  const providerRank = TIER_RANK[providerState.tier];
  const storedRank = TIER_RANK[storedEffectiveTier] ?? 0;

  if (providerRank > storedRank) {
    return { action: DRIFT_ACTIONS.REPAIR_UP, tier: providerState.tier, expiryDate: providerState.expiryDate ?? null };
  }

  if (providerRank < storedRank) {
    return { action: DRIFT_ACTIONS.FLAG_CONFLICT };
  }

  // Same effective tier -- still worth repairing if the provider's expiry is meaningfully later
  // than what's stored (a missed renewal/`subscription.charged` event leaves a stale expiry; the
  // user reads as fine today and locked out next week). FREE-vs-FREE is never repair-worthy.
  if (providerState.tier === 'FREE') {
    return { action: DRIFT_ACTIONS.NONE };
  }

  const providerExpiry = providerState.expiryDate ?? null;
  if (providerExpiry != null && (storedExpiry == null || providerExpiry > storedExpiry)) {
    return { action: DRIFT_ACTIONS.REPAIR_UP, tier: providerState.tier, expiryDate: providerExpiry };
  }

  return { action: DRIFT_ACTIONS.NONE };
}

module.exports = { resolveSubscriptionDrift, DRIFT_ACTIONS, TIER_RANK };
