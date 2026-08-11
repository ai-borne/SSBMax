package com.ssbmax.shared.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import com.ssbmax.shared.contracts.SsbContracts

/**
 * Composition-local access to the generated design-token palette
 * (Phase 7, docs/plans/CrossPlatform_SSOT) — the same [SsbContracts.Palette]
 * values web reads from `generated/contracts.ts`'s `DesignTokens`. Provided
 * by [SSBMaxTheme] based on the active light/dark mode; use this rather than
 * referencing [SsbContracts.DesignTokens] directly so status/tier colors
 * (success, gold, emerald, ...) stay theme-reactive.
 */
val LocalDesignTokens = staticCompositionLocalOf<SsbContracts.Palette> {
    error("No design tokens provided — wrap content in SSBMaxTheme")
}

val MaterialTheme.tokens: SsbContracts.Palette
    @Composable
    @ReadOnlyComposable
    get() = LocalDesignTokens.current
