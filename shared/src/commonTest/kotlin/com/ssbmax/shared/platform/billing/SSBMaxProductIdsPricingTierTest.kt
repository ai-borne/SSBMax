package com.ssbmax.shared.platform.billing

import com.ssbmax.shared.contracts.SsbContracts
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * L4 (Payment Ecosystem Hardening plan, Phase 12), second bullet: Razorpay's app-side plan ids are
 * *derived* from `contracts/pricing.yaml` (`${tier.lowercase()}_monthly`, `PricingTiers` in the
 * generated contract), but [SSBMaxProductIds]' RevenueCat product ids are hand-typed constants
 * that must separately match whatever products a human configured in the RC dashboard. Adding or
 * renaming a tier in `pricing.yaml` updates the Razorpay side automatically and the RevenueCat
 * side not at all -- silently, on the mobile half only, discovered the first time a real purchase
 * for the new tier fails to resolve an RC package.
 *
 * This pins the two together: every non-FREE tier in the generated pricing contract must have a
 * matching `SSBMaxProductIds` constant, and vice versa -- so the next tier change fails this test
 * instead of a purchase.
 */
class SSBMaxProductIdsPricingTierTest {

    @Test
    fun `every non-FREE pricing tier has a matching SSBMaxProductIds constant`() {
        val expectedProductIds = SsbContracts.Pricing.TIERS
            .map { it.tier }
            .filter { it != "FREE" }
            .map { "${it.lowercase()}_monthly" }
            .toSet()

        val actualProductIds = setOf(
            SSBMaxProductIds.BASIC_MONTHLY,
            SSBMaxProductIds.PRO_MONTHLY,
            SSBMaxProductIds.PREMIUM_MONTHLY
        )

        assertEquals(
            expectedProductIds,
            actualProductIds,
            "pricing.yaml's tiers and SSBMaxProductIds' hand-configured RC product ids have drifted -- " +
                "a tier was added/renamed on one side without the other. The RC dashboard product must be " +
                "created/renamed by hand to match before this can pass."
        )
    }

    @Test
    fun `SSBMaxProductIds forTier resolves every non-FREE tier to the derived product id`() {
        for (tierPrice in SsbContracts.Pricing.TIERS) {
            if (tierPrice.tier == "FREE") continue
            val tier = com.ssbmax.shared.domain.model.SubscriptionTier.valueOf(tierPrice.tier)
            assertEquals("${tierPrice.tier.lowercase()}_monthly", SSBMaxProductIds.forTier(tier))
        }
    }
}
