package com.ssbmax.shared.platform.billing.revenuecat

import com.ssbmax.shared.domain.model.SubscriptionTier

/**
 * RevenueCat entitlement identifiers -- defined once in the RC dashboard's Offering (not
 * store-dependent, unlike `SSBMaxProductIds`' product IDs). Cumulative by design: the
 * `premium_monthly` product is configured in RC to grant all three entitlements at once, so
 * [RevenueCatEntitlementMapper] only has to pick the highest one present, never combine tiers
 * itself.
 */
object RevenueCatEntitlements {
    const val BASIC = "basic"
    const val PRO = "pro"
    const val PREMIUM = "premium"
}

/**
 * The one place RevenueCat's active-entitlement set is turned into an app-level
 * [SubscriptionTier] -- per the RevenueCat integration decision, no other call site should
 * inspect entitlement identifiers directly.
 */
object RevenueCatEntitlementMapper {
    fun toTier(activeEntitlementIds: Set<String>): SubscriptionTier = when {
        RevenueCatEntitlements.PREMIUM in activeEntitlementIds -> SubscriptionTier.PREMIUM
        RevenueCatEntitlements.PRO in activeEntitlementIds -> SubscriptionTier.PRO
        RevenueCatEntitlements.BASIC in activeEntitlementIds -> SubscriptionTier.BASIC
        else -> SubscriptionTier.FREE
    }
}

/**
 * Result of any RevenueCat call that returns a [com.revenuecat.purchases.kmp.models.CustomerInfo]
 * (purchase/restore/getCustomerInfo) -- callers consume [tier], never the raw entitlement IDs.
 */
data class RevenueCatPurchaseOutcome(val activeEntitlementIds: Set<String>) {
    val tier: SubscriptionTier get() = RevenueCatEntitlementMapper.toTier(activeEntitlementIds)
}

/** Thrown for any RevenueCat SDK error that isn't a user cancellation (see [BillingCancelledException]). */
class RevenueCatException(message: String) : Exception(message)

/**
 * Cross-platform wrapper over RevenueCat's `purchases-kmp` SDK (`Purchases.sharedInstance`).
 * Deliberately mirrors [com.ssbmax.shared.platform.billing.BillingClient]'s intentionally-thin
 * surface -- purchase/restore/customer-info only, no offerings/paywall-UI plumbing exposed here.
 *
 * No expect/actual split: RevenueCat's KMP SDK is genuinely common (confirmed against
 * RevenueCat's own `cat-paywall-kmp` sample, `PaywallsRepositoryImpl.kt`) -- `Purchases.configure`/
 * `getOfferings`/`purchase`/`restorePurchases`/`getCustomerInfo` are all commonMain calls on both
 * platforms; only *when* configure() is first invoked differs (Android's AndroidX Startup
 * ContentProvider wires the Application Context before any Koin `single` can resolve, so no
 * Context needs to be threaded through here).
 */
interface RevenueCatClient {
    /**
     * Configures the SDK on first call (anonymous if [appUserId] is null); on later calls with
     * the SDK already configured, switches identity via RevenueCat's `logIn`/`logOut` instead of
     * re-configuring -- call this again whenever the signed-in user changes.
     */
    fun configure(appUserId: String?)

    /** Resolves [productId] against the current Offering's packages, then purchases it. */
    suspend fun purchase(productId: String): Result<RevenueCatPurchaseOutcome>

    suspend fun restorePurchases(): Result<RevenueCatPurchaseOutcome>

    suspend fun getCustomerInfo(): Result<RevenueCatPurchaseOutcome>

    /** Resets RevenueCat to an anonymous user -- call on sign-out. */
    fun logOut()
}
