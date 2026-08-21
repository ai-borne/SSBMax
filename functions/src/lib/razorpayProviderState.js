/**
 * Normalizes a raw Razorpay subscription entity (as returned by `lib/razorpayClient.js`'s
 * `getSubscription`) into the `{status, tier, expiryDate}` shape `resolveSubscriptionDrift`
 * already consumes (Phase 10, Payment Ecosystem Hardening plan, issue 2). The support snapshot's
 * cross-provider conflict check reuses Phase 7's drift comparison rather than inventing a second,
 * hand-typed one.
 *
 * Mirrors `scheduledRazorpayDriftSweep.js`'s `toProviderState` status mapping, extended from two
 * outcomes to three: `'active'` -> ACTIVE; `'cancelled'|'expired'|'completed'` -> CANCELLED (a
 * definite, known end -- distinct from "we don't know"); anything else (`'created'`,
 * `'authenticated'`, `'pending'`, `'halted'`, ...) -> UNKNOWN, matching `resolveSubscriptionDrift`'s
 * own fail-closed, NONE-on-ambiguity stance -- this file must not invent a second, looser mapping.
 *
 * `tier` is derived via the injected `planIdToTierFn` (`webhooks/paymentCaptured.js`'s
 * `planIdToTier`) -- no second hand-typed plan-id table (exactly the L4-class mistake this plan
 * has already flagged once). `expiryDate` is `current_end * 1000` (seconds -> millis), matching
 * `lib/razorpaySubscriptionWebhook.js`'s existing convention.
 *
 * No I/O -- pure, same discipline as `lib/subscriptionDrift.js` and
 * `lib/subscriptionSourceClassification.js`.
 */

function normalizeRazorpayProviderState(rawSubscription, planIdToTierFn) {
  const notes = rawSubscription?.notes || {};
  const rawStatus = rawSubscription?.status;

  const status =
    rawStatus === 'active'
      ? 'ACTIVE'
      : rawStatus === 'cancelled' || rawStatus === 'expired' || rawStatus === 'completed'
        ? 'CANCELLED'
        : 'UNKNOWN';

  return {
    status,
    tier: planIdToTierFn(notes.planId || 'pro_monthly'),
    expiryDate: typeof rawSubscription?.current_end === 'number' ? rawSubscription.current_end * 1000 : null
  };
}

module.exports = { normalizeRazorpayProviderState };
