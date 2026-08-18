package com.ssbmax.shared.ui.theme

import androidx.compose.ui.graphics.Color
import com.ssbmax.shared.domain.model.SubscriptionTier
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * [TierColors] must mirror web's `cardTokens.ts`/`PaymentRibbon.tsx` family
 * (indigo Basic, sky Pro, amber Premium, neutral Free) so the same product
 * tier reads as the same color on every platform -- these are not arbitrary
 * internal choices, they're pinned to what web already ships.
 */
class TierColorsTest {

    @Test
    fun `FREE gradient is neutral gray, matching web's non-gradient Free treatment`() {
        assertEquals(
            listOf(Color(0xFF64748B), Color(0xFF94A3B8)),
            TierColors.gradient(SubscriptionTier.FREE)
        )
    }

    @Test
    fun `BASIC gradient is indigo to violet, matching web's basic button gradient`() {
        assertEquals(
            listOf(Color(0xFF4F46E5), Color(0xFF7C3AED)),
            TierColors.gradient(SubscriptionTier.BASIC)
        )
    }

    @Test
    fun `PRO gradient is sky to blue, matching web's pro button gradient`() {
        assertEquals(
            listOf(Color(0xFF0284C7), Color(0xFF2563EB)),
            TierColors.gradient(SubscriptionTier.PRO)
        )
    }

    @Test
    fun `PREMIUM gradient is amber, matching web's premium button gradient`() {
        assertEquals(
            listOf(Color(0xFFD97706), Color(0xFFF59E0B)),
            TierColors.gradient(SubscriptionTier.PREMIUM)
        )
    }

    @Test
    fun `accent colors are the solid form of each tier's gradient family`() {
        assertEquals(Color(0xFF94A3B8), TierColors.accent(SubscriptionTier.FREE))
        assertEquals(Color(0xFF6366F1), TierColors.accent(SubscriptionTier.BASIC))
        assertEquals(Color(0xFF0EA5E9), TierColors.accent(SubscriptionTier.PRO))
        assertEquals(Color(0xFFF59E0B), TierColors.accent(SubscriptionTier.PREMIUM))
    }
}
