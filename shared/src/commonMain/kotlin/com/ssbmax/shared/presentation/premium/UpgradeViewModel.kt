package com.ssbmax.shared.presentation.premium

import com.ssbmax.shared.domain.model.BillingCycle
import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionOwnership
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.platform.billing.BillingCancelledException
import com.ssbmax.shared.platform.billing.SSBMaxProductIds
import com.ssbmax.shared.platform.billing.revenuecat.RevenueCatClient
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.ui.theme.TierColors
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlin.time.Clock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * KMP port of the Android `app/.../ui/premium/UpgradeViewModel.kt` (the LIVE
 * upgrade screen -- `com.ssbmax.ui.premium`, wired at `SSBMaxDestinations.UpgradeScreen`
 * / route "premium/upgrade"). NOT to be confused with the sibling Android
 * package `com.ssbmax.ui.upgrade` (route "upgrade") -- that package's
 * `UpgradeScreen`/`UpgradeViewModel` are dead code in the Android app itself:
 * `viewModelOf(::UpgradeUpgradeViewModel)` is bound in `ViewModelModule.kt`
 * but `UpgradeScreen` (the composable) has zero call sites anywhere in
 * `SharedNavGraph.kt` or any other nav graph -- confirmed by grep and by
 * `git log` showing the package untouched since the mechanical Phase 1/3
 * migration commits. Deliberately NOT ported this session (would be porting
 * unreachable code -- see this plan's own "no speculative features" rule).
 *
 * Uses a real `androidx.lifecycle.ViewModel` with `viewModelScope` (Phase 1 of
 * the KMP-convergence plan, see
 * [com.ssbmax.shared.presentation.oir.OIRTestViewModel]'s doc comment for the
 * precedent this mirrors). `android.util.Log` replaced with [DomainLogger].
 *
 * Behavior difference from the Android original (deliberate, not a port bug):
 * the Android `UpgradeViewModel` reads `userProfileRepository.getUserProfile(userId)`
 * directly and hand-maps `SubscriptionType` -> `SubscriptionTier` inline. This
 * port instead calls [GetSubscriptionTierUseCase] -- the exact same use case
 * the sibling (already-ported) `SubscriptionManagementViewModel` uses for the
 * identical lookup. Same SSOT result, avoids duplicating the
 * repository-to-tier mapping in two KMP ViewModels.
 *
 * Billing gap (Phase 4, RevenueCat integration -- CLOSED): the Android
 * original's `upgradeToPlan()` was "visual only" -- it just flipped
 * `showComingSoonDialog` to true; there was no Razorpay/Stripe/Play-Billing
 * call anywhere in this flow. `upgradeToPlan()` now drives a real purchase
 * through [RevenueCatClient], which wraps `PlayBillingClient`/
 * `StoreKitBillingClient` internally (RevenueCat's own SDK talks to Play
 * Billing/StoreKit directly -- those two shims stay unbound and unused,
 * kept only until RevenueCat is verified working end-to-end in production,
 * per the RevenueCat integration decision). [SSBMaxProductIds] now holds
 * RevenueCat's real Test Store identifiers -- purchases actually go through
 * against the Test Store today; only real Play Console/App Store Connect
 * products (a later, separate step) are still pending.
 */
class UpgradeViewModel(
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val getSubscriptionTier: GetSubscriptionTierUseCase,
    private val subscriptionRepository: SubscriptionRepository,
    private val revenueCatClient: RevenueCatClient,
    private val developerSettings: DeveloperSettings,
    private val logger: DomainLogger
) : ViewModel() {
    private val _uiState = MutableStateFlow(UpgradeUiState())
    val uiState: StateFlow<UpgradeUiState> = _uiState.asStateFlow()

    private var currentUserId: String? = null

    private companion object {
        const val TAG = "UpgradeViewModel"
        /** `applySubscriptionTier`'s `source` value in `functions/src/webhooks.js` (Razorpay/web). */
        const val WEB_PAYMENT_SOURCE = "RAZORPAY"
    }

    init {
        observeCurrentSubscription()
        loadAvailablePlans()
        loadStorePrices()
    }

    /** Fetches RevenueCat's store-quoted MONTHLY prices for [SSBMaxProductIds]' three paid
     * products, so the UI can show real store prices instead of the generated pricing contract's
     * numbers. Best-effort: failure (e.g. offline) just leaves [UpgradeUiState.storeFormattedPrices]
     * empty, and every card falls back to the contract price -- no error surfaced for this. */
    private fun loadStorePrices() {
        viewModelScope.launch {
            revenueCatClient.getOfferingPrices()
                .onSuccess { pricesByProductId ->
                    val byTier = SubscriptionTier.entries.mapNotNull { tier ->
                        val productId = SSBMaxProductIds.forTier(tier) ?: return@mapNotNull null
                        pricesByProductId[productId]?.let { tier to it.formattedPrice }
                    }.toMap()
                    _uiState.update { it.copy(storeFormattedPrices = byTier) }
                }
                .onFailure { logger.w(TAG, "Could not fetch RevenueCat offering prices: ${it.message}") }
        }
    }

    private fun observeCurrentSubscription() {
        viewModelScope.launch {
            combine(observeCurrentUser(), developerSettings.overrideFlow) { user, _ -> user }
                .collect { user -> loadCurrentSubscriptionFor(user) }
        }
    }

    private suspend fun loadCurrentSubscriptionFor(currentUser: SSBMaxUser?) {
        currentUserId = currentUser?.id
        revenueCatClient.configure(appUserId = currentUser?.id)
        _uiState.update { it.copy(isLoading = true) }
        try {
            if (currentUser == null) {
                logger.w(TAG, "No user logged in, defaulting to FREE tier")
                _uiState.update { it.copy(currentTier = SubscriptionTier.FREE, isLoading = false) }
                return
            }

            val tierResult = getSubscriptionTier(currentUser.id)
            val tier = tierResult.getOrElse {
                logger.e(TAG, "Error loading subscription tier", it)
                SubscriptionTier.FREE
            }

            val blockedByWeb = subscriptionRepository.getSubscriptionOwnership(currentUser.id)
                .getOrElse { SubscriptionOwnership(source = null, expiryDate = null) }
                .let { it.source == WEB_PAYMENT_SOURCE && it.isActive(Clock.System.now().toEpochMilliseconds()) }

            _uiState.update { it.copy(currentTier = tier, isLoading = false, activeOnWebInstead = blockedByWeb) }
        } catch (e: Exception) {
            logger.e(TAG, "Error in loadCurrentSubscription", e)
            _uiState.update { it.copy(currentTier = SubscriptionTier.FREE, isLoading = false) }
        }
    }

    /**
     * One card per [SubscriptionTier] (FREE/BASIC/PRO/PREMIUM) -- previously this listed
     * "Premium (AI)" and "Premium" as two separate cards for the same tier, an SSOT violation
     * flagged during the pricing restructure. Feature bullets come from [SubscriptionTier.features]
     * (itself generated from the contract, see `SubscriptionTier.kt`) rather than a fourth
     * hand-written copy, so this can't drift from the tier's real limits again.
     */
    private fun loadAvailablePlans() {
        val plans = SubscriptionTier.entries.map(::planFor)
        _uiState.update { it.copy(availablePlans = plans) }
    }

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

    fun selectBillingCycle(cycle: BillingCycle) {
        _uiState.update { it.copy(selectedBillingCycle = cycle) }
    }

    fun upgradeToPlan(tier: SubscriptionTier) {
        val userId = currentUserId
        val productId = SSBMaxProductIds.forTier(tier)
        if (userId == null || productId == null) {
            logger.w(TAG, "upgradeToPlan called with no signed-in user or no product for $tier")
            return
        }
        if (_uiState.value.activeOnWebInstead) {
            // Neither webhook reconciles against what the other already wrote (see
            // `SubscriptionOwnership`'s doc comment) -- block a second, separate mobile purchase
            // rather than risk one silently stomping the web-purchased tier/expiry.
            logger.w(TAG, "upgradeToPlan blocked: user already has an active web (Razorpay) subscription")
            return
        }

        _uiState.update { it.copy(isPurchasing = true, purchaseError = null, selectedPlanForUpgrade = tier) }
        viewModelScope.launch {
            revenueCatClient.purchase(productId)
                .onSuccess { outcome ->
                    // Best-effort optimistic write, racing the async RC webhook -- deliberately not
                    // removed (regresses UX) and not backed by a polling/re-fetch mechanism.
                    // GitLiveSubscriptionRepository.updateSubscriptionTier is a field-only update
                    // (only "tier" is written; source/expiryDate/startDate are untouched), so the
                    // worst case here is a few seconds of stale `source`, never a corrupted doc --
                    // and with Phase 0's read-time expiryDate derivation live, that stale window
                    // can't even produce a wrong *effective* tier.
                    subscriptionRepository.updateSubscriptionTier(userId, outcome.tier)
                    _uiState.update {
                        it.copy(isPurchasing = false, currentTier = outcome.tier, selectedPlanForUpgrade = null)
                    }
                }
                .onFailure { error ->
                    if (error is BillingCancelledException) {
                        _uiState.update { it.copy(isPurchasing = false, selectedPlanForUpgrade = null) }
                    } else {
                        logger.e(TAG, "Purchase failed for $tier", error)
                        _uiState.update {
                            it.copy(isPurchasing = false, purchaseError = error.message, selectedPlanForUpgrade = null)
                        }
                    }
                }
        }
    }

    fun dismissPurchaseError() {
        _uiState.update { it.copy(purchaseError = null) }
    }

    /** Re-derives entitlements from the store (e.g. after a reinstall, or a purchase made on
     * another device with the same RevenueCat identity) and persists the resulting tier through
     * [SubscriptionRepository], same as a successful [upgradeToPlan]. */
    fun restorePurchases() {
        val userId = currentUserId
        if (userId == null) {
            logger.w(TAG, "restorePurchases called with no signed-in user")
            return
        }
        if (_uiState.value.activeOnWebInstead) {
            // Same gate as upgradeToPlan -- restoring RC entitlements would otherwise silently
            // overwrite an active Razorpay-sourced tier just like a fresh purchase would.
            logger.w(TAG, "restorePurchases blocked: user already has an active web (Razorpay) subscription")
            return
        }

        _uiState.update { it.copy(isRestoring = true, purchaseError = null) }
        viewModelScope.launch {
            revenueCatClient.restorePurchases()
                .onSuccess { outcome ->
                    // Best-effort optimistic write, racing the async RC webhook -- see the identical
                    // comment in upgradeToPlan for why this is safe to leave as-is.
                    subscriptionRepository.updateSubscriptionTier(userId, outcome.tier)
                    _uiState.update { it.copy(isRestoring = false, currentTier = outcome.tier) }
                }
                .onFailure { error ->
                    logger.e(TAG, "Restore purchases failed", error)
                    _uiState.update { it.copy(isRestoring = false, purchaseError = error.message) }
                }
        }
    }
}

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
