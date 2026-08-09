package com.ssbmax.shared.ui.ppdt

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.onAllNodesWithText

import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.PPDTPhase
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.common.TestError
import com.ssbmax.shared.presentation.ppdt.PPDTTestUiState
import com.ssbmax.shared.presentation.ppdt.PPDTTestViewModel
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
class PPDTTestScreenUiTest {

    private lateinit var mockViewModel: PPDTTestViewModel
    private lateinit var uiStateFlow: MutableStateFlow<PPDTTestUiState>

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(
            PPDTTestUiState(
                isLoading = false,
                currentPhase = PPDTPhase.INSTRUCTIONS,
                imageUrl = "https://example.com/ppdt.jpg"
            )
        )
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun instructionsScreen_exposesStartAction() = runComposeUiTest {
        setContent { PPDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("PPDT Instructions").assertIsDisplayed()
        onNodeWithText("Start Test").performClick()

        verify { mockViewModel.startTest() }
    }

    @Test
    fun imageViewing_exposesTimerSemantics() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            currentPhase = PPDTPhase.IMAGE_VIEWING,
            timeRemainingSeconds = 20
        )
        setContent { PPDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithContentDescription("Time remaining: 20 seconds").assertIsDisplayed()
    }

    @Test
    fun writingPhase_displaysPrivateStoryOnlyAsTextInputContent() = runComposeUiTest {
        val privateStory = "A private response that must not become a parent content description"
        uiStateFlow.value = uiStateFlow.value.copy(
            currentPhase = PPDTPhase.WRITING,
            story = privateStory,
            charactersCount = privateStory.length
        )
        setContent { PPDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText(privateStory, substring = true).assertIsDisplayed()
        onNodeWithText("Write your story based on the image you saw", substring = true).assertIsDisplayed()
    }

    @Test
    fun reviewPhase_submitAction_showsConfirmation() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            currentPhase = PPDTPhase.REVIEW,
            story = "A completed story",
            charactersCount = 200,
            canProceedToNextPhase = true
        )
        setContent { PPDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onAllNodesWithText("Submit Test").onLast().performClick()
        onNodeWithText("Submit Test?").assertIsDisplayed()
    }

    @Test
    fun profileRequiredState_explainsRequiredAction() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isProfileIncomplete = true)
        setContent { PPDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Complete Your Profile").assertIsDisplayed()
        onNodeWithText("Go to Settings").assertIsDisplayed()
    }

    @Test
    fun loadingState_announcesLoadingMessage() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = true)
        setContent { PPDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Loading PPDT test from cloud", substring = true).assertIsDisplayed()
    }

    @Test
    fun errorState_exposesRetryAction() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = false, error = TestError.LOAD_FAILED)
        setContent { PPDTTestScreen(testId = "test-123", viewModel = mockViewModel) }

        onNodeWithText("Failed to load test", substring = true).assertIsDisplayed()
        onNodeWithText("Retry").performClick()
        verify { mockViewModel.loadTest() }
    }

    @Test
    fun submittedState_passesOnlySubmissionIdAndTier() = runComposeUiTest {
        var submittedId: String? = null
        var submittedTier: SubscriptionTier? = null
        uiStateFlow.value = uiStateFlow.value.copy(
            currentPhase = PPDTPhase.SUBMITTED,
            isSubmitted = true,
            submissionId = "submission-123",
            subscriptionType = SubscriptionTier.FREE
        )
        setContent {
            PPDTTestScreen(
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
