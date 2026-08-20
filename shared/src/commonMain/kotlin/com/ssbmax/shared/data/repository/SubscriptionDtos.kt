package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestType
import kotlinx.serialization.Serializable

/**
 * Wire-format DTO for users/{userId}/data/subscription.
 *
 * `startDate`/`expiryDate`/`billingCycle` are new in Phase 3 (`docs/plans/
 * SubscriptionPricingRestructure.md` steps 4/5) -- the schema RevenueCat's webhooks (Phase 4)
 * will populate for real purchases. `startDate` (0 = unset) also drives the billing-anniversary
 * usage-reset key, see [com.ssbmax.shared.domain.usecase.subscription.currentPeriodKey].
 */
@Serializable
data class SubscriptionTierDto(
    val tier: String = "FREE",
    val startDate: Long = 0,
    val expiryDate: Long? = null,
    val billingCycle: String? = null,
    /** "RAZORPAY"/"REVENUECAT"/null -- which webhook last wrote this doc (Phase 4 amendment,
     * dual-purchase gate). Null for a doc predating this field, or a user who never purchased. */
    val source: String? = null,
    /** Whether the subscription auto-renews at `expiryDate` (Phase B, Razorpay Subscriptions API
     * migration -- `functions/src/webhooks.js`'s `subscription.cancelled`/`paused`/`resumed`
     * handlers flip this without touching `tier`/`expiryDate`). Defaults `true`, additive-safe
     * for docs predating this field -- a legacy doc with no lifecycle-webhook data is assumed
     * still auto-renewing until proven otherwise. */
    val willRenew: Boolean = true
) {
    fun toDomain(): SubscriptionTier = when (tier.uppercase()) {
        "BASIC" -> SubscriptionTier.BASIC
        "PRO" -> SubscriptionTier.PRO
        "PREMIUM" -> SubscriptionTier.PREMIUM
        else -> SubscriptionTier.FREE
    }
}

/**
 * Wire-format DTO for users/{userId}/subscription/usage_{yyyy-MM}.
 *
 * `userId`/`month`/`lastUpdated` exist only to satisfy firestore.rules' `subscription/{document}`
 * create rule (`hasAll(['month', ..., 'lastUpdated'])` + `data.userId == userId`) — they aren't
 * read back anywhere (GitLiveSubscriptionRepository.getMonthlyUsage only reads the counters).
 */
@Serializable
data class SubscriptionUsageDto(
    val userId: String = "",
    val month: String = "",
    val oirTestsUsed: Int = 0,
    val ppdtTestsUsed: Int = 0,
    val piqTestsUsed: Int = 0,
    val tatTestsUsed: Int = 0,
    val watTestsUsed: Int = 0,
    val srtTestsUsed: Int = 0,
    val sdTestsUsed: Int = 0,
    val gtoTestsUsed: Int = 0,
    val interviewTestsUsed: Int = 0,
    /** Stable submission IDs already charged for this month. */
    val recordedSubmissionIds: List<String> = emptyList(),
    val lastUpdated: Long = 0
)

/**
 * Test-type usage limits by tier — sourced from the generated
 * [SsbContracts.Subscription] table (contracts/subscription.yaml), which is
 * itself keyed on [TestType] enum names via each bucket's `testTypes` list.
 * Phase 3 (docs/plans/CrossPlatform_SSOT) rekeyed this off the old
 * display-string keys ("OIR Tests", "Self Description", ...) — a typo there
 * was a silent miss that couldn't be caught by the generator; a bucket name
 * derived from the contract can't drift from it.
 */
object SubscriptionLimits {
    private val limits: Map<String, Map<SubscriptionTier, Int>> =
        SsbContracts.Subscription.LIMITS.associate { limit ->
            limit.bucket to mapOf(
                SubscriptionTier.FREE to limit.free,
                SubscriptionTier.BASIC to limit.basic,
                SubscriptionTier.PRO to limit.pro,
                SubscriptionTier.PREMIUM to limit.premium
            )
        }

    val testTypeKeys: Set<String> get() = limits.keys

    fun limitFor(bucketKey: String, tier: SubscriptionTier): Int =
        limits[bucketKey]?.get(tier) ?: 0

    /**
     * Maps a [TestType] to its bucket key in [SsbContracts.Subscription.LIMITS]
     * (and [GitLiveSubscriptionRepository.getMonthlyUsage]'s `usedByKey` map) —
     * e.g. all 8 GTO sub-tests share the one "GTO" bucket, per the contract.
     * Used by [com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase]
     * to go from a [TestType] to this table's key.
     */
    fun keyFor(testType: TestType): String =
        SsbContracts.Subscription.LIMITS.first { testType.name in it.testTypes }.bucket
}
