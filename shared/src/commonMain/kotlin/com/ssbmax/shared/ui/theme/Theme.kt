package com.ssbmax.shared.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import com.ssbmax.shared.domain.model.AppTheme

/**
 * SSBMax Dark Color Scheme — the real branded palette, ported from
 * `core/designsystem/.../theme/Theme.kt` (module deleted in Phase 0; git
 * history at commit `4bba56b2`). `app/ui/theme/Theme.kt` never shipped this
 * mapping — it used the unbranded default Purple/Pink M3 palette (see
 * Phase 0's exit report) — so this is recovered from history, not moved
 * verbatim from `app`.
 */
private val DarkColorScheme = darkColorScheme(
    primary = SSBColors.MilitaryGold,
    onPrimary = SSBColors.NavyBlueDark,
    primaryContainer = SSBColors.MilitaryGoldLight,
    onPrimaryContainer = SSBColors.NavyBlueDark,
    secondary = SSBColors.OliveGreenLight,
    onSecondary = SSBColors.NavyBlueDark,
    secondaryContainer = SSBColors.OliveGreenLight,
    onSecondaryContainer = SSBColors.NavyBlueDark,
    tertiary = SSBColors.NavyBlueLight,
    onTertiary = SSBColors.SurfaceLight,
    background = SSBColors.SurfaceDark,
    onBackground = SSBColors.SurfaceLight,
    surface = SSBColors.NavyBlueDark,
    onSurface = SSBColors.SurfaceLight,
    surfaceVariant = SSBColors.MilitaryGrayDark,
    onSurfaceVariant = SSBColors.MilitaryGrayLight,
    error = SSBColors.Error
)

/**
 * SSBMax Light Color Scheme — see [DarkColorScheme]'s doc for provenance.
 */
private val LightColorScheme = lightColorScheme(
    primary = SSBColors.NavyBlue,
    onPrimary = SSBColors.SurfaceLight,
    primaryContainer = SSBColors.NavyBlueLight,
    onPrimaryContainer = SSBColors.NavyBlueDark,
    secondary = SSBColors.OliveGreen,
    onSecondary = SSBColors.SurfaceLight,
    secondaryContainer = SSBColors.OliveGreenLight,
    onSecondaryContainer = SSBColors.OliveGreenDark,
    tertiary = SSBColors.MilitaryGold,
    onTertiary = SSBColors.NavyBlueDark,
    background = SSBColors.SurfaceLight,
    onBackground = SSBColors.NavyBlueDark,
    surface = SSBColors.SurfaceLight,
    onSurface = SSBColors.NavyBlueDark,
    surfaceVariant = SSBColors.MilitaryGrayLight,
    onSurfaceVariant = SSBColors.MilitaryGrayDark,
    error = SSBColors.Error
)

/**
 * Platform seam for dynamic color (Android 12+ Material You). androidMain
 * returns the real system-derived scheme when available; iosMain has no
 * platform equivalent and always returns null — see `Theme.android.kt` /
 * `Theme.ios.kt`.
 */
@Composable
internal expect fun dynamicColorSchemeOrNull(darkTheme: Boolean): ColorScheme?

/**
 * SSBMax Theme — main theme composable for the entire app, on both
 * platforms. Phase 2 of the KMP-convergence plan: moved to `commonMain` so
 * iOS (previously wrapped in a bare `MaterialTheme { }`, no branding at
 * all) and Android render identically themed content from one definition.
 *
 * @param dynamicColor defaults to `false` to preserve brand colors,
 * matching the original `core:designsystem` intent (`app/ui/theme/Theme.kt`
 * had drifted to defaulting `true`, which is what let the unbranded
 * Purple/Pink placeholder slip through unnoticed on pre-Android-12 devices
 * and get masked by Material You on newer ones).
 */
@Composable
fun SSBMaxTheme(
    appTheme: AppTheme = AppTheme.SYSTEM,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val darkTheme = when (appTheme) {
        AppTheme.LIGHT -> false
        AppTheme.DARK -> true
        AppTheme.SYSTEM -> isSystemInDarkTheme()
    }

    val colorScheme = (if (dynamicColor) dynamicColorSchemeOrNull(darkTheme) else null)
        ?: if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = SSBTypography
    ) {
        CompositionLocalProvider(
            LocalSemanticColors provides colorScheme.toSemanticColors(),
            content = content
        )
    }
}
