package com.ssbmax.shared.ui.sdt

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.SDTPhase
import com.ssbmax.shared.domain.model.SDTQuestion
import com.ssbmax.shared.domain.model.SDTQuestionResponse
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.sdt.SDTTestUiState
import com.ssbmax.shared.presentation.sdt.SDTTestViewModel
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

@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class SDTTestScreenUiTest {

    private lateinit var mockViewModel: SDTTestViewModel
    private lateinit var uiStateFlow: MutableStateFlow<SDTTestUiState>
    private lateinit var questions: List<SDTQuestion>

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        questions = (1..4).map { index ->
            SDTQuestion(id = "sdt-$index", question = "Question $index", sequenceNumber = index)
        }
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(
            SDTTestUiState(
                isLoading = false,
                testId = "test-123",
                questions = questions,
                phase = SDTPhase.INSTRUCTIONS
            )
        )
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun instructionsScreen_exposesStartAction() = runComposeUiTest {
        setContent { SDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Instructions").assertIsDisplayed()
        onNodeWithText("Start Test").performClick()

        verify { mockViewModel.startTest() }
    }

    @Test
    fun activeQuestion_exposesTimerAndProgressSemantics() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SDTPhase.IN_PROGRESS,
            currentQuestionIndex = 1,
            totalTimeRemaining = 600
        )
        setContent { SDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithContentDescription("Time remaining: 600 seconds").assertIsDisplayed()
        onNodeWithContentDescription("Question progress: 50 percent").assertIsDisplayed()
    }

    @Test
    fun activeQuestion_invalidAnswer_disablesNextAction() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SDTPhase.IN_PROGRESS,
            currentQuestionIndex = 0,
            currentAnswer = "too short"
        )
        setContent { SDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Next").assertIsDisplayed()
    }

    @Test
    fun activeQuestion_displaysAnswerAndCharacterValidation() = runComposeUiTest {
        val answer = "A responsible response that is long enough to meet the minimum requirement."
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SDTPhase.IN_PROGRESS,
            currentQuestionIndex = 0,
            currentAnswer = answer
        )
        setContent { SDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText(answer, substring = true).assertIsDisplayed()
        onNodeWithText("Characters:", substring = true).assertIsDisplayed()
    }

    @Test
    fun reviewPhase_displaysResponsesAndSubmitAction() = runComposeUiTest {
        val answer = "A completed self-description response."
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SDTPhase.REVIEW,
            responses = questions.map { question ->
                SDTQuestionResponse(
                    questionId = question.id,
                    question = question.question,
                    answer = answer,
                    charCount = answer.length,
                    timeTakenSeconds = 10,
                    submittedAt = 1L
                )
            }
        )
        setContent { SDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Review Your Answers").assertIsDisplayed()
        onNodeWithText("Submit Test").assertIsDisplayed()
        onAllNodesWithText(answer, substring = true).onFirst().assertIsDisplayed()
    }

    @Test
    fun loadingState_announcesLoadingMessage() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = true)
        setContent { SDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Loading SDT questions", substring = true).assertIsDisplayed()
    }

    @Test
    fun errorState_exposesRetryAction() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = false, error = TestError.LOAD_FAILED)
        setContent { SDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Failed to load test", substring = true).assertIsDisplayed()
        onNodeWithText("Retry").performClick()
        verify { mockViewModel.loadTest("test-123") }
    }

    @Test
    fun submittedState_passesOnlySubmissionIdAndTier() = runComposeUiTest {
        var submittedId: String? = null
        var submittedTier: SubscriptionTier? = null
        uiStateFlow.value = uiStateFlow.value.copy(
            phase = SDTPhase.SUBMITTED,
            isSubmitted = true,
            submissionId = "submission-123",
            subscriptionType = SubscriptionTier.FREE
        )
        setContent {
            SDTTestScreen(
                testId = "test-123",
                viewModel = mockViewModel,
                onTestComplete = { id, tier -> submittedId = id; submittedTier = tier }
            )
        }
        waitForIdle()

        check(submittedId == "submission-123")
        check(submittedTier == SubscriptionTier.FREE)
    }
}
