package com.ssbmax.shared.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * UI status colors with stable meaning across features and platforms.
 *
 * Each role has a paired Material color rather than relying on hue alone:
 * consumers must also provide text, icon, or state semantics as appropriate.
 */
data class SemanticColors(
    val success: Color,
    val onSuccess: Color,
    val error: Color,
    val onError: Color,
    val warning: Color,
    val onWarning: Color,
    val informational: Color,
    val onInformational: Color,
    val selected: Color,
    val onSelected: Color,
    val disabled: Color,
    val onDisabled: Color,
    val skipped: Color,
    val onSkipped: Color,
    val testProgress: Color,
    val onTestProgress: Color
)

/** Maps semantic roles to the active Material theme, keeping business meaning centralized. */
fun ColorScheme.toSemanticColors(): SemanticColors = SemanticColors(
    success = secondaryContainer,
    onSuccess = onSecondaryContainer,
    error = errorContainer,
    onError = onErrorContainer,
    warning = tertiaryContainer,
    onWarning = onTertiaryContainer,
    informational = primaryContainer,
    onInformational = onPrimaryContainer,
    selected = primaryContainer,
    onSelected = onPrimaryContainer,
    disabled = surfaceVariant,
    onDisabled = onSurface,
    skipped = background,
    onSkipped = onBackground,
    testProgress = primary,
    onTestProgress = onPrimary
)

val LocalSemanticColors = staticCompositionLocalOf<SemanticColors> {
    error("No SemanticColors provided")
}

val MaterialTheme.semanticColors: SemanticColors
    @Composable
    @ReadOnlyComposable
    get() = LocalSemanticColors.current
