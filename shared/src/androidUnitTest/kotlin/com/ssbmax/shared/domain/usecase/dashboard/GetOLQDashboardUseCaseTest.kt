package com.ssbmax.shared.domain.usecase.dashboard

import com.ssbmax.shared.domain.model.*
import com.ssbmax.shared.domain.model.gto.GTOResult
import com.ssbmax.shared.domain.model.gto.GTOResultStatus
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQScore
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.repository.GTORepository
import com.ssbmax.shared.domain.repository.InterviewRepository
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.model.interview.InterviewResult
import com.ssbmax.shared.domain.model.interview.InterviewMode
import com.ssbmax.shared.domain.model.interview.OLQCategory
import com.ssbmax.shared.domain.util.NoOpLogger
import kotlin.time.Clock
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.async
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for GetOLQDashboardUseCase
 * Verifies data fetching logic and aggregations, including the Split Collection Strategy wiring.
 */
class GetOLQDashboardUseCaseTest {

    private lateinit var submissionRepository: SubmissionRepository
    private lateinit var gtoRepository: GTORepository
    private lateinit var interviewRepository: InterviewRepository
    private lateinit var getOLQDashboardUseCase: GetOLQDashboardUseCase

    @Before
    fun setup() {
        submissionRepository = mockk(relaxed = true)
        gtoRepository = mockk(relaxed = true)
        interviewRepository = mockk(relaxed = true)

        // The dashboard now fetches GTO via the lean getLatestResult path. Default every type to
        // NotAttempted so tests that don't care about GTO stay isolated; individual tests override.
        coEvery { gtoRepository.getLatestResult(any(), any()) } returns Result.success(GTOResultStatus.NotAttempted)

        // Use NoOpLogger for testing (domain layer is now platform-independent)
        getOLQDashboardUseCase = GetOLQDashboardUseCase(
            submissionRepository,
            gtoRepository,
            interviewRepository,
            NoOpLogger()
        )
    }

    @Test
    fun `invoke calls getTATResult with correct submission ID`() = runTest {
        // Given
        val userId = "user_123"
        val tatSubmissionId = "tat_sub_456"
        val tatSubmission = mockk<TATSubmission> {
            every { id } returns tatSubmissionId
            every { analysisStatus } returns AnalysisStatus.COMPLETED
        }
        val tatResult = createOLQResult(
            submissionId = tatSubmissionId,
            testType = TestType.TAT,
            scores = mapOf(OLQ.EFFECTIVE_INTELLIGENCE to 4f)
        )

        // Mock: Latest submission return to get ID
        coEvery { submissionRepository.getLatestTATSubmission(userId) } returns Result.success(tatSubmission)
        // Mock: Result fetch using that ID
        coEvery { submissionRepository.getTATResult(tatSubmissionId) } returns Result.success(tatResult)
        
        // Mock others to return empty/null to isolate test
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        
        // Verify TAT result is present
        assertNotNull(data?.dashboard?.phase2Results?.tatResult)
        assertEquals(tatSubmissionId, data?.dashboard?.phase2Results?.tatResult?.submissionId)
        assertEquals(4f, data?.averageOLQScores?.get(OLQ.EFFECTIVE_INTELLIGENCE))
    }

    @Test
    fun `invoke calls getLatestPPDTSubmission and getPPDTResult with correct IDs`() = runTest {
        // Given
        val userId = "user_123"
        val ppdtSubmissionId = "ppdt_sub_789"
        val ppdtSubmission = mockk<PPDTSubmission> {
            every { submissionId } returns ppdtSubmissionId
            // PPDT usually stores analysisStatus in data map, but repo handles it.
            // Mocking the object itself is enough here.
        }
        val ppdtResult = createOLQResult(
            submissionId = ppdtSubmissionId,
            testType = TestType.PPDT,
            scores = mapOf(OLQ.INITIATIVE to 5f)
        )

        // Mock: Latest submission return
        coEvery { submissionRepository.getLatestPPDTSubmission(userId) } returns Result.success(ppdtSubmission)
        // Mock: Result fetch using that ID
        coEvery { submissionRepository.getPPDTResult(ppdtSubmissionId) } returns Result.success(ppdtResult)

        // Mock others empty
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        
        // Verify PPDT result
        assertNotNull(data?.dashboard?.phase1Results?.ppdtOLQResult)
        assertEquals(ppdtSubmissionId, data?.dashboard?.phase1Results?.ppdtOLQResult?.submissionId)
        assertEquals(5f, data?.averageOLQScores?.get(OLQ.INITIATIVE))
    }
    
    @Test
    fun `invoke calls gtoRepository and aggregates GTO scores correctly`() = runTest {
        // Given
        val userId = "user_123"
        val gdResult = GTOResult(
            submissionId = "gd_1",
            userId = userId,
            testType = GTOTestType.GROUP_DISCUSSION,
            olqScores = mapOf(
                OLQ.SOCIAL_ADJUSTMENT to OLQScore(4, 80, ""),
                OLQ.COOPERATION to OLQScore(5, 80, "")
            ),
            overallScore = 4.5f,
            overallRating = "Average",
            strengths = emptyList(),
            weaknesses = emptyList(),
            recommendations = emptyList(),
            analyzedAt = System.currentTimeMillis(),
            aiConfidence = 80
        )
        
        // Mock GTO repo to return this result for GD via the lean latest-result path
        coEvery { gtoRepository.getLatestResult(any(), any()) } returns Result.success(GTOResultStatus.NotAttempted)
        coEvery { gtoRepository.getLatestResult(userId, GTOTestType.GROUP_DISCUSSION) } returns
            Result.success(GTOResultStatus.Available(gdResult))

        // Mock others empty
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        
        // Verify GTO result
        val gdDashboardResult = data?.dashboard?.phase2Results?.gtoResults?.get(GTOTestType.GROUP_DISCUSSION)
        assertNotNull(gdDashboardResult)
        assertEquals("gd_1", gdDashboardResult?.submissionId)
        // Avg Social Adjustment: 4.0
        assertEquals(4.0f, data?.averageOLQScores?.get(OLQ.SOCIAL_ADJUSTMENT))
    }

    @Test
    fun `computeAverageOLQScores calculates correct averages`() = runTest {
         // Given
        val userId = "user_123"
        val tatResult = createOLQResult(
            submissionId = "tat_1",
            testType = TestType.TAT,
            scores = mapOf(OLQ.EFFECTIVE_INTELLIGENCE to 3f, OLQ.REASONING_ABILITY to 4f)
        )
        val watResult = createOLQResult(
            submissionId = "wat_1",
            testType = TestType.WAT,
            scores = mapOf(OLQ.EFFECTIVE_INTELLIGENCE to 5f, OLQ.REASONING_ABILITY to 6f)
        )
        
        // Mock TAT
        val tatSub = mockk<TATSubmission> { every { id } returns "tat_1" }
        coEvery { submissionRepository.getLatestTATSubmission(userId) } returns Result.success(tatSub)
        coEvery { submissionRepository.getTATResult("tat_1") } returns Result.success(tatResult)
        
        // Mock WAT
        val watSub = mockk<WATSubmission> { every { id } returns "wat_1" }
        coEvery { submissionRepository.getLatestWATSubmission(userId) } returns Result.success(watSub)
        coEvery { submissionRepository.getWATResult("wat_1") } returns Result.success(watResult)
        
        // Mock others empty
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)
        val averages = result.getOrNull()?.averageOLQScores

        // Then
        assertNotNull(averages)
        // Avg Effective Intelligence: (3 + 5) / 2 = 4.0
        assertEquals(4.0f, averages?.get(OLQ.EFFECTIVE_INTELLIGENCE) ?: 0f, 0.01f)
        // Avg Reasoning Ability: (4 + 6) / 2 = 5.0
        assertEquals(5.0f, averages?.get(OLQ.REASONING_ABILITY) ?: 0f, 0.01f)
    }

    @Test
    fun `invoke calls interviewRepository and aggregates Interview scores correctly`() = runTest {
        // Given
        val userId = "user_123"
        val interviewResult = InterviewResult(
            id = "res_1",
            sessionId = "session_1",
            userId = userId,
            mode = InterviewMode.VOICE_BASED,
            completedAt = Clock.System.now(),
            durationSec = 1800,
            totalQuestions = 10,
            totalResponses = 10,
            overallOLQScores = mapOf(
                OLQ.EFFECTIVE_INTELLIGENCE to OLQScore(6, 80, "Good") 
            ), 
            categoryScores = mapOf(OLQCategory.INTELLECTUAL to 6f),
            overallConfidence = 80,
            strengths = emptyList(),
            weaknesses = emptyList(),
            feedback = "Good",
            overallRating = 6
        )
        
        // Mock Interview repo - getLatestResult returns one-shot suspend result
        coEvery { interviewRepository.getLatestResult(userId) } returns Result.success(interviewResult)
        
        // Mock others empty
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        
        // Verify Interview result
        assertNotNull(data?.dashboard?.phase2Results?.interviewResult)
        assertEquals("session_1", data?.dashboard?.phase2Results?.interviewResult?.sessionId)
        // Avg for that OLQ
        assertEquals(6.0f, data?.averageOLQScores?.get(OLQ.EFFECTIVE_INTELLIGENCE))
    }

    /**
     * REGRESSION PREVENTION TEST: OIR Dashboard Navigation ID Consistency
     * 
     * This test ensures that any discrepancy between the internal sessionId 
     * and the document ID is reconciled when the dashboard data is built.
     * Without this fix, clicking on OIR tile would result in "Submission not found" error.
     */
    @Test
    fun `invoke reconciles OIR sessionId with submission document ID`() = runTest {
        // Given
        val userId = "user_123"
        val submissionId = "oir_doc_ID"
        val sessionIdInResult = "internal_session_ID" // Mismatched ID in old records
        
        val oirResult = OIRTestResult(
            testId = "test_1",
            sessionId = sessionIdInResult,
            userId = userId,
            totalQuestions = 10,
            correctAnswers = 5,
            incorrectAnswers = 5,
            skippedQuestions = 0,
            totalTimeSeconds = 600,
            timeTakenSeconds = 300,
            rawScore = 5,
            percentageScore = 50f,
            categoryScores = emptyMap(),
            difficultyBreakdown = emptyMap(),
            answeredQuestions = emptyList(),
            completedAt = System.currentTimeMillis()
        )
        
        val oirSubmission = OIRSubmission(
            id = submissionId,
            userId = userId,
            testId = "test_1",
            testResult = oirResult,
            submittedAt = System.currentTimeMillis(),
            status = SubmissionStatus.SUBMITTED_PENDING_REVIEW
        )

        // Mock: Return submission with mismatched internal ID
        coEvery { submissionRepository.getLatestOIRSubmission(userId) } returns Result.success(oirSubmission)
        
        // Mock others empty
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        
        // CRITICAL VERIFICATION: The sessionId in the processed data MUST match the submission document ID
        // even if it was different in the raw data (regression prevention)
        val finalOirResult = data?.dashboard?.phase1Results?.oirResult
        assertNotNull(finalOirResult)
        assertEquals("The sessionId must be reconciled with the document ID for navigation consistency",
            submissionId, finalOirResult?.sessionId)
    }

    /**
     * OIR RETAKE SEAL (Phase 1, Option B) — characterization test.
     *
     * Once OIR mints a fresh submission id per attempt, a user can have multiple OIR
     * submission documents. This pins that the dashboard reflects the most recently
     * submitted one — [getLatestOIRSubmission]'s real implementation already queries
     * `orderBy(submittedAt, DESCENDING).limit(1)`, so this test simulates that contract
     * by only stubbing the newer of two attempts, and asserts the dashboard's reconciled
     * id matches it. Guards against a future "simplification" back to a fixed-id lookup.
     */
    @Test
    fun `dashboard reflects the most recent of multiple OIR submissions for a user`() = runTest {
        val userId = "user_retake"
        val newerSubmissionId = "oir_attempt_2"

        val newerResult = OIRTestResult(
            testId = "oir_standard",
            sessionId = "stale_session_ref",
            userId = userId,
            totalQuestions = 10,
            correctAnswers = 8,
            incorrectAnswers = 2,
            skippedQuestions = 0,
            totalTimeSeconds = 600,
            timeTakenSeconds = 300,
            rawScore = 8,
            percentageScore = 80f,
            categoryScores = emptyMap(),
            difficultyBreakdown = emptyMap(),
            answeredQuestions = emptyList(),
            completedAt = System.currentTimeMillis()
        )
        val newerSubmission = OIRSubmission(
            id = newerSubmissionId,
            userId = userId,
            testId = "oir_standard",
            testResult = newerResult,
            submittedAt = System.currentTimeMillis(),
            status = SubmissionStatus.SUBMITTED_PENDING_REVIEW
        )

        // getLatestOIRSubmission's real query already orders by submittedAt DESC and
        // limits to 1 — simulate that contract by only ever returning the newer attempt.
        coEvery { submissionRepository.getLatestOIRSubmission(userId) } returns Result.success(newerSubmission)
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        val result = getOLQDashboardUseCase(userId)

        assertTrue(result.isSuccess)
        val finalOirResult = result.getOrNull()?.dashboard?.phase1Results?.oirResult
        assertNotNull(finalOirResult)
        assertEquals(newerSubmissionId, finalOirResult?.sessionId)
        assertEquals(80f, finalOirResult?.percentageScore)
    }

    // =========================================================================
    // PER-TYPE ISOLATION TESTS (partial render)
    // WHY: a single slow/failing test type must never discard the whole dashboard.
    // =========================================================================

    @Test
    fun `one slow test type times out but dashboard still returns the others`() = runTest {
        // Given: WAT loads instantly, but TAT's fetch hangs past the per-type budget (6s).
        val userId = "user_timeout"
        val watResult = createOLQResult(
            submissionId = "wat_ok",
            testType = TestType.WAT,
            scores = mapOf(OLQ.REASONING_ABILITY to 5f)
        )
        val watSub = mockk<WATSubmission> { every { id } returns "wat_ok" }
        coEvery { submissionRepository.getLatestWATSubmission(userId) } returns Result.success(watSub)
        coEvery { submissionRepository.getWATResult("wat_ok") } returns Result.success(watResult)

        // TAT hangs (7s > PER_TYPE_TIMEOUT_MS of 6s) — virtual time in runTest.
        val tatSub = mockk<TATSubmission> { every { id } returns "tat_slow" }
        coEvery { submissionRepository.getLatestTATSubmission(userId) } coAnswers {
            kotlinx.coroutines.delay(7_000)
            Result.success(tatSub)
        }

        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then: load succeeds (no wholesale failure), WAT is present, TAT is flagged unavailable.
        assertTrue("Dashboard must succeed despite one slow type", result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertNotNull("WAT loaded fine and must be present", data?.dashboard?.phase2Results?.watResult)
        assertNull("TAT timed out so it has no result", data?.dashboard?.phase2Results?.tatResult)
        assertTrue(
            "TAT must be flagged unavailable (timed out), not silently dropped",
            data?.unavailableTypes?.contains(TestType.TAT) == true
        )
        assertFalse(
            "WAT loaded successfully and must NOT be flagged unavailable",
            data?.unavailableTypes?.contains(TestType.WAT) == true
        )
    }

    @Test
    fun `GTO analysis pending marks the type unavailable without a result`() = runTest {
        // Given: a GD submission exists but is unscored (worker pending/failed) → AnalysisPending.
        val userId = "user_gto_pending"
        coEvery { gtoRepository.getLatestResult(any(), any()) } returns Result.success(GTOResultStatus.NotAttempted)
        coEvery { gtoRepository.getLatestResult(userId, GTOTestType.GROUP_DISCUSSION) } returns
            Result.success(GTOResultStatus.AnalysisPending)

        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNull(
            "Pending GTO analysis must not produce a score",
            data?.dashboard?.phase2Results?.gtoResults?.get(GTOTestType.GROUP_DISCUSSION)
        )
        assertTrue(
            "Pending GTO type must be surfaced as unavailable, not dropped silently",
            data?.unavailableTypes?.contains(TestType.GTO_GD) == true
        )
    }

    @Test
    fun `not-attempted test types are NOT flagged unavailable`() = runTest {
        // Given: a fresh user with no submissions at all.
        val userId = "user_empty"
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)

        // When
        val result = getOLQDashboardUseCase(userId)

        // Then: nothing is "unavailable" — empty slots are simply not-attempted.
        assertTrue(result.isSuccess)
        assertTrue(
            "Never-attempted types must not be flagged unavailable",
            result.getOrNull()?.unavailableTypes?.isEmpty() == true
        )
    }

    // Helper to create test OLQ results
    private fun createOirResult(submissionId: String): OIRTestResult = OIRTestResult(
        testId = "oir_standard",
        sessionId = "internal-$submissionId",
        userId = "user_concurrent_submission",
        totalQuestions = 50,
        correctAnswers = 40,
        incorrectAnswers = 10,
        skippedQuestions = 0,
        totalTimeSeconds = 3_000,
        timeTakenSeconds = 2_000,
        rawScore = 40,
        percentageScore = 80f,
        categoryScores = emptyMap(),
        difficultyBreakdown = emptyMap(),
        answeredQuestions = emptyList(),
        completedAt = 1L
    )

    private fun createOLQResult(
        submissionId: String,
        testType: TestType,
        scores: Map<OLQ, Float>
    ): OLQAnalysisResult {
        return OLQAnalysisResult(
            submissionId = submissionId,
            testType = testType,
            olqScores = scores.mapValues { (_, score) ->
                OLQScore(score = score.toInt(), confidence = 80, reasoning = "Test")
            },
            overallScore = scores.values.average().toFloat(),
            overallRating = "Test",
            strengths = emptyList(),
            weaknesses = emptyList(),
            recommendations = emptyList(),
            analyzedAt = System.currentTimeMillis(),
            aiConfidence = 80
        )
    }

    // =========================================================================
    // REGRESSION TESTS: Cache Invalidation Timing
    // These tests ensure the dashboard doesn't cache stale data during analysis
    // =========================================================================

    @Test
    fun `cache returns fresh data after invalidation`() = runTest {
        // Given: User has completed PPDT with results
        val userId = "user_cache_test"
        val ppdtResult = createOLQResult(
            submissionId = "ppdt_fresh",
            testType = TestType.PPDT,
            scores = mapOf(OLQ.INITIATIVE to 5f)
        )
        
        val ppdtSubmission = mockk<PPDTSubmission> {
            every { submissionId } returns "ppdt_fresh"
        }
        
        coEvery { submissionRepository.getLatestPPDTSubmission(userId) } returns Result.success(ppdtSubmission)
        coEvery { submissionRepository.getPPDTResult("ppdt_fresh") } returns Result.success(ppdtResult)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)
        
        // When: Fetch and cache
        val result1 = getOLQDashboardUseCase(userId)
        assertEquals("ppdt_fresh", result1.getOrNull()?.dashboard?.phase1Results?.ppdtOLQResult?.submissionId)
        
        // Simulate: New PPDT submission completed
        val newPpdtResult = createOLQResult(
            submissionId = "ppdt_new",
            testType = TestType.PPDT,
            scores = mapOf(OLQ.INITIATIVE to 4f)
        )
        val newPpdtSubmission = mockk<PPDTSubmission> {
            every { submissionId } returns "ppdt_new"
        }
        coEvery { submissionRepository.getLatestPPDTSubmission(userId) } returns Result.success(newPpdtSubmission)
        coEvery { submissionRepository.getPPDTResult("ppdt_new") } returns Result.success(newPpdtResult)
        
        // When: Invalidate cache (simulating PPDTAnalysisWorker behavior)
        getOLQDashboardUseCase.invalidateCache(userId)
        
        // Then: Next fetch should return fresh data
        val result2 = getOLQDashboardUseCase(userId)
        assertEquals(
            "After cache invalidation, should get fresh PPDT result",
            "ppdt_new",
            result2.getOrNull()?.dashboard?.phase1Results?.ppdtOLQResult?.submissionId
        )
    }

    @Test
    fun `forceRefresh bypasses cache and returns fresh data`() = runTest {
        // Given: User has completed PPDT with results
        val userId = "user_force_refresh"
        val ppdtResult = createOLQResult(
            submissionId = "ppdt_old",
            testType = TestType.PPDT,
            scores = mapOf(OLQ.INITIATIVE to 6f)
        )
        
        val ppdtSubmission = mockk<PPDTSubmission> {
            every { submissionId } returns "ppdt_old"
        }
        
        coEvery { submissionRepository.getLatestPPDTSubmission(userId) } returns Result.success(ppdtSubmission)
        coEvery { submissionRepository.getPPDTResult("ppdt_old") } returns Result.success(ppdtResult)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)
        
        // Populate cache
        getOLQDashboardUseCase(userId)
        
        // Update data source
        val newPpdtResult = createOLQResult(
            submissionId = "ppdt_new",
            testType = TestType.PPDT,
            scores = mapOf(OLQ.INITIATIVE to 4f)
        )
        val newPpdtSubmission = mockk<PPDTSubmission> {
            every { submissionId } returns "ppdt_new"
        }
        coEvery { submissionRepository.getLatestPPDTSubmission(userId) } returns Result.success(newPpdtSubmission)
        coEvery { submissionRepository.getPPDTResult("ppdt_new") } returns Result.success(newPpdtResult)
        
        // When: Force refresh
        val result = getOLQDashboardUseCase(userId, forceRefresh = true)
        
        // Then: Should return fresh data
        assertEquals(
            "forceRefresh=true should bypass cache",
            "ppdt_new",
            result.getOrNull()?.dashboard?.phase1Results?.ppdtOLQResult?.submissionId
        )
    }

    @Test
    fun `invalidation after concurrent fetch prevents stale dashboard cache`() = runTest {
        val userId = "user_concurrent_submission"
        val oldSubmission = mockk<OIRSubmission> {
            every { id } returns "oir_old"
            every { testResult } returns createOirResult("oir_old")
        }
        val newSubmission = mockk<OIRSubmission> {
            every { id } returns "oir_new"
            every { testResult } returns createOirResult("oir_new")
        }

        coEvery { submissionRepository.getLatestOIRSubmission(userId) } returns Result.success(oldSubmission)
        coEvery { submissionRepository.getLatestPPDTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)
        val initial = getOLQDashboardUseCase(userId)
        assertTrue("Initial dashboard fetch failed: ${initial.exceptionOrNull()}", initial.isSuccess)
        assertEquals("oir_old", initial.getOrNull()?.dashboard?.phase1Results?.oirResult?.sessionId)

        val fetchStarted = CompletableDeferred<Unit>()
        val releaseFetch = CompletableDeferred<Unit>()
        coEvery { submissionRepository.getLatestOIRSubmission(userId) } coAnswers {
            fetchStarted.complete(Unit)
            releaseFetch.await()
            Result.success(newSubmission)
        }

        val inFlightFetch = async { getOLQDashboardUseCase(userId, forceRefresh = true) }
        fetchStarted.await()
        val invalidation = async { getOLQDashboardUseCase.invalidateCache(userId) }
        releaseFetch.complete(Unit)
        inFlightFetch.await()
        invalidation.await()

        val afterSubmission = getOLQDashboardUseCase(userId)
        assertEquals(
            "Invalidation must evict the snapshot fetched before Home resumes",
            "oir_new",
            afterSubmission.getOrNull()?.dashboard?.phase1Results?.oirResult?.sessionId
        )
    }

    @Test
    fun `dashboard returns null ppdtOLQResult when analysis is still pending`() = runTest {
        // Given: User submitted PPDT but analysis not complete (no result in ppdt_results yet)
        val userId = "user_pending_analysis"
        
        val ppdtSubmission = mockk<PPDTSubmission> {
            every { submissionId } returns "ppdt_pending"
            every { analysisStatus } returns AnalysisStatus.ANALYZING
        }
        
        // Submission exists but result doesn't (analysis in progress)
        coEvery { submissionRepository.getLatestPPDTSubmission(userId) } returns Result.success(ppdtSubmission)
        coEvery { submissionRepository.getPPDTResult("ppdt_pending") } returns Result.success(null)
        coEvery { submissionRepository.getLatestOIRSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestTATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestWATSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSRTSubmission(any()) } returns Result.success(null)
        coEvery { submissionRepository.getLatestSDTSubmission(any()) } returns Result.success(null)
        coEvery { gtoRepository.getUserResults(any(), any()) } returns Result.success(emptyList())
        coEvery { interviewRepository.getLatestResult(any()) } returns Result.success(null)
        
        // When
        val result = getOLQDashboardUseCase(userId)
        
        // Then: ppdtOLQResult should be null (analysis pending)
        assertTrue(result.isSuccess)
        assertNull(
            "ppdtOLQResult should be null when analysis is still pending",
            result.getOrNull()?.dashboard?.phase1Results?.ppdtOLQResult
        )
        // But submission should still be present
        assertNotNull(
            "ppdtResult (submission) should still be present",
            result.getOrNull()?.dashboard?.phase1Results?.ppdtResult
        )
    }
}
