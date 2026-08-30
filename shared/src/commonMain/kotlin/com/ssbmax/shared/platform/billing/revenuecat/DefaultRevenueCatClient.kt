package com.ssbmax.shared.platform.billing.revenuecat

import com.revenuecat.purchases.kmp.LogLevel
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.PurchasesConfiguration
import com.revenuecat.purchases.kmp.models.CustomerInfo
import com.revenuecat.purchases.kmp.models.Offering
import com.revenuecat.purchases.kmp.models.Offerings
import com.revenuecat.purchases.kmp.models.Package
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
 * This is currently the Test Store SDK key from RC project "SSBMax" (RC dashboard -> API keys ->
 * SDK API keys -> Test Store) -- must never be a Secret key, and must never reach a production
 * build. Before release: create real Apple/Google products attached to these same
 * entitlements/packages, add the respective Apple/Google apps in RevenueCat, and swap this for
 * their platform-specific production SDK keys (Phase 4's blocking prerequisite).
 */
internal class DefaultRevenueCatClient(private val sdkKey: String) : RevenueCatClient {
    private var configured = false

    override suspend fun configure(appUserId: String?): Result<Unit> = runCatching {
        if (!configured) {
            Purchases.logLevel = if (isDebugBuild()) LogLevel.DEBUG else LogLevel.ERROR
            Purchases.configure(PurchasesConfiguration(apiKey = sdkKey) { this.appUserId = appUserId })
            configured = true
            return@runCatching
        }
        // Already configured -- switch identity instead of re-configuring (configure() is only
        // valid once per process). H4 (payment ecosystem hardening plan): this used to fire
        // logIn/logOut and return immediately with the error swallowed, so a purchase started in
        // that window could go through against RC's *previous* identity. Now awaited, and a
        // failure propagates as Result.failure so the caller (UpgradeViewModel) can hold
        // purchase/restore until identity is confirmed rather than assuming success.
        if (appUserId != null && appUserId != Purchases.sharedInstance.appUserID) {
            suspendCancellableCoroutine<Unit> { cont ->
                Purchases.sharedInstance.logIn(
                    appUserId,
                    onError = { error -> cont.resumeWithException(RevenueCatException(error.message)) },
                    onSuccess = { _, _ -> cont.resume(Unit) }
                )
            }
        } else if (appUserId == null) {
            suspendCancellableCoroutine<Unit> { cont ->
                Purchases.sharedInstance.logOut(
                    onError = { error -> cont.resumeWithException(RevenueCatException(error.message)) },
                    onSuccess = { _ -> cont.resume(Unit) }
                )
            }
        }
    }

    /** Defensive fallback for a call site that forgets to call [configure] first (`UpgradeViewModel`
     * always does, but nothing else enforces it at compile time) -- configures anonymously rather
     * than crashing on `Purchases.sharedInstance` being unset. Fire-and-forget by design: this is
     * a same-process safety net, not the identity-switch path H4 hardened, so there's no caller
     * here that needs to observe the result. */
    private suspend fun ensureConfigured() {
        if (!configured) configure(appUserId = null)
    }

    override suspend fun purchase(productId: String): Result<RevenueCatPurchaseOutcome> = runCatching {
        ensureConfigured()
        val pkg = resolvePackage(productId)
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

    override suspend fun getOfferingPrices(): Result<Map<String, RevenueCatProductPrice>> = runCatching {
        ensureConfigured()
        awaitOffering().availablePackages.associate { pkg ->
            pkg.storeProduct.id to RevenueCatProductPrice(
                formattedPrice = pkg.storeProduct.price.formatted,
                amountMicros = pkg.storeProduct.price.amountMicros,
                currencyCode = pkg.storeProduct.price.currencyCode
            )
        }
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

    private suspend fun awaitOffering(): Offering =
        awaitOfferings()[REVENUE_CAT_OFFERING_ID]
            ?: throw RevenueCatException("RevenueCat Offering '$REVENUE_CAT_OFFERING_ID' not found")

    private suspend fun resolvePackage(productId: String): Package =
        awaitOffering().availablePackages.find { matchesProductId(it.identifier, it.storeProduct.id, productId) }
            ?: throw RevenueCatException("Product not found in offering '$REVENUE_CAT_OFFERING_ID': $productId")

    private fun CustomerInfo.toOutcome(): RevenueCatPurchaseOutcome =
        RevenueCatPurchaseOutcome(
            activeEntitlementIds = entitlements.active.keys,
            managementUrl = managementUrlString
        )
}
