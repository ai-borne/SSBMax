package com.ssbmax.shared.platform.billing

import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Phase 4 (RevenueCat integration): pins [SSBMaxProductIds.forTier] as the one place a
 * [SubscriptionTier] resolves to a purchasable product ID -- RevenueCat's purchase flow
 * (`UpgradeViewModel.upgradeToPlan`) depends on this covering every paid tier and returning
 * null only for FREE.
 */
class SSBMaxProductIdsTest {

    @Test
    fun `FREE has no product to purchase`() {
        assertNull(SSBMaxProductIds.forTier(SubscriptionTier.FREE))
    }

    @Test
    fun `every paid tier maps to a distinct product ID from ALL`() {
        val paidTiers = listOf(SubscriptionTier.BASIC, SubscriptionTier.PRO, SubscriptionTier.PREMIUM)
        val productIds = paidTiers.map { SSBMaxProductIds.forTier(it) }

        for (productId in productIds) {
            assertEquals(true, productId in SSBMaxProductIds.ALL, "$productId should be a known product ID")
        }
        assertEquals(productIds.toSet().size, productIds.size, "each paid tier must map to a distinct product ID")
    }
}
