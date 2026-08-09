package com.ssbmax.shared.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.filled.Home
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi

import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasStateDescription
import androidx.compose.ui.test.hasText

import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.test.SemanticsMatcher
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import kotlin.test.assertTrue
import com.ssbmax.shared.ui.common.TestErrorState
import com.ssbmax.shared.ui.common.progressSemantics
import com.ssbmax.shared.ui.common.timerSemantics
import com.ssbmax.shared.ui.components.drawer.DrawerExpandableSection
import com.ssbmax.shared.ui.components.drawer.DrawerMenuItem
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** Regression contract for reusable controls migrated in accessibility Phase 3. */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
class AccessibilityPrimitivesUiTest {

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
    }

    @Test
    fun sharedTimerAndProgressSemantics_exposeLocalizedDescriptions() = runComposeUiTest {
        setContent {
            Box(Modifier.timerSemantics("Time remaining: 10 seconds", 10, 30))
            Box(Modifier.progressSemantics("Question progress: 50 percent", 5f, 10f))
        }

        onNodeWithContentDescription("Time remaining: 10 seconds").assertExists()
        onNodeWithContentDescription("Question progress: 50 percent").assertExists()
    }

    @Test
    fun selectedDrawerItem_exposesSelectedState_andIsActionable() = runComposeUiTest {
        setContent {
            DrawerMenuItem(
                icon = Icons.Default.Home,
                title = "Home",
                onClick = {},
                isSelected = true
            )
        }

        onNode(hasText("Home") and hasClickAction()).assertIsSelected()
    }

    @Test
    fun expandableDrawerSection_exposesState_withoutDuplicateChevronAction() = runComposeUiTest {
        var toggled = false
        setContent {
            DrawerExpandableSection(
                icon = Icons.Default.Home,
                title = "Phase 1",
                expanded = false,
                onToggle = { toggled = true }
            ) { }
        }

        onNode(hasText("Phase 1") and hasStateDescription("Expand")).assertIsDisplayed()
        onNode(hasStateDescription("Expand") and hasClickAction()).performClick()
        assertTrue(toggled, "Expanding a section must invoke its single parent action")
        onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.ContentDescription))
            .assertDoesNotExist()
    }

    @Test
    fun retryState_exposesAction_andInvokesCallback() = runComposeUiTest {
        var retried = false
        setContent {
            TestErrorState(error = TestError.LOAD_FAILED, onRetry = { retried = true })
        }

        onNodeWithText("Failed to load test. Please try again.").assertIsDisplayed()
        onNodeWithText("Retry").performClick()
        assertTrue(retried, "Retry must invoke the supplied callback")
    }
}
