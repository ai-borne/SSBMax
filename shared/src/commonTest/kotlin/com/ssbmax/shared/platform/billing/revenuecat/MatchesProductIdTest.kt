package com.ssbmax.shared.platform.billing.revenuecat

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Phase 4 (RevenueCat integration): pins package resolution against RevenueCat's real Test Store
 * configuration -- package identifiers equal product IDs exactly (`basic_monthly`,
 * `pro_monthly`, `premium_monthly`), with a defensive fallback for a real Play subscription
 * reporting `storeProduct.id` as "productId:basePlanId". Extracted as a pure function since
 * `Package`/`StoreProduct` are real RevenueCat SDK types with no public constructor to fake here.
 */
class MatchesProductIdTest {

    @Test
    fun `matches when the package identifier equals the product ID`() {
        assertTrue(matchesProductId(packageIdentifier = "basic_monthly", storeProductId = "irrelevant", productId = "basic_monthly"))
    }

    @Test
    fun `matches when the store product ID equals the product ID`() {
        assertTrue(matchesProductId(packageIdentifier = "irrelevant", storeProductId = "pro_monthly", productId = "pro_monthly"))
    }

    @Test
    fun `matches a Play base-plan-suffixed store product ID`() {
        assertTrue(
            matchesProductId(
                packageIdentifier = "irrelevant",
                storeProductId = "premium_monthly:premium-monthly-plan",
                productId = "premium_monthly"
            )
        )
    }

    @Test
    fun `does not match an unrelated product`() {
        assertFalse(matchesProductId(packageIdentifier = "pro_monthly", storeProductId = "pro_monthly", productId = "premium_monthly"))
    }

    @Test
    fun `does not match a mere prefix without the store's basePlanId separator`() {
        assertFalse(matchesProductId(packageIdentifier = "irrelevant", storeProductId = "premium_monthly_extra", productId = "premium_monthly"))
    }
}
