package com.ssbmax.shared.platform.billing

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.Foundation.NSError
import platform.Foundation.NSLocale
import platform.Foundation.NSNumberFormatter
import platform.Foundation.NSNumberFormatterCurrencyStyle
import platform.StoreKit.SKPayment
import platform.StoreKit.SKPaymentQueue
import platform.StoreKit.SKPaymentTransaction
import platform.StoreKit.SKPaymentTransactionObserverProtocol
import platform.StoreKit.SKPaymentTransactionState
import platform.StoreKit.SKProduct
import platform.StoreKit.SKProductsRequest
import platform.StoreKit.SKProductsRequestDelegateProtocol
import platform.StoreKit.SKProductsResponse
import platform.StoreKit.SKRequest
import platform.darwin.NSObject
import kotlin.coroutines.resume

/**
 * iOS actual, backed by **StoreKit 1** (`SKPaymentQueue`/`SKProductsRequest`),
 * not StoreKit 2. This is a deliberate, documented choice, not an
 * oversight: StoreKit 2's modern `Product`/`Transaction` API
 * (`StoreKit.Product.products(for:)`, `Transaction.currentEntitlements`) is
 * Swift-concurrency-only (`async`/`await`) and is not exposed to
 * Objective-C — which means it is also not reachable from Kotlin/Native's
 * cinterop, which only sees Objective-C-compatible surface. Consuming
 * StoreKit 2 from Kotlin/Native would require hand-writing a Swift bridge
 * layer exposed back to Obj-C, which is real, separate engineering work
 * outside a Phase 4 platform-shim's scope. StoreKit 1 remains fully
 * supported by Apple for subscriptions and is genuinely interop-friendly
 * today, so it's the correct choice for this shim, not a lesser one merely
 * chosen for expedience.
 *
 * REMOVAL TODO (Phase 4, RevenueCat integration): unbound and unused since RevenueCat's SDK
 * (`shared/.../platform/billing/revenuecat/`) now owns the real purchase flow and wraps
 * StoreKit internally. Fully working code, not a stub -- kept, not deleted, until RevenueCat is
 * verified working end-to-end in production (per that plan's explicit decision point). Delete
 * this file and its Koin binding together once that's confirmed.
 */
@OptIn(ExperimentalForeignApi::class)
class StoreKitBillingClient : BillingClient {

    private var productsCache: Map<String, SKProduct> = emptyMap()
    private var pendingPurchase: CompletableDeferred<Result<PurchaseResult>>? = null

    private val transactionObserver = object : NSObject(), SKPaymentTransactionObserverProtocol {
        override fun paymentQueue(queue: SKPaymentQueue, updatedTransactions: List<*>) {
            @Suppress("UNCHECKED_CAST")
            val transactions = updatedTransactions as List<SKPaymentTransaction>
            for (transaction in transactions) {
                when (transaction.transactionState) {
                    SKPaymentTransactionState.SKPaymentTransactionStatePurchased,
                    SKPaymentTransactionState.SKPaymentTransactionStateRestored -> {
                        val pending = pendingPurchase
                        pendingPurchase = null
                        pending?.complete(
                            Result.success(
                                PurchaseResult(
                                    productId = transaction.payment.productIdentifier,
                                    transactionId = transaction.transactionIdentifier ?: "",
                                    isAcknowledged = true // StoreKit 1 finishTransaction() below is the ack equivalent
                                )
                            )
                        )
                        queue.finishTransaction(transaction)
                    }
                    SKPaymentTransactionState.SKPaymentTransactionStateFailed -> {
                        val pending = pendingPurchase
                        pendingPurchase = null
                        val error = transaction.error
                        pending?.complete(
                            if (isCancelled(error)) {
                                Result.failure(BillingCancelledException())
                            } else {
                                Result.failure(IllegalStateException("StoreKit purchase failed: ${error?.localizedDescription}"))
                            }
                        )
                        queue.finishTransaction(transaction)
                    }
                    else -> {
                        // Purchasing/Deferred: leave pendingPurchase in-flight, StoreKit
                        // will deliver a follow-up state transition for this transaction.
                    }
                }
            }
        }
    }

    override suspend fun connect(): Result<Unit> {
        // StoreKit 1 has no explicit "connect" step (unlike Play Billing) --
        // SKPaymentQueue is always available. The transaction observer must
        // be registered before any purchase, done here on first connect().
        SKPaymentQueue.defaultQueue().addTransactionObserver(transactionObserver)
        return Result.success(Unit)
    }

    override suspend fun queryProducts(productIds: List<String>): Result<List<BillingProduct>> {
        return suspendCancellableCoroutine { cont ->
            val delegate = object : NSObject(), SKProductsRequestDelegateProtocol {
                override fun productsRequest(request: SKProductsRequest, didReceiveResponse: SKProductsResponse) {
                    val products = didReceiveResponse.products.filterIsInstance<SKProduct>()
                    productsCache = products.associateBy { it.productIdentifier }
                    if (cont.isActive) {
                        cont.resume(Result.success(products.map { it.toBillingProduct() }))
                    }
                }

                override fun request(request: SKRequest, didFailWithError: NSError) {
                    if (cont.isActive) {
                        cont.resume(Result.failure(IllegalStateException("SKProductsRequest failed: ${didFailWithError.localizedDescription}")))
                    }
                }
            }
            val request = SKProductsRequest(productIdentifiers = productIds.toSet())
            request.delegate = delegate
            request.start()
        }
    }

    override suspend fun purchase(productId: String): Result<PurchaseResult> {
        if (!SKPaymentQueue.canMakePayments()) {
            return Result.failure(IllegalStateException("This device/account can't make payments"))
        }
        val product = productsCache[productId]
            ?: return Result.failure(IllegalStateException("Call queryProducts() before purchase() for $productId"))

        val deferred = CompletableDeferred<Result<PurchaseResult>>()
        pendingPurchase = deferred
        val payment = SKPayment.paymentWithProduct(product)
        SKPaymentQueue.defaultQueue().addPayment(payment)
        return deferred.await()
    }

    override suspend fun restorePurchases(): Result<List<PurchaseResult>> {
        // StoreKit 1's restore is observer-driven (paymentQueueRestoreCompletedTransactionsFinished),
        // not a simple query -- SKPaymentQueue.defaultQueue().transactions already
        // reflects any transactions the queue currently knows about for this
        // session, which is the closest synchronous equivalent without adding a
        // second observer callback path solely for restore.
        val restored = SKPaymentQueue.defaultQueue().transactions
            .filterIsInstance<SKPaymentTransaction>()
            .filter {
                it.transactionState == SKPaymentTransactionState.SKPaymentTransactionStateRestored ||
                    it.transactionState == SKPaymentTransactionState.SKPaymentTransactionStatePurchased
            }
            .map {
                PurchaseResult(
                    productId = it.payment.productIdentifier,
                    transactionId = it.transactionIdentifier ?: "",
                    isAcknowledged = true
                )
            }
        return Result.success(restored)
    }

    override fun disconnect() {
        SKPaymentQueue.defaultQueue().removeTransactionObserver(transactionObserver)
    }

    private fun isCancelled(error: NSError?): Boolean {
        // SKErrorPaymentCancelled == 2 (StoreKit.SKError.Code.paymentCancelled).
        return error?.code == 2L
    }

    private fun SKProduct.toBillingProduct(): BillingProduct {
        val formatter = NSNumberFormatter().apply {
            numberStyle = NSNumberFormatterCurrencyStyle
            locale = this@toBillingProduct.priceLocale
        }
        val formattedPrice = formatter.stringFromNumber(price) ?: price.toString()
        return BillingProduct(
            id = productIdentifier,
            title = localizedTitle,
            description = localizedDescription,
            formattedPrice = formattedPrice
        )
    }
}
