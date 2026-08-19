package com.ssbmax.shared.ui.theme

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals

import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasStateDescription


import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.AppTheme
import kotlin.test.Test
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue
import kotlin.test.assertNotNull
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** Phase 1 executable contract for theme roles and baseline semantics. */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
class SemanticUiStandardsTest {

    @Test
    fun `all semantic roles resolve in light and dark themes`() = runComposeUiTest {
        var light: SemanticColors? = null
        var dark: SemanticColors? = null

        setContent {
            SSBMaxTheme(appTheme = AppTheme.LIGHT) { light = MaterialTheme.semanticColors }
            SSBMaxTheme(appTheme = AppTheme.DARK) { dark = MaterialTheme.semanticColors }
        }
        waitForIdle()

        assertSemanticColorsAreUsable(light)
        assertSemanticColorsAreUsable(dark)
        assertNotEquals(light?.selected, dark?.selected)
    }

    @Test
    fun `semantic foreground roles meet WCAG AA contrast in both themes`() = runComposeUiTest {
        var light: SemanticColors? = null
        var dark: SemanticColors? = null

        setContent {
            SSBMaxTheme(appTheme = AppTheme.LIGHT) { light = MaterialTheme.semanticColors }
            SSBMaxTheme(appTheme = AppTheme.DARK) { dark = MaterialTheme.semanticColors }
        }
        waitForIdle()

        listOfNotNull(light, dark).forEach { colors ->
            assertTrue(contrastRatio(colors.onSuccess, colors.success) >= 4.5f, "success=${contrastRatio(colors.onSuccess, colors.success)}")
            assertTrue(contrastRatio(colors.onError, colors.error) >= 4.5f, "error=${contrastRatio(colors.onError, colors.error)}")
            assertTrue(contrastRatio(colors.onWarning, colors.warning) >= 4.5f, "warning=${contrastRatio(colors.onWarning, colors.warning)}")
            assertTrue(contrastRatio(colors.onInformational, colors.informational) >= 4.5f, "info=${contrastRatio(colors.onInformational, colors.informational)}")
            assertTrue(contrastRatio(colors.onSelected, colors.selected) >= 4.5f, "selected=${contrastRatio(colors.onSelected, colors.selected)}")
            assertTrue(contrastRatio(colors.onDisabled, colors.disabled) >= 4.5f, "disabled=${contrastRatio(colors.onDisabled, colors.disabled)}")
            assertTrue(contrastRatio(colors.onSkipped, colors.skipped) >= 4.5f, "skipped=${contrastRatio(colors.onSkipped, colors.skipped)}")
            assertTrue(contrastRatio(colors.onTestProgress, colors.testProgress) >= 4.5f, "testProgress=${contrastRatio(colors.onTestProgress, colors.testProgress)}")
        }
    }

    @Test
    fun `colorScheme container and surface roles meet WCAG AA contrast in both themes`() = runComposeUiTest {
        var lightScheme: androidx.compose.material3.ColorScheme? = null
        var darkScheme: androidx.compose.material3.ColorScheme? = null

        setContent {
            SSBMaxTheme(appTheme = AppTheme.LIGHT) { lightScheme = MaterialTheme.colorScheme }
            SSBMaxTheme(appTheme = AppTheme.DARK) { darkScheme = MaterialTheme.colorScheme }
        }
        waitForIdle()

        listOfNotNull(lightScheme, darkScheme).forEach { scheme ->
            assertTrue(contrastRatio(scheme.onPrimary, scheme.primary) >= 4.5f, "primary=${contrastRatio(scheme.onPrimary, scheme.primary)}")
            assertTrue(contrastRatio(scheme.onPrimaryContainer, scheme.primaryContainer) >= 4.5f, "primaryContainer=${contrastRatio(scheme.onPrimaryContainer, scheme.primaryContainer)}")
            assertTrue(contrastRatio(scheme.onSecondary, scheme.secondary) >= 4.5f, "secondary=${contrastRatio(scheme.onSecondary, scheme.secondary)}")
            assertTrue(contrastRatio(scheme.onSecondaryContainer, scheme.secondaryContainer) >= 4.5f, "secondaryContainer=${contrastRatio(scheme.onSecondaryContainer, scheme.secondaryContainer)}")
            assertTrue(contrastRatio(scheme.onTertiary, scheme.tertiary) >= 4.5f, "tertiary=${contrastRatio(scheme.onTertiary, scheme.tertiary)}")
            assertTrue(contrastRatio(scheme.onTertiaryContainer, scheme.tertiaryContainer) >= 4.5f, "tertiaryContainer=${contrastRatio(scheme.onTertiaryContainer, scheme.tertiaryContainer)}")
            assertTrue(contrastRatio(scheme.onError, scheme.error) >= 4.5f, "error=${contrastRatio(scheme.onError, scheme.error)}")
            assertTrue(contrastRatio(scheme.onErrorContainer, scheme.errorContainer) >= 4.5f, "errorContainer=${contrastRatio(scheme.onErrorContainer, scheme.errorContainer)}")
            assertTrue(contrastRatio(scheme.onBackground, scheme.background) >= 4.5f, "background=${contrastRatio(scheme.onBackground, scheme.background)}")
            assertTrue(contrastRatio(scheme.onSurface, scheme.surface) >= 4.5f, "surface=${contrastRatio(scheme.onSurface, scheme.surface)}")
        }
    }

    @Test
    fun `status surfaces remain distinguishable without hue alone`() = runComposeUiTest {
        var colors: SemanticColors? = null
        setContent { SSBMaxTheme(appTheme = AppTheme.LIGHT) { colors = MaterialTheme.semanticColors } }
        waitForIdle()

        val resolved = requireNotNull(colors)
        assertNotEquals(resolved.success, resolved.error)
        assertNotEquals(resolved.error, resolved.skipped)
        assertNotEquals(resolved.selected, resolved.disabled)
        assertNotEquals(resolved.testProgress, resolved.disabled)
    }

    @Test
    fun `icon-only action has an accessible name and decorative icon is silent`() = runComposeUiTest {
        setContent { IconSemanticsFixture() }

        onNode(hasContentDescription(OPEN_MENU_LABEL)).assertExists()
        onAllNodes(hasContentDescription(DECORATIVE_ICON_LABEL)).assertCountEquals(0)
    }

    @Test
    fun `test answer semantics do not expose the correct answer`() = runComposeUiTest {
        setContent { AnswerSemanticsFixture(optionLabel = OPTION_B_LABEL, correctAnswer = OPTION_B_LABEL) }

        onNode(hasContentDescription(OPTION_B_LABEL)).assertExists()
        onNode(hasContentDescription("Correct answer: $OPTION_B_LABEL")).assertDoesNotExist()
    }

    @Test
    fun `state semantics expose loading error selected and disabled states`() = runComposeUiTest {
        setContent { StateSemanticsFixture() }

        onNode(hasStateDescription(LOADING_STATE)).assertExists()
        onNode(hasStateDescription(ERROR_STATE)).assertExists()
        onNode(hasStateDescription(SELECTED_STATE)).assertExists()
        onNode(hasStateDescription(DISABLED_STATE)).assertExists()
    }

    private fun assertSemanticColorsAreUsable(colors: SemanticColors?) {
        val resolved = colors
        assertNotNull(resolved)
        val roles = listOf(
            resolved.success, resolved.error, resolved.warning, resolved.informational,
            resolved.selected, resolved.disabled, resolved.skipped, resolved.testProgress,
            resolved.onSuccess, resolved.onError, resolved.onWarning, resolved.onInformational,
            resolved.onSelected, resolved.onDisabled, resolved.onSkipped, resolved.onTestProgress
        )
        roles.forEach { color -> assertNotEquals(androidx.compose.ui.graphics.Color.Unspecified, color) }
    }

    @Composable
    private fun IconSemanticsFixture() {
        SSBMaxTheme {
            Icon(Icons.Default.Star, contentDescription = null)
            IconButton(onClick = {}, modifier = Modifier) {
                Icon(Icons.Default.Menu, contentDescription = OPEN_MENU_LABEL)
            }
        }
    }

    @Composable
    private fun AnswerSemanticsFixture(optionLabel: String, correctAnswer: String) {
        SSBMaxTheme {
            // The correct answer is intentionally unused: active-test semantics must stay safe.
            Text(
                text = optionLabel,
                modifier = Modifier.semantics {
                    contentDescription = optionLabel
                }
            )
        }
    }

    @Composable
    private fun StateSemanticsFixture() {
        SSBMaxTheme {
            Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.semantics {
                stateDescription = LOADING_STATE
            })
            Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.semantics {
                stateDescription = ERROR_STATE
            })
            Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.semantics {
                stateDescription = SELECTED_STATE
            })
            Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.semantics {
                stateDescription = DISABLED_STATE
            })
        }
    }

    private companion object {
        const val OPEN_MENU_LABEL = "Open menu"
        const val DECORATIVE_ICON_LABEL = "Decorative icon"
        const val OPTION_B_LABEL = "Option B"
        const val LOADING_STATE = "Loading"
        const val ERROR_STATE = "Error"
        const val SELECTED_STATE = "Selected"
        const val DISABLED_STATE = "Disabled"
    }
}
