package com.ssbmax.shared.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Centralized spacing system for SSBMax — Phase 5 KMP port of
 * `core/designsystem/.../theme/Spacing.kt` — a straight copy rather than a
 * `:core:designsystem` dependency (that module is Android-only, not a KMP
 * target). Unlike colors (retired to the generated design-token contract in
 * Phase 7, docs/plans/CrossPlatform_SSOT), spacing/dimension tokens stay
 * platform-specific: Tailwind's numeric spacing scale already systematizes
 * web's layout, so there is no equivalent fork to unify here.
 * Follows a 4dp grid system (Material Design 3).
 */
object Spacing {
    // ========== Base Spacing (4dp increments) ==========

    /** 4dp - Extra small spacing for tight elements */
    val extraSmall: Dp = 4.dp

    /** 8dp - Small spacing for icons, chip gaps */
    val small: Dp = 8.dp

    /** 12dp - Medium spacing for content gaps */
    val medium: Dp = 12.dp

    /** 16dp - Large spacing for padding, section gaps */
    val large: Dp = 16.dp

    /** 20dp - Extra large spacing for major sections */
    val extraLarge: Dp = 20.dp

    // ========== Component-Specific Spacing ==========

    /** Standard card padding (16dp) */
    val cardPadding: Dp = 16.dp

    /** Card corner radius for most cards (12dp) */
    val cardCornerRadius: Dp = 12.dp

    /** Large card corner radius for prominent cards (16dp) */
    val cardCornerRadiusLarge: Dp = 16.dp

    // ========== Icon Sizes ==========

    /** Extra small icon size (16dp) - for status indicators */
    val iconSizeExtraSmall: Dp = 16.dp

    /** Small icon size (18dp) - for chevrons, arrows */
    val iconSizeSmall: Dp = 18.dp

    /** Standard icon size (24dp) - default Material icon size */
    val iconSize: Dp = 24.dp

    /** Large icon size (28dp) - for prominent icons */
    val iconSizeLarge: Dp = 28.dp

    /** Button/interactive icon size (40dp) */
    val iconButtonSize: Dp = 40.dp

    // ========== Card Heights ==========

    /** Stats card fixed height (84dp) */
    val statsCardHeight: Dp = 84.dp

    /** Phase progress card height (280dp) */
    val phaseCardHeight: Dp = 280.dp

    // ========== Section Spacing ==========

    /** Spacing between major sections (20dp) */
    val sectionSpacing: Dp = 20.dp
}
