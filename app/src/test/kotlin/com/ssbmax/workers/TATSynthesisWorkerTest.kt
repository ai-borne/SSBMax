package com.ssbmax.workers

import android.content.Context
import android.util.Log
import androidx.work.ListenableWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.ssbmax.data.local.dao.TATStoryAssessmentDao
import com.ssbmax.data.local.entity.TATStoryAssessmentEntity
import com.ssbmax.shared.domain.model.EntryType
import com.ssbmax.shared.domain.model.Gender
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.UserProfile
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.service.AIService
import com.ssbmax.shared.domain.service.EvaluationFunctionsClient
import com.ssbmax.shared.domain.service.OLQScoreWithReasoning
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.notifications.NotificationHelper
import com.ssbmax.shared.analysis.RetryBackoffPolicy
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.slot
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.koin.core.context.startKoin
import org.koin.core.context.stopKoin
import org.koin.dsl.module

@OptIn(ExperimentalCoroutinesApi::class)
class TATSynthesisWorkerTest {

    private lateinit var context: Context
    private lateinit var workerParams: WorkerParameters
    private lateinit var tatStoryAssessmentDao: TATStoryAssessmentDao
    private lateinit var submissionRepository: SubmissionRepository
    private lateinit var userProfileRepository: UserProfileRepository
    private lateinit var aiService: AIService
    private lateinit var notificationHelper: NotificationHelper
    private lateinit var getOLQDashboard: GetOLQDashboardUseCase
    private lateinit var evaluationFunctionsClient: EvaluationFunctionsClient

    private val submissionId = "tat-sub-123"
    private val userId = "user-456"

    @Before
    fun setUp() {
        mockkStatic(Log::class)
        every { Log.d(any(), any()) } returns 0
        every { Log.e(any<String>(), any<String>()) } returns 0
        every { Log.e(any<String>(), any<String>(), any()) } returns 0
        every { Log.w(any<String>(), any<String>()) } returns 0
        every { Log.i(any(), any()) } returns 0

        context = mockk(relaxed = true)
        workerParams = mockk(relaxed = true)
        tatStoryAssessmentDao = mockk(relaxed = true)
        submissionRepository = mockk(relaxed = true)
        userProfileRepository = mockk(relaxed = true)
        aiService = mockk(relaxed = true)
        notificationHelper = mockk(relaxed = true)
        getOLQDashboard = mockk(relaxed = true)
        evaluationFunctionsClient = mockk(relaxed = true)
        coEvery { evaluationFunctionsClient.notifyGradingComplete(any()) } returns Result.success(Unit)

        every { workerParams.inputData } returns workDataOf(TATSynthesisWorker.KEY_SUBMISSION_ID to submissionId)
        every { workerParams.runAttemptCount } returns 0
        coEvery { submissionRepository.updateTATAnalysisStatus(any(), any()) } returns Result.success(Unit)
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns Result.success(Unit)
        coEvery { getOLQDashboard.invalidateCache(any()) } returns Unit

        // TATSynthesisWorker resolves its dependencies via KoinComponent/inject()
        // (converted from Hilt's @HiltWorker/@AssistedInject) — start a Koin instance
        // with the mocks above bound so `by inject()` resolves them in the worker.
        startKoin {
            modules(module {
                single { tatStoryAssessmentDao }
                single { submissionRepository }
                single { userProfileRepository }
                single { aiService }
                single { notificationHelper }
                single { getOLQDashboard }
                single { evaluationFunctionsClient }
            })
        }
    }

    @After
    fun tearDown() {
        stopKoin()
    }

    @Test
    fun `fails when valid story count is below threshold`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns (0 until 5).map { buildAssessment(it) }

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.failure(), result)
        coVerify(exactly = 1) { submissionRepository.updateTATAnalysisStatus(submissionId, AnalysisStatus.FAILED) }
        coVerify(exactly = 0) { aiService.analyzeTATResponse(any()) }
    }

    @Test
    fun `filters failed placeholders before synthesis`() = runTest {
        val promptSlot = slot<String>()
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6, failedCount = 2)
        coEvery { aiService.analyzeTATResponse(capture(promptSlot)) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.success(), result)
        assertFalse(promptSlot.captured.contains(TATStoryAnalysisWorker.FAILED_MARKER))
        assertFalse(promptSlot.captured.contains("placeholder-story"))
    }

    @Test
    fun `writes final result through repository on success`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.success(), result)
        coVerify(exactly = 1) {
            submissionRepository.finalizeTATAnalysisResult(
                submissionId,
                match { it.submissionId == submissionId && it.testType == TestType.TAT }
            )
        }
    }

    @Test
    fun `retries when finalizeTATAnalysisResult returns failure`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns
            Result.failure(Exception("Firestore write failed"))
        // runAttemptCount = 0, so MAX_AI_RETRIES (3) allows retrying
        every { workerParams.runAttemptCount } returns 0

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.retry(), result)
    }

    @Test
    fun `marks failed after retry exhaustion on finalization failure`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns
            Result.failure(Exception("Firestore write failed"))
        // Simulate exhausted retries
        every { workerParams.runAttemptCount } returns 3

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.failure(), result)
        coVerify(exactly = 1) { submissionRepository.updateTATAnalysisStatus(submissionId, AnalysisStatus.FAILED) }
    }

    @Test
    fun `does not show success notification when finalization fails`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns
            Result.failure(Exception("Firestore unavailable"))

        createWorker().doWork()

        coVerify(exactly = 0) { notificationHelper.showTATResultsReadyNotification(any()) }
    }

    @Test
    fun `does not invalidate dashboard cache when finalization fails`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns
            Result.failure(Exception("Firestore unavailable"))

        createWorker().doWork()

        coVerify(exactly = 0) { getOLQDashboard.invalidateCache(any()) }
    }

    @Test
    fun `shows success notification only after finalization succeeds`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        // Finalization succeeds
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns Result.success(Unit)

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.success(), result)
        coVerify(exactly = 1) { notificationHelper.showTATResultsReadyNotification(submissionId) }
    }

    // Regression: reported live on-device (2026-08-17) -- a TAT result's local phone notification
    // fired correctly, but it never appeared in the centralized in-app Notification Center, because
    // nothing here ever called the Cloud Function that writes the notifications/{id} Firestore doc
    // the centralized list reads from (only evaluate*/core.js-routed test types did that
    // automatically). notifyGradingComplete is the client-invoked equivalent for this
    // legacy-client-side-graded path.
    @Test
    fun `notifies the centralized inbox only after finalization succeeds`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.success(), result)
        coVerify(exactly = 1) { evaluationFunctionsClient.notifyGradingComplete(submissionId) }
    }

    @Test
    fun `does not notify the centralized inbox when finalization fails`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns
            Result.failure(Exception("Firestore unavailable"))

        createWorker().doWork()

        coVerify(exactly = 0) { evaluationFunctionsClient.notifyGradingComplete(any()) }
    }

    @Test
    fun `a notifyGradingComplete failure does not fail the whole worker -- result is already durable`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        coEvery { evaluationFunctionsClient.notifyGradingComplete(any()) } returns
            Result.failure(Exception("network error"))

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.success(), result)
    }

    @Test
    fun `invalidates dashboard cache only after finalization succeeds`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))
        // Finalization succeeds
        coEvery { submissionRepository.finalizeTATAnalysisResult(any(), any()) } returns Result.success(Unit)

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.success(), result)
        coVerify(exactly = 1) { getOLQDashboard.invalidateCache(userId) }
    }

    @Test
    fun `sets usedPartialAssessment false for 12 valid stories`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 12)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))

        createWorker().doWork()

        coVerify {
            submissionRepository.finalizeTATAnalysisResult(
                submissionId,
                match { !it.usedPartialAssessment }
            )
        }
    }

    @Test
    fun `sets usedPartialAssessment true when some stories are failed placeholders`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns
            buildAssessments(validCount = 9, failedCount = 3)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))

        createWorker().doWork()

        coVerify {
            submissionRepository.finalizeTATAnalysisResult(
                submissionId,
                match { it.usedPartialAssessment }
            )
        }
    }

    @Test
    fun `populates validStoriesCount correctly`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns
            buildAssessments(validCount = 9, failedCount = 3)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))

        createWorker().doWork()

        coVerify {
            submissionRepository.finalizeTATAnalysisResult(
                submissionId,
                match { it.validStoriesCount == 9 }
            )
        }
    }

    @Test
    fun `populates failedStoriesCount correctly`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns
            buildAssessments(validCount = 9, failedCount = 3)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.success(buildResponseAnalysis())
        coEvery { submissionRepository.getTATSubmission(submissionId) } returns Result.success(buildSubmission())
        every { userProfileRepository.getUserProfile(userId) } returns flowOf(Result.success(buildUserProfile()))

        createWorker().doWork()

        coVerify {
            submissionRepository.finalizeTATAnalysisResult(
                submissionId,
                match { it.failedStoriesCount == 3 }
            )
        }
    }

    @Test
    fun `retry sequence matches RetryBackoffPolicy bounds`() = runTest {
        // WHY: same rationale as TATStoryAnalysisWorker — proves synthesis retries also use
        // the shared exponential-backoff-with-jitter policy, not a fixed linear delay.
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.failure(Exception("Gemini overloaded"))

        createWorker().doWork()

        val expectedMin = RetryBackoffPolicy.minDelayMillis(0) + RetryBackoffPolicy.minDelayMillis(1)
        val expectedMax = RetryBackoffPolicy.maxDelayMillis(0) + RetryBackoffPolicy.maxDelayMillis(1)
        assertTrue(
            "elapsed time ${currentTime}ms must be within [$expectedMin, $expectedMax]",
            currentTime in expectedMin..expectedMax
        )
    }

    @Test
    fun `marks submission failed after retry exhaustion`() = runTest {
        coEvery { tatStoryAssessmentDao.getBySubmissionId(submissionId) } returns buildAssessments(validCount = 6)
        coEvery { aiService.analyzeTATResponse(any()) } returns Result.failure(Exception("Gemini overloaded"))

        val result = createWorker().doWork()

        assertEquals(ListenableWorker.Result.failure(), result)
        coVerify(exactly = 3) { aiService.analyzeTATResponse(any()) }
        coVerify(exactly = 1) { submissionRepository.updateTATAnalysisStatus(submissionId, AnalysisStatus.FAILED) }
    }

    private fun createWorker() = TATSynthesisWorker(context, workerParams)

    private fun buildAssessments(validCount: Int, failedCount: Int = 0): List<TATStoryAssessmentEntity> =
        buildList {
            repeat(validCount) { index -> add(buildAssessment(index)) }
            repeat(failedCount) { index -> add(buildAssessment(validCount + index, valid = false)) }
        }

    private fun buildAssessment(index: Int, valid: Boolean = true) = TATStoryAssessmentEntity(
        id = "assessment-$index",
        submissionId = submissionId,
        questionId = "tat_$index",
        storyIndex = index,
        story = if (valid) "candidate-story-$index" else "placeholder-story-$index",
        imageUrl = "https://example.com/tat_$index.jpg",
        olqScoresJson = "[{\"olq\":\"EFFECTIVE_INTELLIGENCE\",\"score\":6,\"confidence\":80,\"reasoning\":\"Consistent evidence\"}]",
        overallScore = if (valid) 6.0f else 0f,
        overallRating = if (valid) "Good" else TATStoryAnalysisWorker.FAILED_MARKER,
        aiConfidence = if (valid) 80 else 0,
        analyzedAt = 1_717_171_000L + index
    )

    private fun buildSubmission() = TATSubmission(
        id = submissionId,
        userId = userId,
        testId = "tat_standard",
        stories = emptyList(),
        totalTimeTakenMinutes = 45,
        submittedAt = 1_717_171_100L,
        analysisStatus = AnalysisStatus.ANALYZING
    )

    private fun buildUserProfile() = UserProfile(
        userId = userId,
        fullName = "Test Aspirant",
        age = 22,
        gender = Gender.MALE,
        entryType = EntryType.GRADUATE
    )

    private fun buildResponseAnalysis() = ResponseAnalysis(
        olqScores = OLQ.entries.associateWith { olq ->
            OLQScoreWithReasoning(olq = olq, score = 6f, reasoning = "Consistent evidence")
        },
        overallConfidence = 82,
        keyInsights = listOf("Steady performance across stories")
    )
}
