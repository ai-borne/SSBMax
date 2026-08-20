package com.ssbmax.shared.presentation.settings

import com.ssbmax.shared.data.repository.SubscriptionLimits
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetMonthlyUsageUseCase
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.platform.billing.revenuecat.RevenueCatClient
import com.ssbmax.shared.ui.util.formatFullDate
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Clock
import kotlinx.datetime.DatePeriod
import kotlin.time.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.plus

/**
 * KMP port of the Android `app/.../ui/settings/SubscriptionManagementViewModel.kt`.
 *
 * Phase 1 of the KMP-convergence plan: a real `androidx.lifecycle.ViewModel`
 * using `viewModelScope`, converged with `app`'s existing ViewModel idiom and
 * this module's own DI (`viewModelOf`) / screen (`koinViewModel()`)
 * conventions — no more manual `CoroutineScope` + `close()`. `android.util.Log`/`ErrorLogger`
 * calls replaced with [DomainLogger].
 *
 * Kotlin/Native gotcha fixes (this port, not behavior changes):
 * - `java.util.Calendar`/`java.util.Locale` (JVM-only) replaced with
 *   `kotlinx.datetime.Clock` + [formatFullDate] (the same KMP-safe date
 *   formatter [com.ssbmax.shared.presentation.gto.common.GTOSubmissionCoordinator]'s
 *   sibling verticals already use).
 *
 * KMP-convergence Phase 3a, row #20: the Android original's `Calendar.add(MONTH, 1)`
 * was ported here as a flat +30-day offset, which is wrong in February (28/29
 * days) and any 31-day month -- not the same value "add one calendar month"
 * produces. Fixed to use `kotlinx.datetime`'s `DatePeriod(months = 1)` against
 * the device's current time zone, matching the Android original's actual
 * "add one calendar month" semantics (the "mock for now" doc comment on this
 * expiry date, i.e. not a real billing-cycle calculation, still applies either
 * way).
 */
class SubscriptionManagementViewModel(
    private val observeCurrentUser: ObserveCurrentUserUseCase,
    private val getSubscriptionTier: GetSubscriptionTierUseCase,
    private val getMonthlyUsage: GetMonthlyUsageUseCase,
    private val subscriptionRepository: SubscriptionRepository,
    private val revenueCatClient: RevenueCatClient,
    private val logger: DomainLogger
) : ViewModel() {
    private val _uiState = MutableStateFlow(SubscriptionManagementUiState())
    val uiState: StateFlow<SubscriptionManagementUiState> = _uiState.asStateFlow()

    private companion object {
        const val TAG = "SubscriptionMgmtViewModel"
        /** Matches [com.ssbmax.shared.presentation.premium.UpgradeViewModel]'s private
         * `WEB_PAYMENT_SOURCE` -- `SubscriptionOwnership.source`'s RevenueCat-webhook value. */
        const val REVENUECAT_SOURCE = "REVENUECAT"
    }

    fun loadSubscriptionData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val user = observeCurrentUser().first()
                val userId = user?.id ?: throw IllegalStateException("User not authenticated")

                val tierResult = getSubscriptionTier(userId)
                val tier = tierResult.getOrElse {
                    throw IllegalStateException("Failed to load subscription tier: ${it.message}")
                }

                val usageResult = getMonthlyUsage(userId)
                val domainUsage = usageResult.getOrElse {
                    logger.e(TAG, "Failed to load usage, using empty map", it)
                    emptyMap()
                }

                val uiTier = SubscriptionTierModel.from(tier)
                val uiUsage = domainUsage.mapValues { (_, value) -> UsageInfo.from(value) }

                // Real `expiryDate`/`willRenew` (Phase B, Razorpay Subscriptions API migration) --
                // falls back to the mock +1-calendar-month estimate only for a legacy/grandfathered
                // doc with no `expiryDate` (e.g. a pre-Phase-3 one-time-order Razorpay payer),
                // matching this plan's "never revoke or re-gate based on absence alone" rule.
                val ownership = if (tier != SubscriptionTier.FREE) {
                    subscriptionRepository.getSubscriptionOwnership(userId).getOrNull()
                } else {
                    null
                }
                val expiresAt = if (tier != SubscriptionTier.FREE) {
                    val realExpiry = ownership?.expiryDate
                    formatFullDate(realExpiry ?: nextBillingCycleExpiry(Clock.System.now()).toEpochMilliseconds())
                } else {
                    null
                }

                // Phase 6 (payment ecosystem hardening plan): the store-managed "Manage Billing"
                // action is shown only for an active RevenueCat-sourced subscription -- a
                // Razorpay-sourced one is cancelled from the web SubscriptionPage (Phase 5), and
                // Apple/Google forbid a backend from cancelling a StoreKit/Play subscription, so
                // mobile can only deep-link to the store's own management page.
                val isRevenueCatSourced = tier != SubscriptionTier.FREE && ownership?.source == REVENUECAT_SOURCE
                val managementUrl = if (isRevenueCatSourced) {
                    revenueCatClient.getCustomerInfo()
                        .onFailure { logger.e(TAG, "Failed to fetch RevenueCat management URL", it) }
                        .getOrNull()
                        ?.managementUrl
                } else {
                    null
                }

                _uiState.value = SubscriptionManagementUiState(
                    isLoading = false,
                    currentTier = uiTier,
                    monthlyUsage = uiUsage,
                    subscriptionExpiresAt = expiresAt,
                    subscriptionWillRenew = ownership?.willRenew ?: true,
                    showManageBilling = isRevenueCatSourced,
                    managementUrl = managementUrl
                )
            } catch (e: Exception) {
                logger.e(TAG, "Failed to load subscription data", e)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = "Failed to load subscription data: ${e.message}"
                    )
                }
            }
        }
    }

    /**
     * Called when the user taps "Manage Billing" but [SubscriptionManagementUiState.managementUrl]
     * is null (RevenueCat had no URL to hand back, or the fetch in [loadSubscriptionData] failed).
     * Surfaces a handled, dismissable message instead of the screen silently doing nothing or the
     * caller null-pointering on the URL (Phase 6, payment ecosystem hardening plan).
     */
    fun onManageBillingUnavailable() {
        logger.e(TAG, "Manage Billing tapped with no management URL available")
        _uiState.update { it.copy(manageBillingError = true) }
    }

    fun dismissManageBillingError() {
        _uiState.update { it.copy(manageBillingError = false) }
    }
}

/**
 * One calendar month after [now], in the device's current time zone.
 *
 * Extracted as a pure function (KMP-convergence Phase 3a, row #20) so the
 * February/31-day-month fix is unit-testable without a `ViewModel` + Koin
 * use-case graph -- see `SubscriptionManagementViewModelTest`.
 */
internal fun nextBillingCycleExpiry(now: Instant): Instant =
    now.plus(DatePeriod(months = 1), TimeZone.currentSystemDefault())

/**
 * UI State for Subscription Management
 */
data class SubscriptionManagementUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val currentTier: SubscriptionTierModel = SubscriptionTierModel.FREE,
    val monthlyUsage: Map<String, UsageInfo> = emptyMap(),
    val subscriptionExpiresAt: String? = null,
    /** Whether the subscription auto-renews at [subscriptionExpiresAt] (Phase B, Razorpay
     * Subscriptions API migration) -- `false` once a `subscription.cancelled`/`paused` webhook has
     * fired. Defaults `true` (matches [com.ssbmax.shared.domain.repository.SubscriptionOwnership]'s
     * default) so a still-loading/legacy state never shows a false "won't renew" warning. */
    val subscriptionWillRenew: Boolean = true,
    /** Phase 6 (payment ecosystem hardening plan): shown only for an active RevenueCat-sourced
     * subscription -- a Razorpay-sourced one is cancelled from the web SubscriptionPage instead. */
    val showManageBilling: Boolean = false,
    /** Store-hosted management page (App Store/Play Store) to open when "Manage Billing" is
     * tapped; may be null even when [showManageBilling] is true (fetch failed, or RevenueCat had
     * none to hand back) -- the tap handler must treat that as a handled error, not a crash. */
    val managementUrl: String? = null,
    /** Set by [SubscriptionManagementViewModel.onManageBillingUnavailable] when "Manage Billing"
     * is tapped with no [managementUrl]; the screen renders
     * `Res.string.subscription_mgmt_manage_billing_error` for it and never replaces the whole
     * screen the way [error] does. */
    val manageBillingError: Boolean = false
)

/**
 * UI model for subscription tier with display properties.
 * Maps from domain [SubscriptionTier] to UI-specific display model.
 *
 * All prices/limits/features are read through [domainTier] from the generated
 * contract ([com.ssbmax.shared.contracts.SsbContracts]) rather than hand-typed here --
 * this enum previously duplicated those numbers and had already drifted once
 * (see git history). Only the enum identity (for `.entries`/`when`-exhaustiveness
 * in Compose UI) stays here.
 */
enum class SubscriptionTierModel(val domainTier: SubscriptionTier) {
    FREE(SubscriptionTier.FREE),
    BASIC(SubscriptionTier.BASIC),
    PRO(SubscriptionTier.PRO),
    PREMIUM(SubscriptionTier.PREMIUM);

    val displayName: String get() = domainTier.displayName
    val price: String get() = domainTier.monthlyPrice
    val features: List<String> get() = domainTier.features

    val oirTestLimit: Int get() = SubscriptionLimits.limitFor("OIR", domainTier)
    val tatTestLimit: Int get() = SubscriptionLimits.limitFor("TAT", domainTier)
    val watTestLimit: Int get() = SubscriptionLimits.limitFor("WAT", domainTier)
    val srtTestLimit: Int get() = SubscriptionLimits.limitFor("SRT", domainTier)
    val ppdtTestLimit: Int get() = SubscriptionLimits.limitFor("PPDT", domainTier)
    val piqTestLimit: Int get() = SubscriptionLimits.limitFor("PIQ", domainTier)
    val sdTestLimit: Int get() = SubscriptionLimits.limitFor("SD", domainTier)
    val gtoTestLimit: Int get() = SubscriptionLimits.limitFor("GTO", domainTier)
    val interviewTestLimit: Int get() = SubscriptionLimits.limitFor("INTERVIEW", domainTier)

    companion object {
        fun from(tier: SubscriptionTier): SubscriptionTierModel = entries.first { it.domainTier == tier }
    }
}

/**
 * Usage information for display.
 */
data class UsageInfo(
    val used: Int,
    val limit: Int
) {
    companion object {
        fun from(domain: com.ssbmax.shared.domain.repository.UsageInfo): UsageInfo = UsageInfo(
            used = domain.used,
            limit = domain.limit
        )
    }
}
