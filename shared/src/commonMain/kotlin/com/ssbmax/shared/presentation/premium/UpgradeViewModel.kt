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
        _uiState.update { it.copy(isLoading = true, identityResolved = false) }

        // H4 (payment ecosystem hardening plan): awaited, not fire-and-forget -- upgradeToPlan/
        // restorePurchases gate on `identityResolved`, so a purchase can never start against RC's
        // previous identity while this switch is still in flight. A failure surfaces as
        // `purchaseError` instead of being swallowed; `identityResolved` stays false, so purchase
        // actions stay blocked until the *next* successful identity switch (e.g. app restart, or
        // the user's auth state settling) rather than silently proceeding on a stale identity.
        val identityError = revenueCatClient.configure(appUserId = currentUser?.id).exceptionOrNull()
        if (identityError != null) {
            logger.e(TAG, "RevenueCat identity switch failed for ${currentUser?.id}", identityError)
        }
        _uiState.update {
            it.copy(identityResolved = identityError == null, purchaseError = identityError?.message ?: it.purchaseError)
        }

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

            // Client-side-only check, mirrored by web's own `SubscriptionPage.tsx` gate. Phase C
            // (Dual-Platform Subscription Billing Hardening plan) added a *server-side* purchase
            // gate in `razorpaySubscriptions.js`'s `createRazorpaySubscription`, but only in this
            // direction (Razorpay creation rejects an active RevenueCat subscription) --
            // RevenueCat purchases can't be pre-blocked server-side at all, since the store
            // charges the user before any of our server code runs (see the plan's "Structural
            // constraint" note). This `activeOnWebInstead` check plus `restorePurchases()`'s gate
            // and webhook-to-webhook reconciliation are the best available mitigation for that
            // reverse (RevenueCat-blocks-Razorpay) direction -- there is no equivalent hard block.
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
        if (!_uiState.value.identityResolved) {
            // H4: RevenueCat's identity switch for this user hasn't confirmed yet (or failed) --
            // starting a purchase now risks it landing against the previous/anonymous identity.
            logger.w(TAG, "upgradeToPlan blocked: RevenueCat identity not yet resolved for $userId")
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
                    // Local UiState only -- deliberately NOT persisted. The optimistic
                    // `updateSubscriptionTier` write that used to sit here was deleted in Phase 1 of
                    // the Payment Ecosystem Hardening plan (finding C1): it depended on a Firestore
                    // rule that let any signed-in user write their own subscription doc, i.e. grant
                    // themselves PREMIUM for free. That rule is closed now, so the write would fail
                    // anyway. `revenueCatWebhook.js` (Admin SDK) is the writer; this keeps the screen
                    // feeling instant in the meantime.
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
     * another device with the same RevenueCat identity) and reflects the resulting tier in local
     * state, same as a successful [upgradeToPlan]. */
    fun restorePurchases() {
        val userId = currentUserId
        if (userId == null) {
            logger.w(TAG, "restorePurchases called with no signed-in user")
            return
        }
        if (!_uiState.value.identityResolved) {
            // Same H4 gate as upgradeToPlan -- restoring against the wrong identity would surface
            // another RC account's entitlements as this user's own.
            logger.w(TAG, "restorePurchases blocked: RevenueCat identity not yet resolved for $userId")
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
                    // Local UiState only -- see the identical note in upgradeToPlan for why there is
                    // no client-side tier write here any more.
                    _uiState.update { it.copy(isRestoring = false, currentTier = outcome.tier) }
                }
                .onFailure { error ->
                    logger.e(TAG, "Restore purchases failed", error)
                    _uiState.update { it.copy(isRestoring = false, purchaseError = error.message) }
                }
        }
    }
}
