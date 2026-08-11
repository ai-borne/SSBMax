package com.ssbmax.shared.ui.home.student

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.Phase1Progress
import com.ssbmax.shared.domain.model.Phase2Progress
import com.ssbmax.shared.domain.model.TestProgress
import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import kotlin.test.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Port of the pre-KMP-convergence `app/src/androidTest/.../ui/components/ComponentsTest.kt`
 * onto shared's [PhaseProgressRibbon] (Phase 6a of the KMP-convergence plan)
 * -- the [PhaseProgressRibbon]-only subset of that file. Its other half
 * (`TestContentLoadingState`/`TestContentErrorState` tests) is dropped, not
 * ported: those two Android-only components were deliberately NOT ported to
 * `shared` -- [com.ssbmax.shared.ui.oir.OIRTestScreen]'s class doc says so
 * explicitly ("small enough that a dedicated shared component isn't
 * warranted yet"), each screen inlines its own loading/error states instead.
 * There is nothing left in `shared` for those sub-tests to target.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
class PhaseProgressRibbonUiTest {

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
    }

    @Test
    fun phaseProgressRibbon_displaysPhase1() = runComposeUiTest {
        val phase1Progress = Phase1Progress(
            oirProgress = TestProgress(TestType.OIR, TestStatus.COMPLETED),
            ppdtProgress = TestProgress(TestType.PPDT, TestStatus.IN_PROGRESS)
        )

        setContent {
            com.ssbmax.shared.ui.theme.SSBMaxTheme {
                PhaseProgressRibbon(
                phase1Progress = phase1Progress,
                phase2Progress = null,
                onPhaseClick = {},
                onTopicClick = {}
                )
            }
        }

        onNodeWithText("PHASE 1", substring = true).assertIsDisplayed()
    }

    @Test
    fun phaseProgressRibbon_displaysPhase2() = runComposeUiTest {
        val phase2Progress = Phase2Progress(
            psychologyProgress = TestProgress(TestType.TAT, TestStatus.NOT_ATTEMPTED),
            gtoProgress = TestProgress(TestType.GTO_GD, TestStatus.NOT_ATTEMPTED),
            interviewProgress = TestProgress(TestType.IO, TestStatus.NOT_ATTEMPTED)
        )

        setContent {
            com.ssbmax.shared.ui.theme.SSBMaxTheme {
                PhaseProgressRibbon(
                phase1Progress = null,
                phase2Progress = phase2Progress,
                onPhaseClick = {},
                onTopicClick = {}
                )
            }
        }

        onNodeWithText("PHASE 2", substring = true).assertIsDisplayed()
    }

    @Test
    fun phaseProgressRibbon_clickablePhases() = runComposeUiTest {
        var phaseClicked = false
        val phase1Progress = Phase1Progress(
            oirProgress = TestProgress(TestType.OIR, TestStatus.NOT_ATTEMPTED),
            ppdtProgress = TestProgress(TestType.PPDT, TestStatus.NOT_ATTEMPTED)
        )

        setContent {
            com.ssbmax.shared.ui.theme.SSBMaxTheme {
                PhaseProgressRibbon(
                phase1Progress = phase1Progress,
                phase2Progress = null,
                onPhaseClick = { phaseClicked = true },
                onTopicClick = {}
                )
            }
        }

        // Phase1Card has multiple clickable descendants (the card itself,
        // each TestProgressItem row via onTopicClick, and this button via
        // onPhaseClick) -- target the "View All Tests" button specifically
        // rather than the first clickable node found, which (confirmed
        // empirically) can resolve to a TestProgressItem row instead and
        // fire onTopicClick, not onPhaseClick. It also matches twice --
        // Phase2Card renders its own "View All Tests" button even with a
        // null phase2Progress -- so take the first (Phase1's).
        onAllNodesWithText("View All Tests").onFirst().performClick()
        waitForIdle()

        assert(phaseClicked) { "Phase click callback should be called" }
    }

    // Pins the origin of the topic id this component hands upward: it must
    // always be the bare lowercase id ("oir", not e.g. "OIR" or a
    // "oir?selectedTab=2"-style templated string). `StudentHomeScreen` (the
    // one caller that used to mangle this id before forwarding it on) relies
    // on that guarantee -- see its own `homeScreen_topicClick_*` regression
    // tests for the bug this was covering.
    @Test
    fun phaseProgressRibbon_topicClick_passesCleanLowercaseTopicId() = runComposeUiTest {
        var capturedTopicId: String? = null
        val phase1Progress = Phase1Progress(
            oirProgress = TestProgress(TestType.OIR, TestStatus.NOT_ATTEMPTED),
            ppdtProgress = TestProgress(TestType.PPDT, TestStatus.NOT_ATTEMPTED)
        )

        setContent {
            com.ssbmax.shared.ui.theme.SSBMaxTheme {
                PhaseProgressRibbon(
                phase1Progress = phase1Progress,
                phase2Progress = null,
                onPhaseClick = {},
                onTopicClick = { capturedTopicId = it }
                )
            }
        }

        onNodeWithText("OIR Test", substring = false).performClick()
        waitForIdle()

        assertEquals("oir", capturedTopicId)
    }
}
