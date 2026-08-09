package com.ssbmax.shared.ui.interviewresult

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.interview.InterviewMode
import com.ssbmax.shared.domain.model.interview.InterviewResult
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQCategory
import com.ssbmax.shared.domain.model.interview.OLQScore
import com.ssbmax.shared.presentation.interviewresult.InterviewResultUiState
import com.ssbmax.shared.presentation.interviewresult.InterviewResultViewModel
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.time.Instant
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class InterviewResultScreenUiTest {

    private lateinit var mockViewModel: InterviewResultViewModel
    private lateinit var uiStateFlow: MutableStateFlow<InterviewResultUiState>
    private lateinit var result: InterviewResult

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        result = InterviewResult(
            id = "result-1",
            sessionId = "session-1",
            userId = "user-1",
            mode = InterviewMode.VOICE_BASED,
            completedAt = Instant.fromEpochSeconds(1),
            durationSec = 600,
            totalQuestions = 5,
            totalResponses = 5,
            overallOLQScores = mapOf(
                OLQ.EFFECTIVE_INTELLIGENCE to OLQScore(5, 90, "Good reasoning")
            ),
            categoryScores = mapOf(OLQCategory.INTELLECTUAL to 5f),
            overallConfidence = 90,
            strengths = listOf(OLQ.EFFECTIVE_INTELLIGENCE),
            weaknesses = listOf(OLQ.SOCIAL_ADJUSTMENT),
            feedback = "Continue developing practical leadership habits.",
            overallRating = 5
        )
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(InterviewResultUiState(isLoading = false, result = result))
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun resultScreen_displaysAssessmentAndFeedback() = runComposeUiTest {
        setContent {
            InterviewResultScreen(
                resultId = "result-1",
                onNavigateBack = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithText("Interview Results").assertIsDisplayed()
        onNodeWithText("Overall Rating").assertIsDisplayed()
        onNodeWithText("Strengths").assertIsDisplayed()
        onNodeWithText("Continue developing practical leadership habits.").assertIsDisplayed()
        onNodeWithText("Done").performClick()
    }

    @Test
    fun loadingState_displaysAnalysisMessage() = runComposeUiTest {
        uiStateFlow.value = InterviewResultUiState(
            isLoading = true,
            loadingMessage = "Loading interview results"
        )
        setContent {
            InterviewResultScreen(resultId = "result-1", onNavigateBack = {}, viewModel = mockViewModel)
        }

        onNodeWithText("Loading interview results").assertIsDisplayed()
    }

    @Test
    fun analysisPendingState_displaysPendingMessageAndDoneAction() = runComposeUiTest {
        uiStateFlow.value = InterviewResultUiState(isLoading = false, isAnalysisPending = true)
        setContent {
            InterviewResultScreen(resultId = "result-1", onNavigateBack = {}, viewModel = mockViewModel)
        }

        onNodeWithText("Your interview is complete", substring = true).assertIsDisplayed()
        onNodeWithText("Done").assertIsDisplayed()
    }

    @Test
    fun errorState_exposesRetryAction() = runComposeUiTest {
        uiStateFlow.value = InterviewResultUiState(isLoading = false, error = "Temporary failure")
        setContent {
            InterviewResultScreen(resultId = "result-1", onNavigateBack = {}, viewModel = mockViewModel)
        }

        onNodeWithText("Temporary failure").assertIsDisplayed()
        onNodeWithText("Retry").performClick()
        verify { mockViewModel.refresh() }
    }

    @Test
    fun closeAction_isLabeledAndNavigatesBack() = runComposeUiTest {
        var navigatedBack = false
        setContent {
            InterviewResultScreen(
                resultId = "result-1",
                onNavigateBack = { navigatedBack = true },
                viewModel = mockViewModel
            )
        }

        onNodeWithContentDescription("Close").performClick()
        check(navigatedBack)
    }
}
