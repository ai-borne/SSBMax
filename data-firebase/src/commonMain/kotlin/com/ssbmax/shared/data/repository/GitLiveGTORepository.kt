package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.gto.*
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQScore
import com.ssbmax.shared.domain.repository.GTORepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow

/**
 * GitLive-Firebase-backed port of the Android `FirestoreGTORepository`. Same collections
 * ("submissions", "gto_results", "user_progress") and `test_content/gto/...` batch paths as the
 * Android original; uses `Query.snapshots`/`DocumentReference.snapshots` (native Flows) in place
 * of the Android SDK's `addSnapshotListener`/`callbackFlow`.
 *
 * This class implements [GTORepository] directly and keeps the test-content/cache methods
 * (`getRandomTest`/`getTestById`/`getRandomGPEScenario`/`getObstaclesForTest`/`cacheTestContent`/
 * `clearCache`/`isContentCached`) inline; the submissions, progress, and results clusters
 * are delegated to [GitLiveGTOSubmissionDelegate], [GitLiveGTOProgressDelegate], and
 * [GitLiveGTOResultsDelegate] respectively — a later structural split of this originally-single
 * class, done purely to keep every file under the repo's 300-line-per-file limit. No behavior
 * changed by that split; see each delegate's class doc for the piece of behavior it carries
 * forward.
 *
 * One real, documented deviation from the Android original (not silently dropped):
 *
 * 1. **`updateProgress` is read-then-write instead of the Android original's
 *    `firestore.runTransaction`.** No other `GitLive*Repository` port in this codebase has
 *    exercised GitLive's `Transaction` API yet, and its `set(documentRef, data: Any, merge)`
 *    overload (unlike `WriteBatch.set`, which is `<reified T : Any>`) takes a plain `Any` — i.e.
 *    it can't reliably encode a concrete `@Serializable` DTO without an explicit
 *    `SerializationStrategy`. Rather than risk an unverified API path in a slice this size, this
 *    port uses the same proven `DocumentReference.get()` + `DocumentReference.set()` pattern as
 *    every other port here, accepting a small non-atomic race window under concurrent writes to
 *    the same user's progress doc (same category of documented simplification as
 *    `GitLiveUserProfileRepository`'s original UTC-vs-local-timezone gap, since fixed).
 *
 * A second finding, not a deviation but a correction: the Android original's private
 * `mapToSubmission` only recognizes GD/LECTURETTE/GPE test-type strings — it throws
 * `IllegalArgumentException` for any other value *before* reaching the `when (testType)` branches
 * for PGT/HGT/GOR/IO/CT, making those five branches dead code (unreachable in the original, since
 * `testType` can never resolve to them at that point). This port only implements the three
 * reachable branches ([parseGtoSubmissionTestType]) rather than porting unreachable code forward.
 *
 * **Gap closed (8th slice):** `cacheTestContent`/`clearCache`/`isContentCached` for GD/LECTURETTE
 * now delegate to [GitLiveGTOTaskCacheManager] (the SQLDelight-backed port of the Android
 * `GTOTaskCacheManager`/`GTOTaskCacheDao`), instead of the always-"not cached" defaults the 5th
 * slice left here. Same behavior as the Android original: GPE and the animation-obstacle test
 * types remain no-op placeholders (that was true in the Android original too, not a gap this port
 * introduced).
 *
 * **Phase 9c pre-deletion review (2026-08-03):** diffed in full against the Android original before
 * its binding/impl were deleted. One real bug found and fixed: [GitLiveGTOSubmissionDelegate.observeSubmission]
 * had a `.catch { emit(null) }` swallowing Firestore listener errors into a fake "not found" state --
 * removed, matching the same fix already applied to 7 other repositories in Phases 9a/9b (every
 * caller -- `GDResultViewModel`/`LecturetteResultViewModel`/`GPEResultViewModel` -- already has its
 * own `.catch` expecting the real error). `GTOResultDto.toDomain()`'s in-range OLQ/overallScore
 * defaults (`GitLiveGTOSharedDtos.kt`) were re-verified as an intentional, safer divergence from the
 * Android original's out-of-range `0`/`0f` defaults (which violate `OLQScore`/`GTOResult`'s own
 * `init` invariants and throw for any partially-analyzed `gto_results` doc) -- not "fixed" to match,
 * regression-tested instead (`GTODtoTest`). Two risks reviewed and deliberately left as-is, both
 * pre-existing and self-documented above/nearby rather than introduced by this review: the
 * `updateProgress` non-atomicity (item 1 above), and `getRandomGPEScenario`/
 * `getObstaclesForTest`'s whole-batch-document decode (one malformed scenario/obstacle field could
 * fail the entire batch, vs. the Android original's per-field graceful defaults) -- the latter
 * couldn't be verified against real Firestore content without an emulator, so it's flagged rather
 * than "fixed" blind.
 */
class GitLiveGTORepository internal constructor(
    private val testContentRepository: TestContentRepository,
    private val taskCacheManager: GitLiveGTOTaskCacheManager,
    private val submissionDelegate: GitLiveGTOSubmissionDelegate,
    private val progressDelegate: GitLiveGTOProgressDelegate,
    private val resultsDelegate: GitLiveGTOResultsDelegate
) : GTORepository {

    // ==================== Test Content Management ====================

    override suspend fun getRandomTest(testType: GTOTestType): Result<GTOTest> = try {
        when (testType) {
            GTOTestType.GROUP_DISCUSSION -> {
                val topic = testContentRepository.getRandomGDTopic().getOrThrow()
                Result.success(GTOTest.GDTest(id = randomId(), topic = topic))
            }

            GTOTestType.GROUP_PLANNING_EXERCISE -> getRandomGPEScenario()

            GTOTestType.LECTURETTE -> {
                val topics = testContentRepository.getRandomLecturetteTopics(4).getOrThrow()
                Result.success(GTOTest.LecturetteTest(id = randomId(), topicChoices = topics))
            }

            else -> {
                val obstacles = getObstaclesForTest(testType).getOrThrow()
                Result.success(createGtoAnimationTest(testType, obstacles))
            }
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Same simplification as the Android original: always resolves a random Group Discussion
     * test rather than looking up [testId] specifically. Not a real lookup — not fixed here,
     * documented instead of silently "improved" beyond this slice's scope.
     */
    override suspend fun getTestById(testId: String): Result<GTOTest> =
        getRandomTest(GTOTestType.GROUP_DISCUSSION)

    override suspend fun getRandomGPEScenario(): Result<GTOTest.GPETest> = try {
        val path = "${SsbContracts.FirestorePaths.TEST_CONTENT}/$PATH_GTO/$PATH_SCENARIOS/gpe/$PATH_BATCHES/$DEFAULT_BATCH_ID"
        val doc = Firebase.firestore.document(path).get()
        val batch = if (doc.exists) {
            runCatching { doc.data(GPEScenarioBatchDto.serializer()) }.getOrDefault(GPEScenarioBatchDto())
        } else {
            GPEScenarioBatchDto()
        }

        val scenario = batch.scenarios.randomOrNull()
        if (scenario == null) {
            Result.failure(Exception("No GPE scenarios available"))
        } else {
            Result.success(
                GTOTest.GPETest(
                    id = scenario.id ?: randomId(),
                    imageUrl = scenario.imageUrl ?: "",
                    scenario = scenario.scenario ?: "",
                    solution = scenario.solution,
                    resources = scenario.resources ?: emptyList(),
                    difficulty = scenario.difficulty ?: "Medium"
                )
            )
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getObstaclesForTest(testType: GTOTestType): Result<List<ObstacleConfig>> = try {
        val testTypePath = obstacleTestTypePath(testType)
        if (testTypePath == null) {
            Result.failure(Exception("Test type does not have obstacles"))
        } else {
            val path = "${SsbContracts.FirestorePaths.TEST_CONTENT}/$PATH_GTO/$PATH_OBSTACLES/$testTypePath/obstacle_set_001"
            val doc = Firebase.firestore.document(path).get()
            val set = if (doc.exists) {
                runCatching { doc.data(ObstacleSetDto.serializer()) }.getOrDefault(ObstacleSetDto())
            } else {
                ObstacleSetDto()
            }

            Result.success(set.obstacles.map { it.toDomain() })
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    // ==================== Submission Management (delegated) ====================

    override suspend fun getSubmission(submissionId: String): Result<GTOSubmission> =
        submissionDelegate.getSubmission(submissionId)

    override fun observeSubmission(submissionId: String): Flow<GTOSubmission?> =
        submissionDelegate.observeSubmission(submissionId)

    override suspend fun updateSubmissionStatus(submissionId: String, status: GTOSubmissionStatus): Result<Unit> =
        submissionDelegate.updateSubmissionStatus(submissionId, status)

    override suspend fun updateSubmissionOLQScores(submissionId: String, olqScores: Map<OLQ, OLQScore>): Result<Unit> =
        submissionDelegate.updateSubmissionOLQScores(submissionId, olqScores)

    override suspend fun getUserSubmissions(userId: String, testType: GTOTestType?): Result<List<GTOSubmission>> =
        submissionDelegate.getUserSubmissions(userId, testType)

    override suspend fun getPendingSubmissions(limit: Int): Result<List<GTOSubmission>> =
        submissionDelegate.getPendingSubmissions(limit)

    // ==================== Progress Tracking (delegated) ====================

    override suspend fun getUserProgress(userId: String): Result<GTOProgress> =
        progressDelegate.getUserProgress(userId)

    override fun observeUserProgress(userId: String): Flow<GTOProgress?> =
        progressDelegate.observeUserProgress(userId)

    override suspend fun updateProgress(userId: String, completedTestType: GTOTestType): Result<Unit> =
        progressDelegate.updateProgress(userId, completedTestType)

    override suspend fun canUserTakeTest(userId: String, testType: GTOTestType): Result<Boolean> =
        progressDelegate.canUserTakeTest(userId, testType)

    override suspend fun getCompletedTests(userId: String): Result<List<GTOTestType>> =
        progressDelegate.getCompletedTests(userId)

    override suspend fun getNextAvailableTest(userId: String): Result<GTOTestType?> =
        progressDelegate.getNextAvailableTest(userId)

    // ==================== Results & Analysis (delegated) ====================

    override suspend fun getTestResult(submissionId: String): Result<GTOResult> =
        resultsDelegate.getTestResult(submissionId)

    override suspend fun getLatestResult(userId: String, testType: GTOTestType): Result<GTOResultStatus> =
        resultsDelegate.getLatestResult(userId, testType)

    override suspend fun getUserResults(userId: String, testType: GTOTestType?): Result<List<GTOResult>> =
        resultsDelegate.getUserResults(userId, testType)

    override suspend fun getAverageOLQScores(userId: String): Result<Map<OLQ, Float>> =
        resultsDelegate.getAverageOLQScores(userId)

    // ==================== Cache Management ====================
    // GD/LECTURETTE delegate to GitLiveGTOTaskCacheManager. GPE and the animation-obstacle test
    // types remain no-op / not-yet-implemented, same as the Android original (its own
    // GPEImageCacheManager and Phase-4-deferred obstacle-asset caching).

    override suspend fun cacheTestContent(testType: GTOTestType): Result<Unit> = try {
        when (testType) {
            GTOTestType.GROUP_DISCUSSION, GTOTestType.LECTURETTE -> taskCacheManager.initialSync()
            GTOTestType.GROUP_PLANNING_EXERCISE -> Result.success(Unit)
            else -> Result.success(Unit)
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun clearCache(testType: GTOTestType?): Result<Unit> = try {
        if (testType == null || testType == GTOTestType.GROUP_DISCUSSION || testType == GTOTestType.LECTURETTE) {
            taskCacheManager.clearCache()
        }
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun isContentCached(testType: GTOTestType): Result<Boolean> = try {
        val isCached = when (testType) {
            GTOTestType.GROUP_DISCUSSION, GTOTestType.LECTURETTE ->
                taskCacheManager.getCacheStatus().cachedTasks >= MIN_CACHED_TASKS_THRESHOLD
            GTOTestType.GROUP_PLANNING_EXERCISE -> true
            else -> false
        }
        Result.success(isCached)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private companion object {
        const val PATH_GTO = "gto"
        const val PATH_SCENARIOS = "scenarios"
        const val PATH_OBSTACLES = "obstacles"
        const val PATH_BATCHES = "batches"

        const val DEFAULT_BATCH_ID = "batch_001"

        /** Same threshold as the Android original's isContentCached (>= 5 cached tasks). */
        const val MIN_CACHED_TASKS_THRESHOLD = 5
    }
}

// obstacleTestTypePath, createGtoAnimationTest, ObstacleConfigDto/ObstacleSetDto/GPEScenarioDto/
// GPEScenarioBatchDto and their mappers moved to GitLiveGTOContentDtos.kt (300-line file split).
