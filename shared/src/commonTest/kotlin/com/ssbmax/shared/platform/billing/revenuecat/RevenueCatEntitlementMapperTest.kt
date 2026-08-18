package com.ssbmax.shared.platform.billing.revenuecat

import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Phase 4 (RevenueCat integration): pins the cumulative-entitlement -> tier mapping this
 * codebase's whole purchase flow depends on. The RC dashboard is configured so a higher-tier
 * product grants every lower entitlement too (`premium_monthly` grants basic+pro+premium
 * together); this mapper only has to pick the highest one present, never combine tiers itself.
 */
class RevenueCatEntitlementMapperTest {

    @Test
    fun `no active entitlements maps to FREE`() {
        assertEquals(SubscriptionTier.FREE, RevenueCatEntitlementMapper.toTier(emptySet()))
    }

    @Test
    fun `basic entitlement alone maps to BASIC`() {
        assertEquals(SubscriptionTier.BASIC, RevenueCatEntitlementMapper.toTier(setOf("basic")))
    }

    @Test
    fun `basic plus pro maps to PRO, the highest present`() {
        assertEquals(SubscriptionTier.PRO, RevenueCatEntitlementMapper.toTier(setOf("basic", "pro")))
    }

    @Test
    fun `basic plus pro plus premium maps to PREMIUM, the highest present`() {
        assertEquals(
            SubscriptionTier.PREMIUM,
            RevenueCatEntitlementMapper.toTier(setOf("basic", "pro", "premium"))
        )
    }

    @Test
    fun `an unrecognized entitlement identifier alone maps to FREE, not a crash`() {
        assertEquals(SubscriptionTier.FREE, RevenueCatEntitlementMapper.toTier(setOf("interview_topup")))
    }

    @Test
    fun `RevenueCatPurchaseOutcome tier delegates to the mapper`() {
        val outcome = RevenueCatPurchaseOutcome(activeEntitlementIds = setOf("pro"))
        assertEquals(SubscriptionTier.PRO, outcome.tier)
    }
}
