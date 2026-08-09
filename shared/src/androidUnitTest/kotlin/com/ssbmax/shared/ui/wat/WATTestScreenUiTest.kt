package com.ssbmax.shared.ui.wat

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.WATPhase
import com.ssbmax.shared.domain.model.WATWord
import com.ssbmax.shared.domain.model.WATWordResponse
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.wat.WATTestUiState
import com.ssbmax.shared.presentation.wat.WATTestViewModel
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
 * Port of the pre-KMP-convergence `app/src/androidTest/.../ui/tests/wat/WATTestScreenTest.kt`
 * onto shared's [WATTestScreen] -- Phase 6a-2 of the KMP-convergence plan,
 * closing one of the five coverage gaps 6a named but deliberately deferred.
 *
 * Real structural drift from the pre-cutover test this replaces, verified by
 * reading [WATTestScreen]/`WATInstructionsPhase.kt`/`WATInProgressPhase.kt`
 * rather than assumed:
 * - No bare "WAT Test" title renders anywhere in this port (the intro card
 *   shows `wat_full_title` = "WAT - Word Association Test" only) -- that
 *   half of `instructionsScreen_displaysCorrectly`'s assertions is dropped.
 * - Progress format is "N / 60" with spaces (`wat_progress_format`), not
 *   "N/60".
 * - Exit icon's content description is "Back" (`wat_back_cd`), not "Exit";
 *   the dialog it opens is still titled "Exit Test?".
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class WATTestScreenUiTest {

    private lateinit var mockViewModel: WATTestViewModel
    private lateinit var uiStateFlow: MutableStateFlow<WATTestUiState>
    private lateinit var testWords: List<WATWord>

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        testWords = listOf(WATWord(id = "wat-1", word = "BRAVE", sequenceNumber = 1)) +
            (2..60).map { position -> WATWord(id = "wat-$position", word = "WORD$position", sequenceNumber = position) }
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(
            WATTestUiState(isLoading = false, testId = "test-123", words = testWords, phase = WATPhase.INSTRUCTIONS)
        )
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun instructionsScreen_displaysCorrectly() = runComposeUiTest {
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Word Association Test", substring = true).assertIsDisplayed()
        onNodeWithText("Start Test").assertIsDisplayed()
    }

    @Test
    fun startButton_startsTest() = runComposeUiTest {
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Start Test").performClick()

        verify { mockViewModel.startTest() }
    }

    @Test
    fun activePhase_displaysWordAndTimer() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(phase = WATPhase.IN_PROGRESS, currentWordIndex = 0, timeRemaining = 15)
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("BRAVE").assertIsDisplayed()
        onNodeWithText("15", substring = true).assertIsDisplayed()
        onNodeWithText("1 / 60", substring = true).assertIsDisplayed()
    }

    @Test
    fun responseInput_isDisplayedAndInteractable() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(phase = WATPhase.IN_PROGRESS, currentWordIndex = 0, currentResponse = "")
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Type your response...", substring = true).assertIsDisplayed()
    }

    @Test
    fun progressIndicator_showsCorrectProgress() = runComposeUiTest {
        // 10 completed responses, now on the 11th word (index 10).
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = WATPhase.IN_PROGRESS,
            currentWordIndex = 10,
            responses = testWords.take(10).mapIndexed { index, word ->
                WATWordResponse(wordId = word.id, word = word.word, response = "Response $index", timeTakenSeconds = 10, submittedAt = index.toLong())
            }
        )
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("11 / 60", substring = true).assertIsDisplayed()
    }

    @Test
    fun activePhase_exposesRemainingTimeSemantics() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = WATPhase.IN_PROGRESS,
            currentWordIndex = 0,
            timeRemaining = 12
        )
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithContentDescription("Time remaining: 12 seconds").assertIsDisplayed()
    }

    @Test
    fun completedTest_triggersCallback() = runComposeUiTest {
        val submissionId = "sub-456"
        var completedId: String? = null
        var completedType: SubscriptionTier? = null
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = WATPhase.SUBMITTED,
            isSubmitted = true,
            submissionId = submissionId,
            subscriptionType = SubscriptionTier.FREE
        )

        setContent {
            WATTestScreen(
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
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Loading", substring = true).assertIsDisplayed()
    }

    @Test
    fun errorState_displaysErrorMessage() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = false, error = TestError.LOAD_FAILED)
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Failed to load test", substring = true).assertIsDisplayed()
    }

    @Test
    fun backButton_showsExitDialog() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(phase = WATPhase.IN_PROGRESS, currentWordIndex = 5)
        setContent { WATTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithContentDescription("Back").performClick()

        onNodeWithText("Exit Test", substring = true).assertIsDisplayed()
    }
}
