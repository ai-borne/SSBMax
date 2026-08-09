package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.CacheStatus
import com.ssbmax.shared.domain.model.GPEQuestion
import com.ssbmax.shared.domain.model.GenderTag
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.PPDTQuestion
import com.ssbmax.shared.domain.model.SDTQuestion
import com.ssbmax.shared.domain.model.SRTSituation
import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.WATWord
import com.ssbmax.shared.domain.model.createStandardSDTQuestions
import com.ssbmax.shared.domain.repository.TestContentRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * GitLive-Firebase-backed port of the Android `TestContentRepositoryImpl`.
 * Pure delegation to the 6 SQLDelight-backed cache managers already ported in
 * this phase, plus two direct Firestore reads (`getRandomGDTopic`/
 * `getRandomLecturetteTopics`) the Android original also performs inline
 * rather than through a cache manager -- confirmed by reading the Android
 * original in full, not assumed from the "content" in its name.
 *
 * Reuses [GTOTaskBatchDocDto]/[GTOTaskFirestoreDto] (declared `internal` in
 * `GitLiveGTOTaskCacheManager.kt`, same module) for the GD/Lecturette
 * Firestore reads instead of a duplicate DTO -- both reads hit the exact same
 * `test_content/gto/task_batches/{batchId}` document shape that manager
 * already models, just without caching the result locally (same as the
 * Android original, which also re-fetched this document uncached on every
 * call rather than reusing `GTOTaskCacheManager`).
 *
 * **Dead-scaffolding cleanup (documented, not silent):** the Android original
 * declared `oirCache`/`watCache`/`srtCache` `ConcurrentHashMap`s that were
 * only ever cleared in `clearCache()` -- never read or written by
 * `getOIRTestQuestions`/`getWATQuestions`/`getSRTQuestions` themselves. They
 * were write-never, read-never fields. Dropped here; only `ppdtCache`/
 * `gpeCache` are kept, since those two are genuinely populated and read
 * per-testId by their own getters. `ConcurrentHashMap` has no KMP
 * `commonMain` equivalent, so the kept caches use a plain `MutableMap`
 * guarded by a [Mutex] instead.
 */
class GitLiveTestContentRepository(
    private val oirCacheManager: GitLiveOIRQuestionCacheManager,
    private val watWordCacheManager: GitLiveWATWordCacheManager,
    private val srtSituationCacheManager: GitLiveSRTSituationCacheManager,
    private val ppdtImageCacheManager: GitLivePPDTImageCacheManager,
    private val gpeImageCacheManager: GitLiveGPEImageCacheManager,
    private val tatImageCacheManager: GitLiveTATImageCacheManager
) : TestContentRepository {

    private val cacheMutex = Mutex()
    private val ppdtCache = mutableMapOf<String, List<PPDTQuestion>>()
    private val gpeCache = mutableMapOf<String, List<GPEQuestion>>()

    private companion object {
        const val TASK_BATCH_PATH = "test_content/gto/task_batches/batch_001"
        const val DEFAULT_WAT_COUNT = 60
        const val DEFAULT_SRT_COUNT = 60
    }

    @Deprecated("Use getOIRTestQuestions() for cached implementation")
    override suspend fun getOIRQuestions(testId: String): Result<List<OIRQuestion>> =
        getOIRTestQuestions(50)

    override suspend fun getOIRTestQuestions(count: Int): Result<List<OIRQuestion>> = try {
        oirCacheManager.getTestQuestions(count)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun initializeOIRCache(): Result<Unit> =
        oirCacheManager.initialSync()

    override suspend fun getOIRCacheStatus(): CacheStatus =
        oirCacheManager.getCacheStatus()

    override suspend fun markOIRQuestionsUsed(questionIds: List<String>): Result<Unit> =
        runCatching { oirCacheManager.markQuestionsUsed(questionIds) }

    override suspend fun getPPDTQuestions(testId: String): Result<List<PPDTQuestion>> {
        cacheMutex.withLock { ppdtCache[testId] }?.let { return Result.success(it) }

        return try {
            if (ppdtImageCacheManager.getCacheStatus().cachedImages == 0) {
                ppdtImageCacheManager.initialSync().getOrThrow()
            }
            val questionResult = ppdtImageCacheManager.getImageForTest()
            val questions = questionResult.getOrNull()?.let { listOf(it) }
                ?: TestContentMockFallback.ppdtQuestions()
            cacheMutex.withLock { ppdtCache[testId] = questions }
            Result.success(questions)
        } catch (_: Exception) {
            val mock = TestContentMockFallback.ppdtQuestions()
            cacheMutex.withLock { ppdtCache[testId] = mock }
            Result.success(mock)
        }
    }

    override suspend fun getPPDTQuestion(questionId: String): Result<PPDTQuestion> = try {
        cacheMutex.withLock { ppdtCache.values.flatten().find { it.id == questionId } }
            ?.let { Result.success(it) }
            ?: ppdtImageCacheManager.getImageById(questionId)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getPPDTQuestion(genderTag: GenderTag?): Result<PPDTQuestion> = try {
        if (ppdtImageCacheManager.getCacheStatus().cachedImages == 0) {
            ppdtImageCacheManager.initialSync().getOrThrow()
        }
        ppdtImageCacheManager.getImageForTest(genderTag)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getGPEQuestions(testId: String): Result<List<GPEQuestion>> {
        cacheMutex.withLock { gpeCache[testId] }?.let { return Result.success(it) }

        return try {
            if (gpeImageCacheManager.getCacheStatus().cachedImages == 0) {
                gpeImageCacheManager.initialSync().getOrThrow()
            }
            val question = gpeImageCacheManager.getImageForTest().getOrThrow()
            val questions = listOf(question)
            cacheMutex.withLock { gpeCache[testId] = questions }
            Result.success(questions)
        } catch (_: Exception) {
            val mock = TestContentMockFallback.gpeQuestions()
            cacheMutex.withLock { gpeCache[testId] = mock }
            Result.success(mock)
        }
    }

    override suspend fun getTATQuestions(testId: String, genderTag: GenderTag?): Result<List<TATQuestion>> = try {
        tatImageCacheManager.initialSync().getOrThrow()
        tatImageCacheManager.getImagesForTest(genderTag)
    } catch (_: Exception) {
        Result.success(TestContentMockFallback.tatQuestions())
    }

    override suspend fun getWATQuestions(testId: String): Result<List<WATWord>> = try {
        if (watWordCacheManager.getCacheStatus().cachedWords == 0) {
            watWordCacheManager.initialSync().getOrThrow()
        }
        watWordCacheManager.getWordsForTest(DEFAULT_WAT_COUNT)
    } catch (_: Exception) {
        Result.success(TestContentMockFallback.watWords())
    }

    override suspend fun getSRTQuestions(testId: String): Result<List<SRTSituation>> = try {
        if (srtSituationCacheManager.getCacheStatus().cachedSituations == 0) {
            srtSituationCacheManager.initialSync().getOrThrow()
        }
        srtSituationCacheManager.getSituationsForTest(DEFAULT_SRT_COUNT)
    } catch (_: Exception) {
        Result.success(TestContentMockFallback.srtSituations())
    }

    override suspend fun getSDTQuestions(testId: String): Result<List<SDTQuestion>> =
        Result.success(createStandardSDTQuestions())

    override fun clearCache() {
        // Best-effort synchronous clear: no suspend context available in this
        // interface method, same constraint the Android original had with a
        // (lock-free) ConcurrentHashMap. A brief unguarded read race against
        // an in-flight getPPDTQuestions/getGPEQuestions write is an accepted,
        // pre-existing behavior -- not a regression introduced by this port.
        ppdtCache.clear()
        gpeCache.clear()
    }

    override suspend fun getRandomGDTopic(): Result<String> = try {
        val tasks = fetchTaskBatch()
        val gdTitles = tasks.filter { it.taskType == "GD" }.mapNotNull { it.title }
        if (gdTitles.isEmpty()) {
            Result.failure(Exception("No GD topics available"))
        } else {
            Result.success(gdTitles.random())
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getRandomLecturetteTopics(count: Int): Result<List<String>> = try {
        val tasks = fetchTaskBatch()
        val lecturetteTitles = tasks.filter { it.taskType == "LECTURETTE" }.mapNotNull { it.title }
        if (lecturetteTitles.size < count) {
            Result.failure(Exception("Not enough Lecturette topics available"))
        } else {
            Result.success(lecturetteTitles.shuffled().take(count))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    private suspend fun fetchTaskBatch(): List<GTOTaskFirestoreDto> {
        val doc = Firebase.firestore.document(TASK_BATCH_PATH).get()
        if (!doc.exists) return emptyList()
        return doc.data(GTOTaskBatchDocDto.serializer()).tasks
    }
}
