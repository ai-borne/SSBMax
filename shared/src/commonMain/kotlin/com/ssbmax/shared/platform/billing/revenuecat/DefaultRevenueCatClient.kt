package com.ssbmax.shared.platform.billing.revenuecat

import com.revenuecat.purchases.kmp.LogLevel
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.PurchasesConfiguration
import com.revenuecat.purchases.kmp.models.CustomerInfo
import com.revenuecat.purchases.kmp.models.Offerings
import com.ssbmax.shared.platform.billing.BillingCancelledException
import com.ssbmax.shared.platform.isDebugBuild
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Real [RevenueCatClient], backed by `Purchases.sharedInstance`. [sdkKey] is RevenueCat's
 * public SDK key -- safe to embed client-side by RevenueCat's own design (it only authorizes
 * this SDK's calls into RC's proxy, which enforces entitlements server-side; unlike the raw
 * Gemini key this codebase deliberately keeps server-only, see `geminiProxy.js`'s doc comment).
 * This is currently the sandbox/Test Store key from RC project "SSBMax" -- swap for a
 * production key once real Play Console/App Store Connect products exist (Phase 4's
 * blocking prerequisite).
 */
internal class DefaultRevenueCatClient(private val sdkKey: String) : RevenueCatClient {
    private var configured = false

    override fun configure(appUserId: String?) {
        if (!configured) {
            Purchases.logLevel = if (isDebugBuild()) LogLevel.DEBUG else LogLevel.ERROR
            Purchases.configure(PurchasesConfiguration(apiKey = sdkKey) { this.appUserId = appUserId })
            configured = true
            return
        }
        // Already configured -- switch identity instead of re-configuring (configure() is only
        // valid once per process). Errors are swallowed: a failed logIn/logOut leaves RC on its
        // previous identity, which self-corrects on the next successful call, and there's no UI
        // surface here to report it to.
        if (appUserId != null && appUserId != Purchases.sharedInstance.appUserID) {
            Purchases.sharedInstance.logIn(appUserId, onError = { _ -> }, onSuccess = { _, _ -> })
        } else if (appUserId == null) {
            Purchases.sharedInstance.logOut(onError = { _ -> }, onSuccess = { _ -> })
        }
    }

    /** Defensive fallback for a call site that forgets to call [configure] first (`UpgradeViewModel`
     * always does, but nothing else enforces it at compile time) -- configures anonymously rather
     * than crashing on `Purchases.sharedInstance` being unset. */
    private fun ensureConfigured() {
        if (!configured) configure(appUserId = null)
    }

    override suspend fun purchase(productId: String): Result<RevenueCatPurchaseOutcome> = runCatching {
        ensureConfigured()
        val offerings = awaitOfferings()
        // Play subscriptions can report `storeProduct.id` as "productId:basePlanId" -- match on
        // either the exact product ID or that prefix, not just equality.
        val pkg = offerings.current?.availablePackages?.find {
            it.storeProduct.id == productId || it.storeProduct.id.startsWith("$productId:")
        } ?: throw RevenueCatException("Product not found in current offering: $productId")
        val customerInfo = suspendCancellableCoroutine { cont ->
            Purchases.sharedInstance.purchase(
                packageToPurchase = pkg,
                onError = { error, userCancelled ->
                    cont.resumeWithException(
                        if (userCancelled) BillingCancelledException() else RevenueCatException(error.message)
                    )
                },
                onSuccess = { _, customerInfo -> cont.resume(customerInfo) }
            )
        }
        customerInfo.toOutcome()
    }

    override suspend fun restorePurchases(): Result<RevenueCatPurchaseOutcome> = runCatching {
        ensureConfigured()
        suspendCancellableCoroutine { cont ->
            Purchases.sharedInstance.restorePurchases(
                onError = { error -> cont.resumeWithException(RevenueCatException(error.message)) },
                onSuccess = { info -> cont.resume(info) }
            )
        }.toOutcome()
    }

    override suspend fun getCustomerInfo(): Result<RevenueCatPurchaseOutcome> = runCatching {
        ensureConfigured()
        suspendCancellableCoroutine { cont ->
            Purchases.sharedInstance.getCustomerInfo(
                onError = { error -> cont.resumeWithException(RevenueCatException(error.message)) },
                onSuccess = { info -> cont.resume(info) }
            )
        }.toOutcome()
    }

    override fun logOut() {
        Purchases.sharedInstance.logOut(onError = { _ -> }, onSuccess = { _ -> })
    }

    private suspend fun awaitOfferings(): Offerings = suspendCancellableCoroutine { cont ->
        Purchases.sharedInstance.getOfferings(
            onError = { error -> cont.resumeWithException(RevenueCatException(error.message)) },
            onSuccess = { offerings -> cont.resume(offerings) }
        )
    }

    private fun CustomerInfo.toOutcome(): RevenueCatPurchaseOutcome =
        RevenueCatPurchaseOutcome(activeEntitlementIds = entitlements.active.keys)
}
