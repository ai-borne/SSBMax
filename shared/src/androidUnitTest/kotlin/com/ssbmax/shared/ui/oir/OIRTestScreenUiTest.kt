package com.ssbmax.shared.ui.oir

import androidx.compose.ui.test.ExperimentalTestApi


import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.QuestionDifficulty
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.oir.OIRErrorType
import com.ssbmax.shared.presentation.oir.OIRTestUiState
import com.ssbmax.shared.presentation.oir.OIRTestViewModel
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Port of the pre-KMP-convergence `app/src/androidTest/.../ui/tests/oir/OIRTestScreenTest.kt`
 * onto shared's [OIRTestScreen] -- Phase 6a-2 of the KMP-convergence plan,
 * closing one of the five coverage gaps 6a named but deliberately deferred.
 *
 * Real structural drift from the pre-cutover test this replaces, verified by
 * reading [OIRTestScreen]/`OIRTestTopBar.kt`/`OIRTestBottomBar.kt` rather than
 * assumed:
 * - No separate "instructions" screen exists in this port -- [OIRTestUiState]
 *   has no `phase` field at all, the screen always renders the current
 *   question directly. The pre-cutover `instructionsScreen_displaysCorrectly`
 *   test (which only asserted on the initial/default state) is dropped as
 *   not portable; its intent is covered by `questionScreen_displaysQuestionAndOptions`.
 * - `@StringRes errorResId: Int?` became [OIRErrorType] (doc'd on
 *   [OIRTestUiState] itself); asserted here via the mapped error string.
 * - Top bar reads "Q 1/2" (`oir_question_format`), not "1/2"; bottom bar's
 *   own progress text is the bare "1/2" (`oir_progress_format`) -- both
 *   render at once, so progress/question-index assertions use exact text
 *   matches to stay unambiguous rather than `substring = true`.
 * - Exit icon's content description is "Exit Test" (`oir_exit_test`), not
 *   "Exit".
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class OIRTestScreenUiTest {

    private lateinit var mockViewModel: OIRTestViewModel
    private lateinit var uiStateFlow: MutableStateFlow<OIRTestUiState>
    private lateinit var testQuestions: List<OIRQuestion>

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        testQuestions = listOf(
            OIRQuestion(
                id = "oir-1",
                questionNumber = 1,
                type = OIRQuestionType.VERBAL_REASONING,
                questionText = "What is the capital of India?",
                options = listOf(
                    OIROption("opt1", "Mumbai"),
                    OIROption("opt2", "Delhi"),
                    OIROption("opt3", "Kolkata"),
                    OIROption("opt4", "Chennai")
                ),
                correctAnswerId = "opt2",
                explanation = "Delhi is the capital of India.",
                difficulty = QuestionDifficulty.EASY
            ),
            OIRQuestion(
                id = "oir-2",
                questionNumber = 2,
                type = OIRQuestionType.NUMERICAL_ABILITY,
                questionText = "What is 2+2?",
                options = listOf(
                    OIROption("opt1", "3"),
                    OIROption("opt2", "4"),
                    OIROption("opt3", "5"),
                    OIROption("opt4", "6")
                ),
                correctAnswerId = "opt2",
                explanation = "2+2 equals 4.",
                difficulty = QuestionDifficulty.EASY
            )
        )
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(
            OIRTestUiState(isLoading = false, currentQuestionIndex = 0, totalQuestions = testQuestions.size)
        )
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun questionScreen_displaysQuestionAndOptions() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(currentQuestion = testQuestions[0])
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        onNodeWithText("Q 1/2").assertIsDisplayed()
        onNodeWithText(testQuestions[0].questionText, substring = true).assertIsDisplayed()
        onNodeWithText("Delhi").assertIsDisplayed()
    }

    @Test
    fun activeQuestion_doesNotExposeAnswerExplanation() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(currentQuestion = testQuestions[0])
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        assert(onAllNodesWithText("Delhi is the capital of India.", substring = true).fetchSemanticsNodes().isEmpty())
        assert(onAllNodesWithText("Correct!", substring = true).fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun selectedOption_exposesSelectionWithoutAnswerKey() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(currentQuestion = testQuestions[0])
        every { mockViewModel.selectOption("opt1") } answers {
            uiStateFlow.value = uiStateFlow.value.copy(selectedOptionIds = setOf("opt1"))
        }
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        onNodeWithText("Mumbai").performClick()
        onNodeWithText("Mumbai").assertIsSelected()
        assert(onAllNodesWithText("Delhi is the capital of India.", substring = true).fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun progressIndicator_showsCorrectProgress() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(currentQuestionIndex = 4, totalQuestions = 50)
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        // Bottom bar's bare "5/50" -- exact match, top bar's "Q 5/50" also
        // contains "5/50" as a substring so substring-matching here would be
        // ambiguous (two nodes).
        onNodeWithText("5/50").assertIsDisplayed()
    }

    @Test
    fun timerDisplay_showsTimeRemaining() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(timeRemainingSeconds = 300)
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        onNodeWithText("5:00", substring = true).assertIsDisplayed()
        onNodeWithContentDescription("Time remaining").assertIsDisplayed()
    }

    @Test
    fun loadingState_showsLoadingIndicator() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = true)
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        onNodeWithText("Loading", substring = true).assertIsDisplayed()
    }

    @Test
    fun loadingState_hidesActiveNavigationControls() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = true)
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        assert(onAllNodesWithText("1/2").fetchSemanticsNodes().isEmpty())
        assert(onAllNodesWithText("Next").fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun submitButton_showsConfirmationDialog() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            currentQuestionIndex = 1,
            totalQuestions = 2,
            currentQuestion = testQuestions[1]
        )
        every { mockViewModel.requestSubmit() } answers {
            uiStateFlow.value = uiStateFlow.value.copy(showSubmitConfirmation = true)
        }
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        onNodeWithText("Submit Test").performClick()
        onNodeWithText("Submit test?").assertIsDisplayed()
        onNodeWithText("Unanswered questions", substring = true).assertIsDisplayed()
    }

    @Test
    fun errorState_displaysErrorMessage() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(isLoading = false, errorType = OIRErrorType.QUESTIONS_UNAVAILABLE)
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        onNodeWithText("temporarily unavailable", substring = true).assertIsDisplayed()
    }

    @Test
    fun completedTest_triggersCallback() = runComposeUiTest {
        val submissionId = "submission-oir-123"
        var completedId: String? = null
        var completedType: SubscriptionTier? = null
        uiStateFlow.value = uiStateFlow.value.copy(
            isCompleted = true,
            submissionId = submissionId,
            subscriptionType = SubscriptionTier.FREE
        )

        setContent {
            OIRTestScreen(
                viewModel = mockViewModel,
                onTestComplete = { id, type -> completedId = id; completedType = type }
            )
        }
        waitForIdle()

        assert(completedId == submissionId) { "Expected callback with $submissionId, got $completedId" }
        assert(completedType == SubscriptionTier.FREE)
    }

    @Test
    fun backButton_showsExitDialog() = runComposeUiTest {
        setContent { OIRTestScreen(viewModel = mockViewModel) }

        onNodeWithContentDescription("Exit Test").performClick()

        onNodeWithText("Exit Test?", substring = true).assertIsDisplayed()
    }
}
