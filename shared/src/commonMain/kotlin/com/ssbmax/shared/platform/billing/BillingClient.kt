package com.ssbmax.shared.platform.billing

import com.ssbmax.shared.domain.model.SubscriptionTier

/**
 * Cross-platform subscription billing: Android actual wraps Play Billing
 * (`com.android.billingclient`), iOS actual wraps StoreKit 1
 * (`SKPaymentQueue`/`SKProductsRequest` -- see `StoreKitBillingClient`'s doc
 * for why StoreKit 1, not 2).
 *
 * This is NOT a thin mechanical shim (the migration plan calls this out
 * explicitly, "Risks a Senior App Developer Should Push Back On" #3): Play
 * Billing and StoreKit have different product/price-ID models, different
 * receipt-validation flows, and different subscription-lifecycle event
 * shapes. This interface intentionally exposes only the lowest common
 * surface both platforms genuinely share (query/purchase/restore/connect)
 * — it does NOT attempt to unify server-side receipt validation or
 * lifecycle webhooks, which remain genuinely platform-specific concerns
 * outside this interface's scope.
 *
 * `SubscriptionLimits`/`CheckTestEligibilityUseCase` (`shared`) stay the SSOT
 * for subscription *limits* (unchanged by this shim; `core:data`'s
 * `SubscriptionManager`, the original SSOT this doc used to name, was
 * deleted in the KMP-convergence plan's Phase 9d) — this interface only
 * handles the purchase transaction itself; wiring a completed purchase into
 * subscription state is `BillingRepository`'s (app-layer) job.
 */
interface BillingClient {
    /** Establishes the store connection. Must succeed before any other call. */
    suspend fun connect(): Result<Unit>

    /** Queries store-side product/price info for the given product IDs. */
    suspend fun queryProducts(productIds: List<String>): Result<List<BillingProduct>>

    /**
     * Launches the platform purchase flow for [productId] and suspends
     * until it resolves (success, user cancellation, or failure).
     */
    suspend fun purchase(productId: String): Result<PurchaseResult>

    /** Returns the user's currently active (non-consumed/non-expired) purchases. */
    suspend fun restorePurchases(): Result<List<PurchaseResult>>

    /** Releases the store connection. */
    fun disconnect()
}

data class BillingProduct(
    val id: String,
    val title: String,
    val description: String,
    val formattedPrice: String
)

data class PurchaseResult(
    val productId: String,
    /** Play Billing purchase token / StoreKit transaction identifier. */
    val transactionId: String,
    val isAcknowledged: Boolean
)

/**
 * PLACEHOLDER product IDs — not registered in either Play Console or App
 * Store Connect. Real product/price IDs are a business decision explicitly
 * out of this shim's scope (per the migration plan); swap these for the
 * real IDs before shipping billing. This is also the one place RevenueCat's
 * purchase flow (`shared/.../platform/billing/revenuecat/`) reads product
 * IDs from -- deliberately not a second, competing ID list, per the
 * RevenueCat integration decision ("keep RevenueCat/store product IDs
 * centralized"). Matches the tier set BASIC/PRO/PREMIUM
 * (`contracts/pricing.yaml`) plus the one-time interview top-up addon;
 * `*_YEARLY`/`*_QUARTERLY` are out of scope (monthly-only pricing for now).
 */
object SSBMaxProductIds {
    const val BASIC_MONTHLY = "basic_monthly_PLACEHOLDER"
    const val PRO_MONTHLY = "pro_monthly_PLACEHOLDER"
    const val PREMIUM_MONTHLY = "premium_monthly_PLACEHOLDER"
    const val INTERVIEW_TOPUP = "interview_topup_PLACEHOLDER"

    val ALL = listOf(BASIC_MONTHLY, PRO_MONTHLY, PREMIUM_MONTHLY, INTERVIEW_TOPUP)

    /** Null for FREE -- there's no product to purchase for it. */
    fun forTier(tier: SubscriptionTier): String? = when (tier) {
        SubscriptionTier.FREE -> null
        SubscriptionTier.BASIC -> BASIC_MONTHLY
        SubscriptionTier.PRO -> PRO_MONTHLY
        SubscriptionTier.PREMIUM -> PREMIUM_MONTHLY
    }
}

/** Thrown when the user backs out of the platform purchase sheet. Not an error. */
class BillingCancelledException : Exception("User cancelled the purchase")
