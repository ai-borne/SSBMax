package com.ssbmax.shared.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.model.AppTheme

/**
 * SSBMax Dark Color Scheme — sourced from the generated design-token
 * contract (Phase 7, docs/plans/CrossPlatform_SSOT). Retired the
 * navy/olive/military-gold `SSBColors` palette in favour of the slate/sky
 * palette web already shipped with light+dark support; see
 * `contracts/tokens.yaml`'s header comment for why this was a real product
 * decision (full unification), not a mechanical dedup.
 *
 * `secondaryContainer`/`tertiaryContainer`/`errorContainer` are pinned to
 * solid (non-`Subtle`) tokens rather than left to
 * `darkColorScheme()`/`lightColorScheme()`'s un-derived Material baseline
 * defaults (that default IS the unbranded purple/pink [SSBMaxTheme] already
 * called out once). Every `onX`/`onXContainer` painted on top of one of
 * those brand-hue fills is literal [Color.Black]/[Color.White], not
 * `textPrimary`/`bgPrimary` — those surface-neutral tokens are tuned for
 * near-black-on-near-white *surface* reading and, for at least one fill
 * (`accent`, WCAG relative luminance ~0.21), land in a dead zone where
 * neither near-black nor near-white clears 4.5:1 AA, so only a true
 * extreme passes; see [SemanticUiStandardsTest] and [contrastRatio], and
 * `contracts/tokens.yaml`'s header comment.
 */
private val DarkColorScheme = darkColorScheme(
    primary = SsbContracts.DesignTokens.Dark.accent,
    onPrimary = Color(0xFF082F49),
    primaryContainer = SsbContracts.DesignTokens.Dark.accentContainer,
    onPrimaryContainer = SsbContracts.DesignTokens.Dark.onAccentContainer,
    secondary = SsbContracts.DesignTokens.Dark.emerald,
    onSecondary = Color(0xFF022C22),
    secondaryContainer = SsbContracts.DesignTokens.Dark.emeraldContainer,
    onSecondaryContainer = SsbContracts.DesignTokens.Dark.onEmeraldContainer,
    tertiary = SsbContracts.DesignTokens.Dark.gold,
    onTertiary = Color(0xFF451A03),
    tertiaryContainer = SsbContracts.DesignTokens.Dark.warningContainer,
    onTertiaryContainer = SsbContracts.DesignTokens.Dark.onWarningContainer,
    background = SsbContracts.DesignTokens.Dark.bgPrimary,
    onBackground = SsbContracts.DesignTokens.Dark.textPrimary,
    surface = SsbContracts.DesignTokens.Dark.bgCard,
    onSurface = SsbContracts.DesignTokens.Dark.textPrimary,
    surfaceVariant = SsbContracts.DesignTokens.Dark.bgElevated,
    onSurfaceVariant = SsbContracts.DesignTokens.Dark.textSecondary,
    error = SsbContracts.DesignTokens.Dark.danger,
    onError = Color.Black,
    errorContainer = SsbContracts.DesignTokens.Dark.dangerContainer,
    onErrorContainer = SsbContracts.DesignTokens.Dark.onDangerContainer
)

/**
 * SSBMax Light Color Scheme — see [DarkColorScheme]'s doc for provenance.
 */
private val LightColorScheme = lightColorScheme(
    primary = SsbContracts.DesignTokens.Light.accent,
    onPrimary = Color.Black,
    primaryContainer = SsbContracts.DesignTokens.Light.accentContainer,
    onPrimaryContainer = SsbContracts.DesignTokens.Light.onAccentContainer,
    secondary = SsbContracts.DesignTokens.Light.emerald,
    onSecondary = Color.Black,
    secondaryContainer = SsbContracts.DesignTokens.Light.emeraldContainer,
    onSecondaryContainer = SsbContracts.DesignTokens.Light.onEmeraldContainer,
    tertiary = SsbContracts.DesignTokens.Light.gold,
    onTertiary = Color.Black,
    tertiaryContainer = SsbContracts.DesignTokens.Light.warningContainer,
    onTertiaryContainer = SsbContracts.DesignTokens.Light.onWarningContainer,
    background = SsbContracts.DesignTokens.Light.bgPrimary,
    onBackground = SsbContracts.DesignTokens.Light.textPrimary,
    surface = SsbContracts.DesignTokens.Light.bgCard,
    onSurface = SsbContracts.DesignTokens.Light.textPrimary,
    surfaceVariant = SsbContracts.DesignTokens.Light.bgElevated,
    onSurfaceVariant = SsbContracts.DesignTokens.Light.textSecondary,
    error = SsbContracts.DesignTokens.Light.danger,
    onError = Color.White,
    errorContainer = SsbContracts.DesignTokens.Light.dangerContainer,
    onErrorContainer = SsbContracts.DesignTokens.Light.onDangerContainer
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
            LocalDesignTokens provides if (darkTheme) SsbContracts.DesignTokens.Dark else SsbContracts.DesignTokens.Light,
            content = content
        )
    }
}
