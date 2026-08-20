package com.ssbmax.shared.presentation.premium

import com.ssbmax.shared.domain.model.BillingCycle
import com.ssbmax.shared.domain.model.SubscriptionTier
import androidx.compose.ui.graphics.Color

/**
 * Screen-state types for [UpgradeViewModel] and `UpgradeScreen`. Split out of `UpgradeViewModel.kt`
 * in Phase 1 of the Payment Ecosystem Hardening plan: that file was at 341 lines, over the repo's
 * 300-LOC cap (root CLAUDE.md "Quality Limits"). These are the state shapes, the ViewModel is the
 * behavior -- the same seam the sibling `SubscriptionManagementViewModel`/`SubscriptionPlanCards`
 * split follows.
 */

/**
 * UI State for Upgrade Screen
 */
data class UpgradeUiState(
    val currentTier: SubscriptionTier = SubscriptionTier.FREE,
    val availablePlans: List<SubscriptionPlan> = emptyList(),
    val selectedBillingCycle: BillingCycle = BillingCycle.MONTHLY,
    val isLoading: Boolean = true,
    val isPurchasing: Boolean = false,
    val isRestoring: Boolean = false,
    val purchaseError: String? = null,
    val selectedPlanForUpgrade: SubscriptionTier? = null,
    /** True when the user already has an active tier from a Razorpay/web purchase (Phase 4
     * amendment, dual-purchase gate) -- [UpgradeScreen] should disable purchase buttons and show
     * `Res.string.premium_dialog_web_subscription_active` instead of letting them start a second,
     * separate mobile subscription. See [UpgradeViewModel.upgradeToPlan]. */
    val activeOnWebInstead: Boolean = false,
    /** RevenueCat's store-quoted MONTHLY price per tier, keyed by domain tier -- see
     * [UpgradeViewModel.loadStorePrices]. Empty (falls back to the generated pricing contract)
     * until the fetch succeeds. */
    val storeFormattedPrices: Map<SubscriptionTier, String> = emptyMap()
)

/**
 * Subscription plan details, as displayed on the upgrade screen.
 * (Distinct from `com.ssbmax.shared.domain.model.SubscriptionPlan`, the
 * simpler domain-layer plan shape used elsewhere -- this UI-only shape needs
 * per-billing-cycle pricing + gradient colors the domain model doesn't carry.)
 */
data class SubscriptionPlan(
    val tier: SubscriptionTier,
    val name: String,
    val tagline: String,
    val priceMonthly: Double,
    val priceQuarterly: Double,
    val priceAnnually: Double,
    val features: List<PlanFeature>,
    val isRecommended: Boolean,
    val gradient: List<Color>
) {
    fun getPriceForCycle(cycle: BillingCycle): Double {
        return when (cycle) {
            BillingCycle.MONTHLY -> priceMonthly
            BillingCycle.QUARTERLY -> priceQuarterly
            BillingCycle.ANNUALLY -> priceAnnually
        }
    }

    fun getSavingsForCycle(cycle: BillingCycle): String? {
        return when (cycle) {
            BillingCycle.MONTHLY -> null
            BillingCycle.QUARTERLY -> {
                val savings = (priceMonthly * 3) - priceQuarterly
                if (savings > 0) "Save ₹${savings.toInt()}" else null
            }
            BillingCycle.ANNUALLY -> {
                val savings = (priceMonthly * 12) - priceAnnually
                if (savings > 0) "Save ₹${savings.toInt()}" else null
            }
        }
    }
}

/**
 * Individual feature in a plan
 */
data class PlanFeature(
    val description: String,
    val isIncluded: Boolean
)
