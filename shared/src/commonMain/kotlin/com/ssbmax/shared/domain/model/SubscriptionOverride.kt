package com.ssbmax.shared.domain.model

/**
 * Dev-only override of the tier that eligibility/usage reads see, independent
 * of what's actually stored for the signed-in user. `FORCE_PREMIUM` subsumes
 * the old `BYPASS_SUBSCRIPTION_LIMITS` flag: [SubscriptionTier.PREMIUM] already
 * maps to unlimited for every test type except Interview, so no separate
 * "unlimited" value is needed here.
 */
enum class SubscriptionOverride {
    FOLLOW_REAL,
    FORCE_FREE,
    FORCE_BASIC,
    FORCE_PRO,
    FORCE_PREMIUM
}
