package com.ssbmax.shared.ui.srt

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.SRTCategory
import com.ssbmax.shared.domain.model.SRTPhase
import com.ssbmax.shared.domain.model.SRTSituation
import com.ssbmax.shared.domain.model.SRTSituationResponse
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.srt.SRTTestUiState
import com.ssbmax.shared.presentation.srt.SRTTestViewModel
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Port of the pre-KMP-convergence `app/src/androidTest/.../ui/tests/srt/SRTTestScreenTest.kt`
 * onto shared's [SRTTestScreen] -- Phase 6a-2 of the KMP-convergence plan,
 * closing one of the five coverage gaps 6a named but deliberately deferred.
 *
 * Real structural drift from the pre-cutover test this replaces, verified by
 * reading [SRTTestScreen]/`SRTInstructionsPhase.kt`/`SRTInProgressPhase.kt`
 * rather than assumed:
 * - No bare "SRT Test" title renders anywhere in this port (the intro card
 *   shows `srt_full_title` = "SRT - Situation Reaction Test" only) -- that
 *   half of `instructionsScreen_displaysCorrectly`'s assertions is dropped.
 * - Situation counter reads "Situation N of 60" (`srt_situation_number`),
 *   not "N/60".
 * - `SRTResponseInput`'s field has both a label ("Your Response") and a
 *   placeholder ("Describe what YOU would do in this situation...") --
 *   Material3 only shows a placeholder once the field is focused when a
 *   label is also present, so `responseInput_isDisplayedAndInteractable`
 *   asserts on the always-visible label instead (verified empirically: the
 *   placeholder assertion failed `assertIsDisplayed()`, not `assertExists()`).
 * - Exit icon's content description is "Back" (`srt_back_cd`), not "Exit";
 *   the dialog it opens is still titled "Exit Test?".
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class SRTTestScreenUiTest {

    private lateinit var mockViewModel: SRTTestViewModel
    private lateinit var uiStateFlow: MutableStateFlow<SRTTestUiState>
    private lateinit var testSituations: List<SRTSituation>

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        testSituations = (1..60).map { position ->
            SRTSituation(
                id = "srt-$position",
                situation = "Test situation number $position",
                sequenceNumber = position,
                category = SRTCategory.LEADERSHIP
            )
        }
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(
            SRTTestUiState(isLoading = false, testId = "test-123", situations = testSituations, phase = SRTPhase.INSTRUCTIONS)
        )
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun instructionsScreen_displaysCorrectly() = runComposeUiTest {
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Situation Reaction Test", substring = true).assertIsDisplayed()
        onNodeWithText("Start Test").assertIsDisplayed()
    }

    @Test
    fun startButton_startsTest() = runComposeUiTest {
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Start Test").performClick()

        verify { mockViewModel.startTest() }
    }

    @Test
    fun activePhase_displaysSituationAndTimer() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(phase = SRTPhase.IN_PROGRESS, currentSituationIndex = 0)
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Situation 1 of 60", substring = true).assertIsDisplayed()
    }

    @Test
    fun responseInput_isDisplayedAndInteractable() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SRTPhase.IN_PROGRESS,
            currentSituationIndex = 0,
            currentResponse = ""
        )
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Your Response").assertIsDisplayed()
    }

    @Test
    fun progressIndicator_showsCorrectProgress() = runComposeUiTest {
        // 15 completed responses, now on the 16th situation (index 15).
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SRTPhase.IN_PROGRESS,
            currentSituationIndex = 15,
            responses = testSituations.take(15).mapIndexed { index, situation ->
                SRTSituationResponse(
                    situationId = situation.id,
                    situation = situation.situation,
                    response = "Response $index",
                    charactersCount = 20,
                    timeTakenSeconds = 20,
                    submittedAt = index.toLong()
                )
            }
        )
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Situation 16 of 60", substring = true).assertIsDisplayed()
    }

    @Test
    fun activePhase_exposesRemainingTimeSemantics() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SRTPhase.IN_PROGRESS,
            currentSituationIndex = 0,
            timeRemaining = 120
        )
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithContentDescription("Time remaining: 120 seconds").assertIsDisplayed()
    }

    @Test
    fun completedTest_triggersCallback() = runComposeUiTest {
        val submissionId = "sub-srt-789"
        var completedId: String? = null
        var completedType: SubscriptionTier? = null
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SRTPhase.SUBMITTED,
            isSubmitted = true,
            submissionId = submissionId,
            subscriptionType = SubscriptionTier.FREE
        )

        setContent {
            SRTTestScreen(
                testId = "test-123",
                viewModel = mockViewModel,
                onTestComplete = { id, type -> completedId = id; completedType = type }
            )
        }
        waitForIdle()

        assert(completedId == submissionId) { "Expected callback with $submissionId, got $completedId" }
        assert(completedType == SubscriptionTier.FREE)
    }

    @Test
    fun loadingState_showsLoadingIndicator() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = true)
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Loading", substring = true).assertIsDisplayed()
    }

    @Test
    fun errorState_displaysErrorMessage() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = false, error = TestError.LOAD_FAILED)
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Failed to load test", substring = true).assertIsDisplayed()
    }

    @Test
    fun backButton_showsExitDialog() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(phase = SRTPhase.IN_PROGRESS, currentSituationIndex = 20)
        setContent { SRTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithContentDescription("Back").performClick()

        onNodeWithText("Exit Test", substring = true).assertIsDisplayed()
    }
}
