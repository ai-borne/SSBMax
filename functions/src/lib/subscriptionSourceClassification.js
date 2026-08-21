/**
 * Classifies a stored `users/{uid}/data/subscription` doc into one purchase-provenance tag
 * (Phase 10, Payment Ecosystem Hardening plan, issue 1). The support snapshot needs to
 * distinguish "no Razorpay purchase at all" from "a Razorpay-sourced doc that predates Phase 5's
 * subscriptionId-at-activation write and is therefore unverifiable against the Razorpay API" --
 * those rendered identically before this phase, and a support agent reading them as the same fact
 * is exactly how a ticket gets answered wrong. One pure function, one place this taxonomy exists;
 * `getSubscriptionSupportSnapshot.js` and the web-side panel both consume the tag it returns
 * rather than re-deriving it.
 *
 * No I/O -- pure judgment over an already-fetched doc, same discipline as `lib/effectiveTier.js`
 * and `lib/subscriptionDrift.js`.
 */

const SOURCE_KINDS = Object.freeze({
  RAZORPAY: 'RAZORPAY',
  RAZORPAY_INCOMPLETE: 'RAZORPAY_INCOMPLETE',
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
    return typeof stored?.subscriptionId === 'string' && stored.subscriptionId
      ? SOURCE_KINDS.RAZORPAY
      : SOURCE_KINDS.RAZORPAY_INCOMPLETE;
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
