package com.ssbmax.shared.analysis

import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.TATStoryResponse
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.service.OLQScoreWithReasoning
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.presentation.testing.FakeAIService
import com.ssbmax.shared.presentation.testing.FakeGTORepository
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeSubmissionRepository
import com.ssbmax.shared.presentation.testing.FakeTestContentRepository
import com.ssbmax.shared.presentation.testing.FakeUserProfileRepository
import com.ssbmax.shared.presentation.testing.RecordingLogger
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.respondError
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.http.HttpHeaders
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

/**
 * TAT_Impr_3 Phase 3: the iOS/shared analysis path must read the persisted questions
 * the user actually saw, falling back to a repo fetch only for legacy docs. Previously
 * `analyze()` called `getTATQuestions(testId)` which ignores `testId` and returns a fresh
 * random 12 with different IDs -> `imageUrl = ""` -> `ByteArray(0)` on every story.
 */
class TATAnalysisOrchestratorTest {

    private val submissionId = "sub-123"
    private val testId = "tat_standard"

    private val persistedQuestions = listOf(
        TATQuestion(id = "q1", imageUrl = "https://example.com/1.png", cardPosition = 1),
        TATQuestion(id = "q2", imageUrl = "https://example.com/2.png", cardPosition = 2)
    )

    // Fallback repo questions must share the story's questionId ("q1") so the lookup in
    // analyzeStory resolves -- the fallback path is what's under test, not the ID mismatch
    // that the persisted-questions fix eliminates.
    private val repoQuestions = listOf(
        TATQuestion(id = "q1", imageUrl = "https://example.com/repo1.png", cardPosition = 1),
        TATQuestion(id = "q2", imageUrl = "https://example.com/repo2.png", cardPosition = 2)
    )

    private fun fullOlqAnalysis(): ResponseAnalysis = ResponseAnalysis(
        olqScores = OLQ.entries.associateWith { OLQScoreWithReasoning(it, 5f, "reasoning for ${it.name}") },
        overallConfidence = 80,
        keyInsights = listOf("insight")
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

    /** HttpClient whose MockEngine serves the persisted image URL as real bytes. */
    private fun imageHttpClient(imageUrl: String) = HttpClient(MockEngine) {
        engine {
            addHandler { request ->
                if (request.url.toString() == imageUrl) {
                    respond(
                        content = ByteArray(42) { 1 },
                        status = HttpStatusCode.OK,
                        headers = headersOf(HttpHeaders.ContentType, "image/jpeg")
                    )
                } else {
                    respondError(HttpStatusCode.NotFound)
                }
            }
        }
    }

    private fun noopHttpClient() = HttpClient(MockEngine) {
        engine { addHandler { respondError(HttpStatusCode.NotFound) } }
    }

    /** FakeAIService that records the imageBytes handed to the multimodal analyzer. */
    private class RecordingImageAIService : FakeAIService() {
        var lastImageBytes: ByteArray? = null
        override suspend fun analyzeTATStoryMultimodal(
            imageBytes: ByteArray,
            story: String,
            imageContext: com.ssbmax.shared.domain.model.TATImageContext,
            candidateGender: String,
            storyIndex: Int,
            totalStories: Int,
            imageGenderTag: String
        ): Result<ResponseAnalysis> {
            lastImageBytes = imageBytes
            return responseAnalysisResult
        }
    }

    private fun orchestrator(
        submissionRepo: com.ssbmax.shared.domain.repository.SubmissionRepository,
        testContentRepo: com.ssbmax.shared.domain.repository.TestContentRepository,
        aiService: FakeAIService,
        httpClient: HttpClient
    ) = TATAnalysisOrchestrator(
        submissionRepo,
        testContentRepo,
        FakeUserProfileRepository(),
        aiService,
        GetOLQDashboardUseCase(submissionRepo, FakeGTORepository(), FakeInterviewRepository(), RecordingLogger()),
        httpClient,
        RecordingLogger()
    )

    @Test
    fun `analyzeStory uses persisted imageUrl when submission has questions`() = runTest {
        val submissionRepo = object : com.ssbmax.shared.domain.repository.SubmissionRepository by (FakeSubmissionRepository().apply {
            // getTATSubmission is unused() in the fake; override it below.
        }) {
            override suspend fun getTATSubmission(id: String): Result<TATSubmission?> =
                Result.success(buildSubmission(questions = persistedQuestions))
            override suspend fun updateTATAnalysisStatus(id: String, status: AnalysisStatus): Result<Unit> =
                Result.success(Unit)
            override suspend fun finalizeTATAnalysisResult(id: String, result: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult): Result<Unit> =
                Result.success(Unit)
        }
        // getTATQuestions returns emptyList by default in the fake; when persisted questions
        // exist the repo must NOT be consulted, so the empty default is fine here.
        val testContentRepo = FakeTestContentRepository()
        val aiService = RecordingImageAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = orchestrator(submissionRepo, testContentRepo, aiService, imageHttpClient(persistedQuestions[0].imageUrl))

        orchestrator.analyze(submissionId)

        // The persisted imageUrl was downloaded (42 bytes), not a repo-fetched one.
        assertEquals(42, aiService.lastImageBytes?.size)
    }

    @Test
    fun `analyzeStory falls back to getTATQuestions when submission has no questions`() = runTest {
        val submissionRepo = object : com.ssbmax.shared.domain.repository.SubmissionRepository by (FakeSubmissionRepository()) {
            override suspend fun getTATSubmission(id: String): Result<TATSubmission?> =
                Result.success(buildSubmission(questions = emptyList()))
            override suspend fun updateTATAnalysisStatus(id: String, status: AnalysisStatus): Result<Unit> =
                Result.success(Unit)
            override suspend fun finalizeTATAnalysisResult(id: String, result: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult): Result<Unit> =
                Result.success(Unit)
        }
        val testContentRepo = FakeTestContentRepository()
        // Override getTATQuestions to return repoQuestions (the fallback source).
        val fallbackRepo = object : com.ssbmax.shared.domain.repository.TestContentRepository by testContentRepo {
            override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
                Result.success(repoQuestions)
        }
        val aiService = RecordingImageAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = orchestrator(submissionRepo, fallbackRepo, aiService, imageHttpClient(repoQuestions[0].imageUrl))

        orchestrator.analyze(submissionId)

        // The fallback repo's imageUrl was downloaded (42 bytes).
        assertEquals(42, aiService.lastImageBytes?.size)
    }

    @Test
    fun `analyzeStory produces zero bytes only for blank imageUrl`() = runTest {
        // A question with a blank imageUrl (blank card) must yield ByteArray(0) and still analyze.
        val blankCardQuestions = listOf(
            TATQuestion(id = "q1", imageUrl = "", cardPosition = 12)
        )
        val submissionRepo = object : com.ssbmax.shared.domain.repository.SubmissionRepository by (FakeSubmissionRepository()) {
            override suspend fun getTATSubmission(id: String): Result<TATSubmission?> =
                Result.success(buildSubmission(questions = blankCardQuestions))
            override suspend fun updateTATAnalysisStatus(id: String, status: AnalysisStatus): Result<Unit> =
                Result.success(Unit)
            override suspend fun finalizeTATAnalysisResult(id: String, result: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult): Result<Unit> =
                Result.success(Unit)
        }
        val aiService = RecordingImageAIService().apply { responseAnalysisResult = Result.success(fullOlqAnalysis()) }
        val orchestrator = orchestrator(submissionRepo, FakeTestContentRepository(), aiService, noopHttpClient())

        orchestrator.analyze(submissionId)

        assertEquals(0, aiService.lastImageBytes?.size)
        assertTrue(aiService.lastImageBytes != null)
    }
}