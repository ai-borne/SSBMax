package com.ssbmax.shared.ui.interviewsession

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.interview.InterviewQuestion
import com.ssbmax.shared.domain.model.interview.QuestionSource
import com.ssbmax.shared.presentation.interviewsession.InterviewSessionUiState
import com.ssbmax.shared.presentation.interviewsession.InterviewSessionViewModel
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
class InterviewSessionScreenUiTest {

    private lateinit var mockViewModel: InterviewSessionViewModel
    private lateinit var uiStateFlow: MutableStateFlow<InterviewSessionUiState>
    private lateinit var question: InterviewQuestion

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        question = InterviewQuestion(
            id = "question-1",
            questionText = "Describe a time you demonstrated leadership.",
            expectedOLQs = emptyList(),
            source = QuestionSource.GENERIC_POOL
        )
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(
            InterviewSessionUiState(
                isLoading = false,
                currentQuestion = question,
                currentQuestionIndex = 1,
                totalQuestions = 4,
                responseText = "I organized the team and delivered the task."
            )
        )
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun activeSession_exposesProgressAndTTSControls() = runComposeUiTest {
        setContent {
            InterviewSessionScreen(
                sessionId = "session-1",
                onNavigateBack = {},
                onNavigateToResult = {},
                onNavigateToHome = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithText("Question 2 of 4").assertIsDisplayed()
        onNodeWithContentDescription("Interview progress: 25 percent").assertIsDisplayed()
        onNodeWithContentDescription("Mute audio").performClick()
        verify { mockViewModel.toggleTTSMute() }
    }

    @Test
    fun exitAction_isLabeledAndShowsConfirmation() = runComposeUiTest {
        setContent {
            InterviewSessionScreen(
                sessionId = "session-1",
                onNavigateBack = {},
                onNavigateToResult = {},
                onNavigateToHome = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithContentDescription("Exit Interview").performClick()
        onNodeWithText("Exit Interview?").assertIsDisplayed()
    }

    @Test
    fun loadingState_exposesLoadingAnnouncement() = runComposeUiTest {
        uiStateFlow.value = InterviewSessionUiState(isLoading = true, loadingMessage = "Loading interview session")
        setContent {
            InterviewSessionScreen(
                sessionId = "session-1",
                onNavigateBack = {},
                onNavigateToResult = {},
                onNavigateToHome = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithContentDescription("Loading interview session").assertIsDisplayed()
    }

    @Test
    fun errorState_exposesRetryAction() = runComposeUiTest {
        uiStateFlow.value = InterviewSessionUiState(isLoading = false, error = "Session unavailable")
        setContent {
            InterviewSessionScreen(
                sessionId = "session-1",
                onNavigateBack = {},
                onNavigateToResult = {},
                onNavigateToHome = {},
                viewModel = mockViewModel
            )
        }

        onNodeWithText("Session unavailable").assertIsDisplayed()
        onNodeWithText("Retry").performClick()
        verify { mockViewModel.retryLoadSession("session-1") }
    }
}
