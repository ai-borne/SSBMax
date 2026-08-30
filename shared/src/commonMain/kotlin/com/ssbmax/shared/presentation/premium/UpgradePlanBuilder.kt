package com.ssbmax.shared.presentation.premium

import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.ui.theme.TierColors

/**
 * Pure plan-card builder extracted out of [UpgradeViewModel] (Phase 12, 300-LOC split -- L5's
 * additions pushed that file past the cap). No behavior changed by this extraction.
 *
 * One card per [SubscriptionTier] (FREE/BASIC/PRO/PREMIUM) -- previously this listed
 * "Premium (AI)" and "Premium" as two separate cards for the same tier, an SSOT violation
 * flagged during the pricing restructure. Feature bullets come from [SubscriptionTier.features]
 * (itself generated from the contract, see `SubscriptionTier.kt`) rather than a fourth
 * hand-written copy, so this can't drift from the tier's real limits again.
 */
internal fun availableUpgradePlans(): List<SubscriptionPlan> = SubscriptionTier.entries.map(::planFor)

private data class PlanMeta(val name: String, val tagline: String, val isRecommended: Boolean)

private fun planFor(tier: SubscriptionTier): SubscriptionPlan {
    val meta = when (tier) {
        SubscriptionTier.FREE -> PlanMeta("Free", "Get Started with SSB Prep", isRecommended = false)
        SubscriptionTier.BASIC -> PlanMeta("Basic", "Build Your Foundation", isRecommended = false)
        SubscriptionTier.PRO -> PlanMeta("Pro", "Accelerate Your Preparation", isRecommended = true)
        SubscriptionTier.PREMIUM -> PlanMeta("Premium", "Complete SSB Solution", isRecommended = false)
    }
    return SubscriptionPlan(
        tier = tier,
        name = meta.name,
        tagline = meta.tagline,
        priceMonthly = tier.monthlyPriceInt.toDouble(),
        priceQuarterly = tier.quarterlyPriceInt?.toDouble() ?: 0.0,
        priceAnnually = tier.yearlyPriceInt?.toDouble() ?: 0.0,
        features = tier.features.map { PlanFeature(it, isIncluded = true) },
        isRecommended = meta.isRecommended,
        gradient = TierColors.gradient(tier)
    )
}
