/**
 * Classifies a stored `users/{uid}/data/subscription` doc into one purchase-provenance tag
 * (Phase 10, Payment Ecosystem Hardening plan, issue 1). Razorpay was retired 2026-09-25 and
 * RevenueCat is the only writer, so `RAZORPAY` survives only as a legacy provenance tag on docs
 * written before then -- informational; nothing queries Razorpay any more. A support agent must
 * still be able to tell it apart from "no purchase at all". One pure function, one place this taxonomy exists;
 * `getSubscriptionSupportSnapshot.js` and the web-side panel both consume the tag it returns
 * rather than re-deriving it.
 *
 * No I/O -- pure judgment over an already-fetched doc, same discipline as `lib/effectiveTier.js`
 * and `lib/subscriptionDrift.js`.
 */

const SOURCE_KINDS = Object.freeze({
  LEGACY_RAZORPAY: 'LEGACY_RAZORPAY',
  REVENUECAT: 'REVENUECAT',
  LEGACY_OR_UNKNOWN: 'LEGACY_OR_UNKNOWN',
  NONE: 'NONE'
});

/**
 * @param stored the Firestore `data/subscription` doc's data (or `{ exists: false, tier: 'FREE' }`
 *   for a user with none) -- the same shape `readFirestoreSubscription` returns.
 */
function classifySubscriptionSource(stored) {
  const source = stored?.source;

  if (source === 'RAZORPAY') {
    return SOURCE_KINDS.LEGACY_RAZORPAY;
  }

  if (source === 'REVENUECAT') {
    return SOURCE_KINDS.REVENUECAT;
  }

  if (source == null) {
    return stored?.tier === 'FREE' ? SOURCE_KINDS.NONE : SOURCE_KINDS.LEGACY_OR_UNKNOWN;
  }

  return SOURCE_KINDS.LEGACY_OR_UNKNOWN;
}

module.exports = { classifySubscriptionSource, SOURCE_KINDS };
