package com.ssbmax.shared.ui.oir

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.CategoryScore
import com.ssbmax.shared.domain.model.OIRAnswer
import com.ssbmax.shared.domain.model.OIRAnsweredQuestion
import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.domain.model.QuestionDifficulty
import com.ssbmax.shared.presentation.oirresult.OirResultUiState
import com.ssbmax.shared.presentation.oirresult.OirResultViewModel
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
class OIRResultReviewUiTest {

    private lateinit var mockViewModel: OirResultViewModel
    private lateinit var uiStateFlow: MutableStateFlow<OirResultUiState>
    private lateinit var result: OIRTestResult

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        val options = listOf(
            OIROption("opt-1", "Mumbai"),
            OIROption("opt-2", "Delhi")
        )
        val question = OIRQuestion(
            id = "question-1",
            questionNumber = 1,
            type = OIRQuestionType.VERBAL_REASONING,
            questionText = "What is the capital of India?",
            options = options,
            correctAnswerId = "opt-2",
            explanation = "Delhi is the capital of India.",
            difficulty = QuestionDifficulty.EASY
        )
        val answered = OIRAnsweredQuestion(
            question = question,
            userAnswer = OIRAnswer("question-1", "opt-2", isCorrect = true),
            isCorrect = true,
            correctOption = options[1],
            selectedOption = options[1]
        )
        result = OIRTestResult(
            testId = "oir-test",
            sessionId = "session-1",
            userId = "user-1",
            totalQuestions = 10,
            correctAnswers = 8,
            incorrectAnswers = 2,
            skippedQuestions = 0,
            totalTimeSeconds = 600,
            timeTakenSeconds = 300,
            rawScore = 8,
            percentageScore = 80f,
            categoryScores = mapOf(
                OIRQuestionType.VERBAL_REASONING to CategoryScore(
                    category = OIRQuestionType.VERBAL_REASONING,
                    totalQuestions = 10,
                    correctAnswers = 8,
                    percentage = 80f,
                    averageTimeSeconds = 30
                )
            ),
            answeredQuestions = listOf(answered),
            completedAt = 1L
        )
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(OirResultUiState(isLoading = false, result = result))
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun resultScreen_displaysScoreProgressAndReviewAction() = runComposeUiTest {
        var reviewClicked = false
        setContent {
            OIRTestResultScreen(
                submissionId = "submission-1",
                viewModel = mockViewModel,
                onReviewAnswers = { reviewClicked = true }
            )
        }

        onNodeWithText("Test Results").assertIsDisplayed()
        onNodeWithText("80%", substring = true).assertIsDisplayed()
        onNodeWithContentDescription("Category score: 80 percent").assertIsDisplayed()
        onNodeWithText("Review Answers").performClick()
        check(reviewClicked)
    }

    @Test
    fun resultScreen_loadingState_isAnnounced() = runComposeUiTest {
        uiStateFlow.value = OirResultUiState(isLoading = true)
        setContent { OIRTestResultScreen(submissionId = "submission-1", viewModel = mockViewModel) }

        onNodeWithText("Loading your results", substring = true).assertIsDisplayed()
    }

    @Test
    fun resultScreen_errorState_exposesRetryAndHomeActions() = runComposeUiTest {
        uiStateFlow.value = OirResultUiState(isLoading = false, error = "Temporary failure")
        setContent {
            OIRTestResultScreen(
                submissionId = "submission-1",
                viewModel = mockViewModel,
                onNavigateHome = {}
            )
        }

        onNodeWithText("Failed to Load Results").assertIsDisplayed()
        onNodeWithText("Retry").performClick()
        verify { mockViewModel.retry("submission-1") }
    }

    @Test
    fun answerReview_displaysCorrectnessAndExplanation_onlyInReview() = runComposeUiTest {
        setContent {
            OIRAnswerReviewScreen(
                submissionId = "submission-1",
                onNavigateBack = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithText("Review Answers").assertIsDisplayed()
        onNodeWithText("Correct answer: Delhi").assertIsDisplayed()
        onNodeWithText("Explanation: Delhi is the capital of India.").assertIsDisplayed()
    }

    @Test
    fun answerReview_loadingState_displaysLoadingMessage() = runComposeUiTest {
        uiStateFlow.value = OirResultUiState(isLoading = true)
        setContent {
            OIRAnswerReviewScreen(
                submissionId = "submission-1",
                onNavigateBack = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithText("Loading your results", substring = true).assertIsDisplayed()
    }

    @Test
    fun answerReview_backAction_isLabeledAndNavigates() = runComposeUiTest {
        var navigatedBack = false
        setContent {
            OIRAnswerReviewScreen(
                submissionId = "submission-1",
                onNavigateBack = { navigatedBack = true },
                viewModel = mockViewModel
            )
        }

        onNodeWithContentDescription("Back to results").performClick()
        check(navigatedBack)
    }
}
