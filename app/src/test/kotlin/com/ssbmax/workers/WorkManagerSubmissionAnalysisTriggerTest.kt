package com.ssbmax.workers

import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.TATStoryResponse
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.util.DomainLogger
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * TAT_Impr_3 Phase 2: the Android trigger must pass the persisted questions the user
 * actually saw into the pipeline, falling back to a repo fetch only for legacy docs
 * written before the `questions` field existed. Previously it always called
 * `getTATQuestions(testId)` which ignores `testId` and returns a fresh random 12 with
 * different IDs -> `KEY_IMAGE_URL = ""` -> `0 bytes` on every story.
 */
class WorkManagerSubmissionAnalysisTriggerTest {

    private val submissionId = "sub-123"
    private val testId = "tat_standard"

    private val persistedQuestions = listOf(
        TATQuestion(id = "q1", imageUrl = "https://example.com/1.png", cardPosition = 1),
        TATQuestion(id = "q2", imageUrl = "https://example.com/2.png", cardPosition = 2)
    )

    private val repoQuestions = listOf(
        TATQuestion(id = "repo_q1", imageUrl = "https://example.com/repo1.png", cardPosition = 1),
        TATQuestion(id = "repo_q2", imageUrl = "https://example.com/repo2.png", cardPosition = 2)
    )

    private fun buildSubmission(questions: List<TATQuestion> = persistedQuestions) = TATSubmission(
        id = submissionId,
        userId = "user-1",
        testId = testId,
        stories = listOf(
            TATStoryResponse(
                questionId = "q1", story = "Story", charactersCount = 5,
                viewingTimeTakenSeconds = 10, writingTimeTakenSeconds = 120, submittedAt = 1L
            )
        ),
        questions = questions,
        totalTimeTakenMinutes = 45,
        submittedAt = 2L,
        analysisStatus = AnalysisStatus.PENDING_ANALYSIS
    )

    @Test
    fun `passes persisted questions to startPipeline when submission has them`() = runTest {
        val submissionRepository = mockk<SubmissionRepository>()
        val testContentRepository = mockk<TestContentRepository>()
        val orchestrator = mockk<TATAnalysisPipelineOrchestrator>(relaxed = true)
        val logger = mockk<DomainLogger>(relaxed = true)

        coEvery { submissionRepository.getTATSubmission(submissionId) } returns
            Result.success(buildSubmission(questions = persistedQuestions))

        val questionsSlot = slot<List<TATQuestion>>()
        coEvery { orchestrator.startPipeline(submissionId, any(), capture(questionsSlot)) } returns Result.success(Unit)

        val trigger = WorkManagerSubmissionAnalysisTrigger(
            workManager = mockk(relaxed = true),
            submissionRepository = submissionRepository,
            testContentRepository = testContentRepository,
            tatPipelineOrchestrator = orchestrator,
            logger = logger,
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        trigger.trigger(TestType.TAT, submissionId)

        assertEquals(persistedQuestions, questionsSlot.captured)
        // The persisted set must win; the repo must not be consulted at all.
        coVerify(exactly = 0) { testContentRepository.getTATQuestions(any(), any()) }
    }

    @Test
    fun `falls back to getTATQuestions when submission has no questions`() = runTest {
        val submissionRepository = mockk<SubmissionRepository>()
        val testContentRepository = mockk<TestContentRepository>()
        val orchestrator = mockk<TATAnalysisPipelineOrchestrator>(relaxed = true)
        val logger = mockk<DomainLogger>(relaxed = true)

        coEvery { submissionRepository.getTATSubmission(submissionId) } returns
            Result.success(buildSubmission(questions = emptyList()))
        coEvery { testContentRepository.getTATQuestions(testId) } returns Result.success(repoQuestions)

        val questionsSlot = slot<List<TATQuestion>>()
        coEvery { orchestrator.startPipeline(submissionId, any(), capture(questionsSlot)) } returns Result.success(Unit)

        val trigger = WorkManagerSubmissionAnalysisTrigger(
            workManager = mockk(relaxed = true),
            submissionRepository = submissionRepository,
            testContentRepository = testContentRepository,
            tatPipelineOrchestrator = orchestrator,
            logger = logger,
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        trigger.trigger(TestType.TAT, submissionId)

        assertEquals(repoQuestions, questionsSlot.captured)
        coVerify(exactly = 1) { testContentRepository.getTATQuestions(testId) }
    }

    @Test
    fun `passes empty list when fallback repo call fails`() = runTest {
        val submissionRepository = mockk<SubmissionRepository>()
        val testContentRepository = mockk<TestContentRepository>()
        val orchestrator = mockk<TATAnalysisPipelineOrchestrator>(relaxed = true)
        val logger = mockk<DomainLogger>(relaxed = true)

        coEvery { submissionRepository.getTATSubmission(submissionId) } returns
            Result.success(buildSubmission(questions = emptyList()))
        coEvery { testContentRepository.getTATQuestions(testId) } returns
            Result.failure(Exception("network down"))

        val questionsSlot = slot<List<TATQuestion>>()
        coEvery { orchestrator.startPipeline(submissionId, any(), capture(questionsSlot)) } returns Result.success(Unit)

        val trigger = WorkManagerSubmissionAnalysisTrigger(
            workManager = mockk(relaxed = true),
            submissionRepository = submissionRepository,
            testContentRepository = testContentRepository,
            tatPipelineOrchestrator = orchestrator,
            logger = logger,
            scope = CoroutineScope(Dispatchers.Unconfined)
        )

        trigger.trigger(TestType.TAT, submissionId)

        assertEquals(emptyList<TATQuestion>(), questionsSlot.captured)
    }
}
