/**
 * SSOT for "does this tier read as active right now" (H1, `docs/plans` payment-hardening plan,
 * Phase 2). Before this file, the rule `expiryDate != null && expiryDate < now ? FREE : tier` was
 * hand-copied three times -- KMP's `GitLiveSubscriptionRepository.deriveEffectiveTier`, web's
 * `SubscriptionRepository.ts` `deriveEffectiveTier`, and the reconciliation cron's
 * `shouldReconcile` predicate -- and `eligibility.js`, "the real gate at submission time" per its
 * own header, had no copy at all: a lapsed user's stored `PREMIUM` tier was honored for quota
 * purposes even past `expiryDate`, because only the *client-side* reads had been made
 * expiry-aware. This is the fourth copy, and the one every server-side consumer should now share.
 *
 * `null`/`undefined` `expiryDate` means "no expiry recorded" (legacy grandfathered docs, or the
 * FREE tier which never has one) -- the stored tier is honored as-is, never downgraded.
 */
function deriveEffectiveTier(tier, expiryDate, nowMillis) {
  return expiryDate != null && expiryDate < nowMillis ? 'FREE' : tier;
}

module.exports = { deriveEffectiveTier };
