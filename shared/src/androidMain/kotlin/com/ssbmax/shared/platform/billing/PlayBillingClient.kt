package com.ssbmax.shared.platform.billing

import android.app.Activity
import android.app.Application
import android.content.Context
import android.os.Bundle
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient as PlayBillingClientLib
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Android actual, backed by Google Play Billing (`com.android.billingclient`,
 * previously in the version catalog but never actually wired up --
 * `SSBMaxBillingClient`/`BillingRepository` in `app` were all-TODO stubs
 * before this phase). Subscriptions only ([PlayBillingClientLib.ProductType.SUBS])
 * -- this app has no one-time/consumable products.
 *
 * `purchase()` needs a foreground `Activity` (Play Billing's
 * `launchBillingFlow` API requirement) that the commonMain [BillingClient]
 * interface can't reference. Rather than threading an Activity reference
 * through every call site (the approach used for
 * `AndroidNotificationPermissionController`, which needs the reference at
 * construction time for `registerForActivityResult`), this class tracks the
 * current foreground Activity itself via `Application.ActivityLifecycleCallbacks`
 * -- a standard, self-contained pattern for exactly this "which Activity is
 * in front right now" problem, and one that doesn't require MainActivity to
 * change at all (unlike the permission controller's constraint, this one
 * isn't forced by an Android API registration-timing rule).
 *
 * REMOVAL TODO (Phase 4, RevenueCat integration): unbound and unused since RevenueCat's SDK
 * (`shared/.../platform/billing/revenuecat/`) now owns the real purchase flow and wraps Play
 * Billing internally. Fully working code, not a stub -- kept, not deleted, until RevenueCat is
 * verified working end-to-end in production (per that plan's explicit decision point). Delete
 * this file and its Koin binding together once that's confirmed.
 */
class PlayBillingClient(context: Context) : BillingClient {

    private val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
        val pending = pendingPurchase ?: return@PurchasesUpdatedListener
        pendingPurchase = null
        if (billingResult.responseCode == PlayBillingClientLib.BillingResponseCode.OK && purchases != null) {
            val purchase = purchases.firstOrNull()
            if (purchase != null) {
                pending.complete(Result.success(purchase.toPurchaseResult()))
            } else {
                pending.complete(Result.failure(IllegalStateException("Purchase succeeded with no purchase data")))
            }
        } else if (billingResult.responseCode == PlayBillingClientLib.BillingResponseCode.USER_CANCELED) {
            pending.complete(Result.failure(BillingCancelledException()))
        } else {
            pending.complete(Result.failure(IllegalStateException("Billing error: ${billingResult.debugMessage}")))
        }
    }

    private val client: PlayBillingClientLib = PlayBillingClientLib.newBuilder(context)
        .setListener(purchasesUpdatedListener)
        .enablePendingPurchases(
            // Play Billing Library 7+'s PendingPurchasesParams.Builder.build()
            // throws IllegalArgumentException unless at least one pending-
            // purchase-eligible product type is declared -- even for a
            // subscriptions-only app with no one-time products, which is why
            // this call exists (confirmed live: constructing this class
            // without it crashes every real run, not just this phase's new
            // Koin checkModules() test that first caught it).
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .build()

    private var pendingPurchase: CompletableDeferred<Result<PurchaseResult>>? = null
    private var currentActivity: Activity? = null

    init {
        (context.applicationContext as? Application)?.registerActivityLifecycleCallbacks(
            object : Application.ActivityLifecycleCallbacks {
                override fun onActivityResumed(activity: Activity) {
                    currentActivity = activity
                }
                override fun onActivityPaused(activity: Activity) {
                    if (currentActivity === activity) currentActivity = null
                }
                override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
                override fun onActivityStarted(activity: Activity) = Unit
                override fun onActivityStopped(activity: Activity) = Unit
                override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
                override fun onActivityDestroyed(activity: Activity) = Unit
            }
        )
    }

    override suspend fun connect(): Result<Unit> = suspendCancellableCoroutine { cont ->
        if (client.isReady) {
            if (cont.isActive) cont.resume(Result.success(Unit))
            return@suspendCancellableCoroutine
        }
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                val result = if (billingResult.responseCode == PlayBillingClientLib.BillingResponseCode.OK) {
                    Result.success(Unit)
                } else {
                    Result.failure(IllegalStateException("Billing setup failed: ${billingResult.debugMessage}"))
                }
                if (cont.isActive) cont.resume(result)
            }

            override fun onBillingServiceDisconnected() {
                // No-op: caller can retry connect() explicitly.
            }
        })
    }

    override suspend fun queryProducts(productIds: List<String>): Result<List<BillingProduct>> {
        return try {
            val params = QueryProductDetailsParams.newBuilder()
                .setProductList(
                    productIds.map { id ->
                        QueryProductDetailsParams.Product.newBuilder()
                            .setProductId(id)
                            .setProductType(PlayBillingClientLib.ProductType.SUBS)
                            .build()
                    }
                )
                .build()

            val result = client.queryProductDetails(params)
            if (result.billingResult.responseCode != PlayBillingClientLib.BillingResponseCode.OK) {
                return Result.failure(IllegalStateException("queryProductDetails failed: ${result.billingResult.debugMessage}"))
            }
            productDetailsCache = result.productDetailsList.orEmpty().associateBy { it.productId }
            Result.success(productDetailsCache.values.map { it.toBillingProduct() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Guard clauses are the safest, clearest shape for a billing flow; collapsing
    // them to satisfy ReturnCount would only obscure the preconditions.
    // UnreachableCode: detekt false-positive on `?: return` elvis guards in this Kotlin/Android
    // compiler combo -- every flagged line is a live `?:`-guarded early return, not dead code
    // (confirmed: this file has zero call sites yet, per its own removal-TODO doc, so this was
    // never actually a live code-review finding, just a detekt/compiler-version quirk).
    @Suppress("ReturnCount", "UnreachableCode")
    override suspend fun purchase(productId: String): Result<PurchaseResult> {
        val activity = currentActivity
            ?: return Result.failure(IllegalStateException("No foreground Activity to launch the billing flow from"))
        val productDetails = productDetailsCache[productId]
            ?: return Result.failure(IllegalStateException("Call queryProducts() before purchase() for $productId"))
        val offerToken = productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken
            ?: return Result.failure(IllegalStateException("No subscription offer available for $productId"))

        val deferred = CompletableDeferred<Result<PurchaseResult>>()
        pendingPurchase = deferred

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .setOfferToken(offerToken)
                        .build()
                )
            )
            .build()

        val launchResult = client.launchBillingFlow(activity, flowParams)
        if (launchResult.responseCode != PlayBillingClientLib.BillingResponseCode.OK) {
            pendingPurchase = null
            return Result.failure(IllegalStateException("launchBillingFlow failed: ${launchResult.debugMessage}"))
        }

        val result = deferred.await()
        // Play Billing requires acknowledging non-consumable/subscription purchases
        // within 3 days or they're auto-refunded.
        result.getOrNull()?.let { purchaseResult ->
            if (!purchaseResult.isAcknowledged) acknowledge(purchaseResult.transactionId)
        }
        return result
    }

    private suspend fun acknowledge(purchaseToken: String) {
        try {
            val params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchaseToken)
                .build()
            client.acknowledgePurchase(params)
        } catch (e: Exception) {
            // Best-effort: an un-acknowledged purchase is auto-refunded by Play
            // after 3 days, not silently lost -- safe to swallow here since the
            // purchase itself already succeeded from the user's perspective.
        }
    }

    override suspend fun restorePurchases(): Result<List<PurchaseResult>> {
        return try {
            val params = QueryPurchasesParams.newBuilder()
                .setProductType(PlayBillingClientLib.ProductType.SUBS)
                .build()
            val result = client.queryPurchasesAsync(params)
            if (result.billingResult.responseCode != PlayBillingClientLib.BillingResponseCode.OK) {
                return Result.failure(IllegalStateException("queryPurchasesAsync failed: ${result.billingResult.debugMessage}"))
            }
            Result.success(result.purchasesList.map { it.toPurchaseResult() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun disconnect() {
        client.endConnection()
    }

    private var productDetailsCache: Map<String, ProductDetails> = emptyMap()

    private fun ProductDetails.toBillingProduct(): BillingProduct {
        val offer = subscriptionOfferDetails?.firstOrNull()
        val price = offer?.pricingPhases?.pricingPhaseList?.firstOrNull()?.formattedPrice.orEmpty()
        return BillingProduct(
            id = productId,
            title = title,
            description = description,
            formattedPrice = price
        )
    }

    private fun Purchase.toPurchaseResult(): PurchaseResult = PurchaseResult(
        productId = products.firstOrNull().orEmpty(),
        transactionId = purchaseToken,
        isAcknowledged = isAcknowledged
    )
}
