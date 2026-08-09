package com.ssbmax.shared.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * SSB Score Color Theme
 * Centralized colors for OLQ scoring (SSB 1-10 scale, lower is better)
 */
object SSBScoreColors {
    // Score colors based on SSB scale
    val Excellent = SSBColors.Success  // Green - scores ≤ 5
    val Average = SSBColors.MilitaryGold   // Amber - scores 6-7
    val NeedsWork = SSBColors.Error // Red - scores ≥ 8

    // Score thresholds (SSB scale)
    const val EXCELLENT_THRESHOLD = 5f
    const val AVERAGE_THRESHOLD = 7f

    /**
     * Get appropriate color for a score
     * @param score SSB scale score (1-10, lower is better)
     * @return Color for the score
     */
    fun getScoreColor(score: Float): Color = when {
        score <= EXCELLENT_THRESHOLD -> Excellent
        score <= AVERAGE_THRESHOLD -> Average
        else -> NeedsWork
    }

    /**
     * Get transparent variant of score color for backgrounds
     * @param score SSB scale score
     * @param alpha Transparency level (0.0f - 1.0f)
     * @return Color with alpha applied
     */
    fun getScoreColorWithAlpha(score: Float, alpha: Float = 0.2f): Color {
        return getScoreColor(score).copy(alpha = alpha)
    }
}
