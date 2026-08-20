package com.ssbmax.shared.presentation.oirresult

import com.ssbmax.shared.domain.model.CategoryScore
import com.ssbmax.shared.domain.model.DifficultyScore
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.domain.model.QuestionDifficulty
import com.ssbmax.shared.domain.usecase.GetOirResultUseCase
import com.ssbmax.shared.presentation.testing.FakeOirResultRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Characterization test, written before converting [OirResultViewModel] to
 * `androidx.lifecycle.ViewModel` (Phase 1 of the KMP-convergence plan). Must
 * pass unmodified against both the pre- and post-conversion class.
 */
class OirResultViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var repository: FakeOirResultRepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        repository = FakeOirResultRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = OirResultViewModel(GetOirResultUseCase(repository))

    private fun result(sessionId: String) = OIRTestResult(
        testId = "oir_standard",
        sessionId = sessionId,
        userId = "test-user-1",
        totalQuestions = 10,
        correctAnswers = 7,
        incorrectAnswers = 2,
        skippedQuestions = 1,
        totalTimeSeconds = 600,
        timeTakenSeconds = 500,
        rawScore = 7,
        percentageScore = 70f,
        categoryScores = mapOf(
            OIRQuestionType.VERBAL_REASONING to CategoryScore(
                category = OIRQuestionType.VERBAL_REASONING,
                totalQuestions = 5, correctAnswers = 4, percentage = 80f, averageTimeSeconds = 20
            )
        ),
        difficultyBreakdown = mapOf(
            QuestionDifficulty.EASY to DifficultyScore(
                difficulty = QuestionDifficulty.EASY, totalQuestions = 5, correctAnswers = 4, percentage = 80f
            )
        ),
        answeredQuestions = emptyList(),
        completedAt = 1_000_000L
    )

    @Test
    fun `initial state is loading with no result`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        val state = viewModel.uiState.value
        assertTrue(state.isLoading)
        assertNull(state.result)
        assertNull(state.error)
    }

    @Test
    fun `loadSubmission success populates result and clears loading`() = runTest(testDispatcher) {
        repository.oirResult = Result.success(result("session-1"))
        val viewModel = buildViewModel()

        viewModel.loadSubmission("session-1")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(!state.isLoading)
        assertNotNull(state.result)
        assertEquals("session-1", state.result?.sessionId)
        assertNull(state.error)
    }

    @Test
    fun `loadSubmission with null result surfaces not-found error`() = runTest(testDispatcher) {
        repository.oirResult = Result.success(null)
        val viewModel = buildViewModel()

        viewModel.loadSubmission("missing-session")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(!state.isLoading)
        assertNull(state.result)
        assertEquals("Submission not found", state.error)
    }

    @Test
    fun `loadSubmission failure surfaces error message`() = runTest(testDispatcher) {
        repository.oirResult = Result.failure(Exception("network down"))
        val viewModel = buildViewModel()

        viewModel.loadSubmission("session-1")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(!state.isLoading)
        assertEquals("network down", state.error)
    }

    @Test
    fun `retry re-invokes loadSubmission for the same id`() = runTest(testDispatcher) {
        repository.oirResult = Result.failure(Exception("network down"))
        val viewModel = buildViewModel()
        viewModel.loadSubmission("session-1")
        testDispatcher.scheduler.advanceUntilIdle()
        assertNotNull(viewModel.uiState.value.error)

        repository.oirResult = Result.success(result("session-1"))
        viewModel.retry("session-1")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.result)
        assertNull(state.error)
    }

    @Test
    fun `result screen loads by submission id and reflects the most recently submitted attempt`() =
        runTest(testDispatcher) {
            // OIR Retake Seal, Phase 3 (finding #5): pins that the result screen is driven
            // purely by the submission id passed to loadSubmission, so a retake's fresh id
            // (Phase 1) reaches this screen and displays its own result -- never the prior
            // attempt's, which was Defect 1 (stale retake result).
            val viewModel = buildViewModel()

            repository.oirResult = Result.success(result("submission-1"))
            viewModel.loadSubmission("submission-1")
            testDispatcher.scheduler.advanceUntilIdle()
            assertEquals("submission-1", repository.lastRequestedSubmissionId)
            assertEquals("submission-1", viewModel.uiState.value.result?.sessionId)

            // Retake: a second, distinct attempt with its own fresh submission id.
            repository.oirResult = Result.success(result("submission-2"))
            viewModel.loadSubmission("submission-2")
            testDispatcher.scheduler.advanceUntilIdle()

            val state = viewModel.uiState.value
            assertEquals("submission-2", repository.lastRequestedSubmissionId)
            assertEquals("submission-2", state.result?.sessionId)
            assertNotEquals("submission-1", state.result?.sessionId)
        }
}
