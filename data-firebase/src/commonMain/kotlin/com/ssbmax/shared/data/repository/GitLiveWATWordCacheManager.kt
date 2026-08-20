package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.db.CachedWATWord as CachedWATWordRow
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.WATWord
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * SQLDelight-backed port of the Android `WATWordCacheManager` (Room-backed via
 * `WATWordCacheDao`). Ninth Phase 2 Room DAO+manager slice -- picked over
 * `GPEImageCacheDao`/`PPDTImageCacheDao`/`SRTSituationCacheDao`/
 * `TATImageCacheDao`/`InterviewQuestionCacheDao` because all six cache
 * managers are equally blocked as a *group* by `TestContentRepositoryImpl`
 * (which constructor-injects all six and can't be ported until every one of
 * them exists in `shared`), so no single choice among them unblocks that repo
 * on its own -- file/method count was the deciding factor instead, same
 * rationale the 8th slice used to pick `GTOTaskCacheDao` over the
 * larger/3-table `OIRQuestionCacheDao`.
 *
 * One real behavior difference from the Android original, documented rather
 * than silently dropped: `downloadBatch`'s Firestore read used a raw
 * `List<Map<String, Any?>>` decode (`doc.get("words") as? List<Map<String,
 * Any?>>`) on Android. GitLive Firestore 2.1.0 has no public path to decode a
 * raw map (`DocumentSnapshot.encodedData()`/`getEncoded()` are
 * `@PublishedApi internal` -- the same recurring blocker named in the 7th
 * slice's submission-cluster report and the 8th slice's GTO port), so this
 * port uses a typed `@Serializable` DTO ([WATWordBatchDocDto]) instead. This
 * is a stricter (not looser) contract than the Android original's per-field
 * `as?` casting, but it is the only path GitLive's Firestore module exposes.
 */
class GitLiveWATWordCacheManager(
    private val database: SharedDatabase
) {
    private val queries get() = database.sharedDatabaseQueries

    private companion object {
        const val TARGET_CACHE_SIZE = 60 // Full WAT test size
        const val MIN_CACHE_SIZE = 20 // Minimum before resyncing
        const val DEFAULT_BATCH_ID = "batch_001"
    }

    /**
     * Initialize cache with first batch. Called when app starts or cache is empty.
     */
    suspend fun initialSync(): Result<Unit> = try {
        val currentCount = queries.selectTotalWATWordCount().executeAsOne()
        if (currentCount >= TARGET_CACHE_SIZE) {
            Result.success(Unit)
        } else {
            downloadBatch(DEFAULT_BATCH_ID).getOrThrow()
            Result.success(Unit)
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Download a specific batch from Firestore.
     */
    suspend fun downloadBatch(batchId: String): Result<Unit> = try {
        val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.WAT_BATCHES}/$batchId").get()

        if (!doc.exists) {
            Result.failure(Exception("Batch $batchId not found in Firestore"))
        } else {
            val batch = doc.data(WATWordBatchDocDto.serializer())
            val now = Clock.System.now().toEpochMilliseconds()

            val words = batch.words.mapNotNull { wordDto ->
                val id = wordDto.id ?: return@mapNotNull null
                val word = wordDto.word ?: return@mapNotNull null
                CachedWATWordRow(
                    id = id,
                    word = word,
                    sequenceNumber = (wordDto.sequenceNumber ?: 0).toLong(),
                    timeAllowedSeconds = (wordDto.timeAllowedSeconds ?: 15).toLong(),
                    category = wordDto.category,
                    difficulty = wordDto.difficulty,
                    batchId = batchId,
                    cachedAt = now,
                    lastUsed = null,
                    usageCount = 0L
                )
            }

            if (words.isEmpty()) {
                Result.failure(Exception("No valid words parsed from batch $batchId"))
            } else {
                queries.transaction {
                    words.forEach { w ->
                        queries.insertOrReplaceWATWord(
                            id = w.id,
                            word = w.word,
                            sequenceNumber = w.sequenceNumber,
                            timeAllowedSeconds = w.timeAllowedSeconds,
                            category = w.category,
                            difficulty = w.difficulty,
                            batchId = w.batchId,
                            cachedAt = w.cachedAt,
                            lastUsed = w.lastUsed,
                            usageCount = w.usageCount
                        )
                    }
                    queries.insertOrReplaceWATBatchMetadata(
                        batchId = batchId,
                        downloadedAt = now,
                        wordCount = words.size.toLong(),
                        version = batch.version
                    )
                }
                Result.success(Unit)
            }
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Get words for a test (60 words, smart selection prioritizing least-used).
     */
    suspend fun getWordsForTest(count: Int = 60): Result<List<WATWord>> = try {
        val currentCount = queries.selectTotalWATWordCount().executeAsOne()
        if (currentCount < MIN_CACHE_SIZE) {
            initialSync().getOrThrow()
        }

        val cachedWords = queries.selectLeastUsedWATWords(count.toLong()).executeAsList()

        if (cachedWords.isEmpty()) {
            Result.failure(Exception("No words in cache"))
        } else {
            markWordsUsed(cachedWords.map { it.id })
            Result.success(cachedWords.map { it.toDomain() })
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Get cache status for diagnostics.
     */
    suspend fun getCacheStatus(): WATCacheStatus = try {
        val totalWords = queries.selectTotalWATWordCount().executeAsOne()
        val batches = queries.selectTotalWATBatchCount().executeAsOne()
        val lastSyncTime = queries.selectAllWATBatchMetadata().executeAsList().maxOfOrNull { it.downloadedAt }

        WATCacheStatus(
            cachedWords = totalWords.toInt(),
            batchesDownloaded = batches.toInt(),
            lastSyncTime = lastSyncTime,
            leadershipCount = queries.selectWATWordCountByCategory("leadership").executeAsOne().toInt(),
            moralValuesCount = queries.selectWATWordCountByCategory("moral_values").executeAsOne().toInt(),
            militaryVirtuesCount = queries.selectWATWordCountByCategory("military_virtues").executeAsOne().toInt(),
            personalityCount = queries.selectWATWordCountByCategory("personality").executeAsOne().toInt()
        )
    } catch (e: Exception) {
        WATCacheStatus()
    }

    /**
     * Clear all cache (for debugging/testing).
     */
    suspend fun clearCache() {
        queries.clearAllWATWords()
    }

    private fun markWordsUsed(wordIds: List<String>) {
        queries.markWATWordsUsed(timestamp = Clock.System.now().toEpochMilliseconds(), wordIds = wordIds)
    }
}

private fun CachedWATWordRow.toDomain(): WATWord = WATWord(
    id = id,
    word = word,
    sequenceNumber = sequenceNumber.toInt(),
    timeAllowedSeconds = timeAllowedSeconds.toInt()
)

/**
 * WAT cache status for diagnostics -- same shape as the Android original's
 * `WATCacheStatus`.
 */
data class WATCacheStatus(
    val cachedWords: Int = 0,
    val batchesDownloaded: Int = 0,
    val lastSyncTime: Long? = null,
    val leadershipCount: Int = 0,
    val moralValuesCount: Int = 0,
    val militaryVirtuesCount: Int = 0,
    val personalityCount: Int = 0
)

/** Firestore batch document shape for `test_content/wat/word_batches/{batchId}`. */
@Serializable
internal data class WATWordBatchDocDto(
    val words: List<WATWordFirestoreDto> = emptyList(),
    val version: String = "1.0.0"
)

@Serializable
internal data class WATWordFirestoreDto(
    val id: String? = null,
    val word: String? = null,
    val sequenceNumber: Int? = null,
    val timeAllowedSeconds: Int? = null,
    val category: String? = null,
    val difficulty: String? = null
)
