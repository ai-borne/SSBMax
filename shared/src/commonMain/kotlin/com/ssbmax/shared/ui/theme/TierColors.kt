package com.ssbmax.shared.ui.theme

import androidx.compose.ui.graphics.Color
import com.ssbmax.shared.domain.model.SubscriptionTier

/**
 * Per-[SubscriptionTier] accent palette. This is the KMP mirror of web's
 * `web/src/constants/cardTokens.ts` tier family (indigo Basic, sky Pro,
 * amber Premium, neutral Free) -- the values here are pinned to match that
 * file's Tailwind color families, not chosen independently, so the same
 * product tier reads as the same color on every platform.
 */
object TierColors {

    fun gradient(tier: SubscriptionTier): List<Color> = when (tier) {
        SubscriptionTier.FREE -> listOf(Color(0xFF64748B), Color(0xFF94A3B8))
        SubscriptionTier.BASIC -> listOf(Color(0xFF4F46E5), Color(0xFF7C3AED))
        SubscriptionTier.PRO -> listOf(Color(0xFF0284C7), Color(0xFF2563EB))
        SubscriptionTier.PREMIUM -> listOf(Color(0xFFD97706), Color(0xFFF59E0B))
    }

    fun accent(tier: SubscriptionTier): Color = when (tier) {
        SubscriptionTier.FREE -> Color(0xFF94A3B8)
        SubscriptionTier.BASIC -> Color(0xFF6366F1)
        SubscriptionTier.PRO -> Color(0xFF0EA5E9)
        SubscriptionTier.PREMIUM -> Color(0xFFF59E0B)
    }
}
