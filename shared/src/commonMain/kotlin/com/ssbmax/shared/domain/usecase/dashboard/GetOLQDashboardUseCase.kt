package com.ssbmax.shared.domain.usecase.dashboard

import kotlin.time.Clock

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.dashboard.OLQDashboardData
import com.ssbmax.shared.domain.model.gto.GTOResultStatus
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.repository.GTORepository
import com.ssbmax.shared.domain.repository.InterviewRepository
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.util.DomainLogger
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Processed dashboard data with pre-computed aggregations
 * Calculations are done ONCE in use case, not on every UI access
 */
data class ProcessedDashboardData(
    val dashboard: OLQDashboardData,
    val averageOLQScores: Map<OLQ, Float>,
    val topOLQs: List<Pair<OLQ, Float>>,
    val improvementOLQs: List<Pair<OLQ, Float>>,
    val overallAverageScore: Float?,
    val cacheMetadata: CacheMetadata,
    /**
     * Test types whose fetch timed out, errored, or whose analysis is still pending — i.e. a
     * result was *expected* but couldn't be shown. Distinct from "never attempted" (which simply
     * has no entry anywhere). The UI uses this to badge affected tiles with "couldn't load — retry"
     * instead of treating the slot as empty. A partial dashboard is rendered regardless.
     */
    val unavailableTypes: Set<TestType> = emptySet()
) {
    companion object {
        /**
         * SSOT for a pre-fetch / no-data dashboard state.
         * Use this wherever the OLQDashboardCard must be rendered before Firestore data arrives.
         * All result fields are null/empty; completedTestsCount == 0, totalTests == 15.
         */
        fun empty(): ProcessedDashboardData = ProcessedDashboardData(
            dashboard = OLQDashboardData(
                userId = "",
                phase1Results = OLQDashboardData.Phase1Results(
                    oirResult = null,
                    ppdtResult = null,
                    ppdtOLQResult = null
                ),
                phase2Results = OLQDashboardData.Phase2Results(
                    tatResult = null,
                    watResult = null,
                    srtResult = null,
                    sdResult = null,
                    gtoResults = emptyMap(),
                    interviewResult = null
                )
            ),
            averageOLQScores = emptyMap(),
            topOLQs = emptyList(),
            improvementOLQs = emptyList(),
            overallAverageScore = null,
            cacheMetadata = CacheMetadata(
                cacheHit = false,
                loadTimeMs = 0L,
                forcedRefresh = false
            )
        )
    }
}

/**
 * Metadata about cache performance for analytics tracking
 */
data class CacheMetadata(
    val cacheHit: Boolean,
    val loadTimeMs: Long,
    val forcedRefresh: Boolean
)

/**
 * Coroutine-safe set for tracking unavailable test types across concurrently running
 * `async` fetch jobs. Replaces `java.util.concurrent.ConcurrentHashMap.newKeySet()` (JVM-only,
 * unavailable in commonMain for the iOS target) with a [Mutex]-guarded [MutableSet] — the
 * standard KMP-compatible way to share mutable state across coroutines.
 */
private class SynchronizedSet<T> {
    private val mutex = Mutex()
    private val backing = mutableSetOf<T>()

    suspend fun add(item: T) = mutex.withLock { backing.add(item) }
    suspend fun isNotEmpty(): Boolean = mutex.withLock { backing.isNotEmpty() }
    suspend fun toSet(): Set<T> = mutex.withLock { backing.toSet() }
    suspend fun joinToString(transform: (T) -> CharSequence): String =
        mutex.withLock { backing.joinToString(transform = transform) }
}

/**
 * Use case to fetch and aggregate all test results for dashboard display
 *
 * Fetches:
 * - Phase 1: OIR, PPDT
 * - Phase 2: TAT, WAT, SRT, SD (Psychology), 8 GTO tests, Interview
 *
 * PERFORMANCE: All aggregations computed once, not on every UI access
 * CACHING: In-memory cache with 5-minute TTL to reduce Firestore reads
 */
class GetOLQDashboardUseCase constructor(
    private val submissionRepository: SubmissionRepository,
    private val gtoRepository: GTORepository,
    private val interviewRepository: InterviewRepository,
    private val logger: DomainLogger
) {
    /**
     * Cached dashboard entry with timestamp for TTL validation
     */
    private data class CachedDashboard(
        val data: ProcessedDashboardData,
        val timestamp: Long
    )

    private val cache = mutableMapOf<String, CachedDashboard>()
    private val cacheMutex = Mutex()

    companion object {
        private const val TAG = "GetOLQDashboard"
        private const val CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutes

        /**
         * Per-test-type fetch budget. Each test type's fetch is isolated under this timeout so one
         * slow Firestore read can never blow up the whole dashboard load — the slow slot resolves
         * as "unavailable" and the rest still render. Replaces the old single 10s umbrella that
         * discarded everything when any one type was slow.
         */
        private const val PER_TYPE_TIMEOUT_MS = 6_000L
    }

    /**
     * Fetch complete dashboard data with pre-computed aggregations
     *
     * @param userId User ID to fetch dashboard for
     * @param forceRefresh If true, bypasses cache and fetches fresh data
     * @return Processed dashboard with all aggregations computed once
     */
    suspend operator fun invoke(
        userId: String,
        forceRefresh: Boolean = false
    ): Result<ProcessedDashboardData> {
        val startTime = Clock.System.now().toEpochMilliseconds()
        var cacheHit = false
        
        logger.d(TAG, "📍 Fetching dashboard for user: $userId (forceRefresh=$forceRefresh)")

        return try {
            cacheMutex.withLock {
                // Check cache validity if not forcing refresh
                val cachedData = cache[userId]
                val now = Clock.System.now().toEpochMilliseconds()

                if (!forceRefresh && cachedData != null &&
                    (now - cachedData.timestamp) < CACHE_TTL_MS) {
                    // Cache hit - return cached data
                    cacheHit = true
                    val loadTime = Clock.System.now().toEpochMilliseconds() - startTime
                    logger.d(TAG, "✅ Cache hit - returning cached data (load time: ${loadTime}ms)")
                    logger.d(TAG, "   OIR result in cache: ${cachedData.data.dashboard.phase1Results.oirResult?.percentageScore}")

                    // Update cache metadata
                    val dataWithMetadata = cachedData.data.copy(
                        cacheMetadata = CacheMetadata(
                            cacheHit = true,
                            loadTimeMs = loadTime,
                            forcedRefresh = false
                        )
                    )

                    return Result.success(dataWithMetadata)
                }

                // Cache miss or expired - fetch fresh data
                logger.d(TAG, "❌ Cache miss - fetching from Firestore")
                val freshData = fetchDashboardData(userId)
                val loadTime = Clock.System.now().toEpochMilliseconds() - startTime
                logger.d(TAG, "   Fetch completed in ${loadTime}ms")

                // Update cache
                cache[userId] = CachedDashboard(
                    data = freshData,
                    timestamp = now
                )

                // Add cache metadata
                val dataWithMetadata = freshData.copy(
                    cacheMetadata = CacheMetadata(
                        cacheHit = false,
                        loadTimeMs = loadTime,
                        forcedRefresh = forceRefresh
                    )
                )
                
                logger.d(TAG, "✅ Dashboard data ready (OIR score: ${dataWithMetadata.dashboard.phase1Results.oirResult?.percentageScore})")

                Result.success(dataWithMetadata)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Invalidate cache for specific user
     * Called after test completion to ensure fresh scores on next dashboard load
     */
    suspend fun invalidateCache(userId: String) {
        cacheMutex.withLock {
            val hadCache = cache.containsKey(userId)
            cache.remove(userId)
            logger.d(TAG, "🗑️ Cache invalidated for user: $userId (had cache: $hadCache)")
        }
    }

    /**
     * Fetch fresh dashboard data from Firestore
     * Extracted from invoke() to support caching layer
     */
    private suspend fun fetchDashboardData(userId: String): ProcessedDashboardData = coroutineScope {
        logger.d(TAG, "🔍 Fetching all dashboard data in parallel for user: $userId")

        // Launch all independent fetches concurrently so every Firestore query hits the network at
        // the same time. Each fetch is additionally isolated under PER_TYPE_TIMEOUT_MS (see
        // fetchSlot): a slow or hung test-type fetch resolves to null + an entry in `unavailable`
        // instead of stalling — and blowing the timeout on — the entire dashboard.
        val unavailable = SynchronizedSet<TestType>()

        val oirJob = async {
            fetchSlot(TestType.OIR, unavailable) {
                submissionRepository.getLatestOIRSubmission(userId).getOrNull()
            }
        }

        // PPDT has a 2-step dependency (submission → OLQ result), so both steps are
        // inside a single slot to keep them parallel with everything else.
        val ppdtJob = async {
            fetchSlot(TestType.PPDT, unavailable) {
                val submission = submissionRepository.getLatestPPDTSubmission(userId).getOrNull()
                // A blank submissionId (stale/malformed submission doc) must never reach
                // getPPDTResult: GitLive's Firestore `.document` call with a blank id throws an
                // uncatchable native FIRInvalidArgumentException that crashes the whole app rather
                // than failing the Result, so this has to be filtered out before the call, not
                // caught after it.
                val olqResult = submission?.takeIf { it.submissionId.isNotBlank() }?.let {
                    submissionRepository.getPPDTResult(it.submissionId).getOrNull()
                }
                Pair(submission, olqResult)
            }
        }

        val tatJob = async { fetchSlot(TestType.TAT, unavailable) { getLatestCompletedOLQResult(userId, "TAT") } }
        val watJob = async { fetchSlot(TestType.WAT, unavailable) { getLatestCompletedOLQResult(userId, "WAT") } }
        val srtJob = async { fetchSlot(TestType.SRT, unavailable) { getLatestCompletedOLQResult(userId, "SRT") } }
        val sdJob  = async { fetchSlot(TestType.SD,  unavailable) { getLatestCompletedOLQResult(userId, "SDT") } }

        // All 8 GTO tests in parallel, each via the lean getLatestResult path (one ordered query
        // per type instead of fetching+joining every completed submission).
        val gtoJobs = GTOTestType.entries.associateWith { gtoType ->
            async { fetchGtoSlot(userId, gtoType, unavailable) }
        }

        // Interview fetched in parallel with everything above.
        val interviewJob = async {
            fetchSlot(TestType.IO, unavailable) {
                interviewRepository.getLatestResult(userId).getOrNull()
            }
        }

        // ── Await all results ────────────────────────────────────────────────────────────
        val oirSubmission = oirJob.await()
        val oirResult = oirSubmission?.testResult
        logger.d(TAG, "   OIR submission found: ${oirSubmission != null}, score: ${oirResult?.percentageScore}")

        val (ppdtSubmission, ppdtOLQResult) = ppdtJob.await() ?: Pair(null, null)

        val tatResult = tatJob.await()
        val watResult = watJob.await()
        val srtResult = srtJob.await()
        val sdResult  = sdJob.await()
        logger.d(TAG, "   Phase 2 results: TAT=${tatResult != null}, WAT=${watResult != null}, SRT=${srtResult != null}, SDT=${sdResult != null}")

        val gtoResults = mutableMapOf<GTOTestType, OLQAnalysisResult>()
        gtoJobs.forEach { (gtoType, job) ->
            job.await()?.let { gtoResult ->
                if (gtoResult.olqScores.isNotEmpty()) {
                    gtoResults[gtoType] = OLQAnalysisResult(
                        submissionId = gtoResult.submissionId,
                        testType = gtoTypeToTestType(gtoType),
                        olqScores = gtoResult.olqScores,
                        overallScore = gtoResult.overallScore,
                        overallRating = gtoResult.overallRating,
                        strengths = gtoResult.strengths,
                        weaknesses = gtoResult.weaknesses,
                        recommendations = gtoResult.recommendations,
                        analyzedAt = gtoResult.analyzedAt,
                        aiConfidence = gtoResult.aiConfidence
                    )
                }
            }
        }

        val interviewResult = interviewJob.await()
        logger.d(TAG, "   Interview result: ${interviewResult != null}")
        if (unavailable.isNotEmpty()) {
            logger.w(TAG, "   ⚠️ Unavailable test types (timed out / pending): ${unavailable.joinToString { it.name }}")
        }

        // Build dashboard
        val dashboard = OLQDashboardData(
            userId = userId,
            phase1Results = OLQDashboardData.Phase1Results(
                // CRITICAL: Ensure sessionId matches document ID for navigation consistency
                oirResult = oirResult?.copy(sessionId = oirSubmission?.id ?: ""),
                ppdtResult = ppdtSubmission,
                ppdtOLQResult = ppdtOLQResult
            ),
            phase2Results = OLQDashboardData.Phase2Results(
                tatResult = tatResult,
                watResult = watResult,
                srtResult = srtResult,
                sdResult = sdResult,
                gtoResults = gtoResults,
                interviewResult = interviewResult
            )
        )

        // PERFORMANCE: Compute all aggregations ONCE, not on every UI access
        val averageOLQScores = computeAverageOLQScores(dashboard)
        val topOLQs = averageOLQScores.entries
            .sortedBy { it.value }
            .take(3)
            .map { it.key to it.value }
        val improvementOLQs = averageOLQScores.entries
            .sortedByDescending { it.value }
            .take(3)
            .map { it.key to it.value }
        val overallAverage = computeOverallAverage(dashboard)

        val finalData = ProcessedDashboardData(
            dashboard = dashboard,
            averageOLQScores = averageOLQScores,
            topOLQs = topOLQs,
            improvementOLQs = improvementOLQs,
            overallAverageScore = overallAverage,
            cacheMetadata = CacheMetadata(
                cacheHit = false,
                loadTimeMs = 0L,
                forcedRefresh = false
            ), // Will be replaced by invoke() with actual metadata
            unavailableTypes = unavailable.toSet()
        )

        logger.d(TAG, "✅ Dashboard built successfully")
        logger.d(TAG, "   Final OIR result: ${finalData.dashboard.phase1Results.oirResult?.percentageScore}")
        logger.d(TAG, "   Phase 2 results: TAT=${finalData.dashboard.phase2Results.tatResult != null}, WAT=${finalData.dashboard.phase2Results.watResult != null}, SRT=${finalData.dashboard.phase2Results.srtResult != null}, SDT=${finalData.dashboard.phase2Results.sdResult != null}")
        logger.d(TAG, "   SDT overallScore: ${finalData.dashboard.phase2Results.sdResult?.overallScore}")
        logger.d(TAG, "   Average OLQ scores count: ${finalData.averageOLQScores.size}")
        logger.d(TAG, "   Overall average score: ${finalData.overallAverageScore}")

        finalData
    }

    /**
     * Wraps a fetch result so a *successful null* (test never attempted) is distinguishable from a
     * *timeout* (withTimeoutOrNull also returns null). Only the latter marks the slot unavailable.
     */
    private class Fetched<out T>(val value: T)

    /**
     * Run one test-type fetch under [PER_TYPE_TIMEOUT_MS]. On timeout, record [type] in
     * [unavailable] and return null so the dashboard renders without it. A successful null (no
     * submission) is returned as-is and does NOT mark the type unavailable.
     */
    private suspend fun <T> fetchSlot(
        type: TestType,
        unavailable: SynchronizedSet<TestType>,
        block: suspend () -> T?
    ): T? {
        val outcome = withTimeoutOrNull(PER_TYPE_TIMEOUT_MS) { Fetched(block()) }
        if (outcome == null) {
            logger.w(TAG, "   ⏱️ ${type.name} fetch timed out after ${PER_TYPE_TIMEOUT_MS}ms")
            unavailable.add(type)
            return null
        }
        return outcome.value
    }

    /**
     * Fetch the latest GTO result for one type under the per-type timeout, mapping the
     * [GTOResultStatus] into a nullable [com.ssbmax.shared.domain.model.gto.GTOResult]:
     * - Available → the result
     * - AnalysisPending (submitted but unscored) → null + marked unavailable
     * - NotAttempted → null (not marked)
     * - timeout / transient failure → null + marked unavailable
     */
    private suspend fun fetchGtoSlot(
        userId: String,
        gtoType: GTOTestType,
        unavailable: SynchronizedSet<TestType>
    ): com.ssbmax.shared.domain.model.gto.GTOResult? {
        val testType = gtoTypeToTestType(gtoType)
        val outcome = withTimeoutOrNull(PER_TYPE_TIMEOUT_MS) {
            Fetched(gtoRepository.getLatestResult(userId, gtoType).getOrNull())
        }
        if (outcome == null) {
            logger.w(TAG, "   ⏱️ ${testType.name} fetch timed out after ${PER_TYPE_TIMEOUT_MS}ms")
            unavailable.add(testType)
            return null
        }
        return when (val status = outcome.value) {
            is GTOResultStatus.Available -> status.result
            GTOResultStatus.AnalysisPending -> {
                unavailable.add(testType)
                null
            }
            GTOResultStatus.NotAttempted, null -> null
        }
    }

    /** Map a [GTOTestType] to its dashboard [TestType] constant. */
    private fun gtoTypeToTestType(gtoType: GTOTestType): TestType = when (gtoType) {
        GTOTestType.GROUP_DISCUSSION -> TestType.GTO_GD
        GTOTestType.GROUP_PLANNING_EXERCISE -> TestType.GTO_GPE
        GTOTestType.LECTURETTE -> TestType.GTO_LECTURETTE
        GTOTestType.PROGRESSIVE_GROUP_TASK -> TestType.GTO_PGT
        GTOTestType.HALF_GROUP_TASK -> TestType.GTO_HGT
        GTOTestType.GROUP_OBSTACLE_RACE -> TestType.GTO_GOR
        GTOTestType.INDIVIDUAL_OBSTACLES -> TestType.GTO_IO
        GTOTestType.COMMAND_TASK -> TestType.GTO_CT
    }

    /**
     * Helper to get latest completed OLQ result for a psychology test
     */
    /**
     * Helper to get latest completed OLQ result for a psychology test
     * 
     * Uses Split Strategy:
     * 1. Get latest submission to get ID
     * 2. Fetch result from psych_results collection using ID
     */
    private suspend fun getLatestCompletedOLQResult(
        userId: String,
        testType: String
    ): OLQAnalysisResult? {
        logger.d(TAG, "🔍 Fetching $testType result for user: $userId")
        
        // 1. Get latest submission to find the submissionId
        val submissionId = when (testType) {
            "TAT" -> submissionRepository.getLatestTATSubmission(userId).getOrNull()?.id
            "WAT" -> submissionRepository.getLatestWATSubmission(userId).getOrNull()?.id
            "SRT" -> submissionRepository.getLatestSRTSubmission(userId).getOrNull()?.id
            "SDT" -> submissionRepository.getLatestSDTSubmission(userId).getOrNull()?.id
            else -> {
                logger.d(TAG, "   ❌ Unknown test type: $testType")
                return null
            }
        }
        
        // Same guard as the PPDT slot above: a blank id (stale/malformed submission doc) must
        // never reach the get*Result() call below, since GitLive's Firestore `.document` call
        // with a blank id throws an uncatchable native exception instead of failing the Result.
        if (submissionId.isNullOrBlank()) {
            logger.d(TAG, "   ⚠️ No $testType submission found for user")
            return null
        }
        
        logger.d(TAG, "   ✅ Found $testType submission ID: $submissionId")

        // 2. Fetch the result from psych_results (via repository)
        val result = when (testType) {
            "TAT" -> submissionRepository.getTATResult(submissionId).getOrNull()
            "WAT" -> submissionRepository.getWATResult(submissionId).getOrNull()
            "SRT" -> submissionRepository.getSRTResult(submissionId).getOrNull()
            "SDT" -> submissionRepository.getSDTResult(submissionId).getOrNull()
            else -> null
        }
        
        if (result == null) {
            logger.w(TAG, "   ⚠️ No $testType OLQ result found for submission: $submissionId")
        } else {
            logger.d(TAG, "   ✅ Found $testType OLQ result with ${result.olqScores.size} OLQ scores, overallScore: ${result.overallScore}")
        }
        
        return result
    }
    
    /**
     * Compute average OLQ scores across all tests (Phase 1 PPDT + Phase 2)
     */
    private fun computeAverageOLQScores(dashboard: OLQDashboardData): Map<OLQ, Float> {
        val olqScoresMap = mutableMapOf<OLQ, Float>()
        
        OLQ.entries.forEach { olq ->
            val scores = mutableListOf<Float>()
            
            // Phase 1: PPDT
            dashboard.phase1Results.ppdtOLQResult?.olqScores?.get(olq)?.score?.let { scores.add(it.toFloat()) }
            
            // Phase 2: Psychology tests
            dashboard.phase2Results.tatResult?.olqScores?.get(olq)?.score?.let { scores.add(it.toFloat()) }
            dashboard.phase2Results.watResult?.olqScores?.get(olq)?.score?.let { scores.add(it.toFloat()) }
            dashboard.phase2Results.srtResult?.olqScores?.get(olq)?.score?.let { scores.add(it.toFloat()) }
            dashboard.phase2Results.sdResult?.olqScores?.get(olq)?.score?.let { scores.add(it.toFloat()) }
            
            // GTO tests
            dashboard.phase2Results.gtoResults.values.forEach { gtoResult ->
                gtoResult.olqScores[olq]?.score?.let { scores.add(it.toFloat()) }
            }
            
            // Interview
            dashboard.phase2Results.interviewResult?.overallOLQScores?.get(olq)?.score?.let { scores.add(it.toFloat()) }
            
            if (scores.isNotEmpty()) {
                olqScoresMap[olq] = scores.average().toFloat()
            }
        }
        
        return olqScoresMap
    }
    
    /**
     * Compute overall average score across all tests (Phase 1 PPDT + Phase 2)
     */
    private fun computeOverallAverage(dashboard: OLQDashboardData): Float? {
        val allScores = mutableListOf<Float>()
        
        // Phase 1: PPDT
        dashboard.phase1Results.ppdtOLQResult?.overallScore?.let { allScores.add(it) }
        
        // Phase 2: Psychology tests
        dashboard.phase2Results.tatResult?.overallScore?.let { allScores.add(it) }
        dashboard.phase2Results.watResult?.overallScore?.let { allScores.add(it) }
        dashboard.phase2Results.srtResult?.overallScore?.let { allScores.add(it) }
        dashboard.phase2Results.sdResult?.overallScore?.let { allScores.add(it) }
        dashboard.phase2Results.gtoResults.values.forEach { it.overallScore.let { score -> allScores.add(score) } }
        dashboard.phase2Results.interviewResult?.getAverageOLQScore()?.let { allScores.add(it) }
        
        return if (allScores.isNotEmpty()) allScores.average().toFloat() else null
    }
}
