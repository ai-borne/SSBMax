package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubscriptionTier
import org.junit.Assert.assertEquals
import org.junit.Test

class GitLiveSubscriptionRepositoryDeriveTierTest {

    @Test
    fun `expiryDate in the past overrides stored tier to FREE`() {
        val now = 1_000_000L
        val result = deriveEffectiveTier(SubscriptionTier.PREMIUM, expiryDate = now - 1, nowMillis = now)
        assertEquals(SubscriptionTier.FREE, result)
    }

    @Test
    fun `expiryDate in the future keeps stored tier`() {
        val now = 1_000_000L
        val result = deriveEffectiveTier(SubscriptionTier.PREMIUM, expiryDate = now + 1, nowMillis = now)
        assertEquals(SubscriptionTier.PREMIUM, result)
    }

    @Test
    fun `null expiryDate keeps stored tier (legacy grandfathered case)`() {
        val now = 1_000_000L
        val result = deriveEffectiveTier(SubscriptionTier.PREMIUM, expiryDate = null, nowMillis = now)
        assertEquals(SubscriptionTier.PREMIUM, result)
    }
}
