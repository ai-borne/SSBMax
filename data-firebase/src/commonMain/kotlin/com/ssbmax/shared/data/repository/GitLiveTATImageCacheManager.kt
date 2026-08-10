package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.db.CachedTATImage as CachedTATImageRow
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.GenderTag
import com.ssbmax.shared.domain.model.TATImageContext
import com.ssbmax.shared.domain.model.TATQuestion
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * SQLDelight-backed port of the Android `TATImageCacheManager` (Room-backed via
 * `TATImageCacheDao`). Thirteenth Phase 2 Room DAO+manager slice.
 *
 * Manages the 167-image TAT pool. All images live in one Firestore document
 * (batch_001); [getImagesForTest] assembles 11 cards by card position (1-11),
 * one per position, picking the least-used image matching the user's gender
 * (or MIXED). Card 12 is the programmatic blank card, never stored.
 *
 * Same documented Firestore-decode deviation as the 8th-12th slices: a typed
 * `@Serializable` DTO ([TATImageBatchDocDto]) replaces Android's raw
 * `List<Map<String, Any?>>` cast. `imageContext` round-trips through the
 * (now `@Serializable`) [TATImageContext] domain type rather than Android's
 * raw-JSON passthrough -- a stricter, not looser, contract.
 */
class GitLiveTATImageCacheManager(
    private val database: SharedDatabase
) {
    private val queries get() = database.sharedDatabaseQueries
    private val json = Json { ignoreUnknownKeys = true }

    private companion object {
        const val TARGET_CACHE_SIZE = 167
        const val MINIMUM_CACHE_SIZE = 33
        const val DEFAULT_BATCH_ID = "batch_001"
        const val STALENESS_TTL_HOURS = 24
    }

    // < 33 images -> download all 167 immediately; >= 33 -> 24h TTL staleness gate.
    suspend fun initialSync(): Result<Unit> = try {
        val currentCount = queries.selectTotalTATImageCount().executeAsOne()
        val needsResync = when {
            currentCount >= TARGET_CACHE_SIZE -> {
                if (isCacheStale(DEFAULT_BATCH_ID)) {
                    queries.clearAllTATImages()
                    true
                } else {
                    false
                }
            }
            currentCount >= MINIMUM_CACHE_SIZE -> {
                if (isCacheStale(DEFAULT_BATCH_ID)) {
                    queries.clearAllTATImages()
                    true
                } else {
                    false
                }
            }
            else -> true
        }
        if (needsResync) downloadBatch(DEFAULT_BATCH_ID).getOrThrow()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private suspend fun isCacheStale(batchId: String): Boolean = try {
        val localMeta = queries.selectTATBatchMetadata(batchId).executeAsOneOrNull()
        if (localMeta == null) {
            true
        } else {
            val now = Clock.System.now().toEpochMilliseconds()
            val hoursSinceCheck = (now - localMeta.lastStalenessCheckAt) / 3_600_000
            if (hoursSinceCheck < STALENESS_TTL_HOURS) {
                false
            } else {
                val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.TAT_BATCHES}/$batchId").get()
                val remoteVersion = doc.get<String?>("version")
                if (remoteVersion == null) {
                    false
                } else {
                    val isStale = remoteVersion != localMeta.version
                    queries.insertOrReplaceTATBatchMetadata(
                        batchId = localMeta.batchId,
                        downloadedAt = localMeta.downloadedAt,
                        imageCount = localMeta.imageCount,
                        version = localMeta.version,
                        lastStalenessCheckAt = now
                    )
                    isStale
                }
            }
        }
    } catch (e: Exception) {
        false
    }

    suspend fun downloadBatch(batchId: String): Result<Unit> = try {
        val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.TAT_BATCHES}/$batchId").get()

        if (!doc.exists) {
            Result.failure(Exception("Batch $batchId not found in Firestore"))
        } else {
            val batch = doc.data(TATImageBatchDocDto.serializer())
            val now = Clock.System.now().toEpochMilliseconds()

            val images = batch.images.mapNotNull { dto ->
                val id = dto.id ?: return@mapNotNull null
                val imageUrl = dto.imageUrl ?: return@mapNotNull null
                val cardPosition = dto.cardPosition ?: return@mapNotNull null
                val genderTag = GenderTag.entries.firstOrNull { it.name == dto.genderTag?.uppercase() }
                    ?: GenderTag.MIXED
                val contextJson = dto.imageContext?.let {
                    runCatching { json.encodeToString(TATImageContext.serializer(), it) }.getOrNull()
                } ?: "{}"
                CachedTATImageRow(
                    id = id,
                    imageUrl = imageUrl,
                    cardPosition = cardPosition.toLong(),
                    genderTag = genderTag.name,
                    imageContextJson = contextJson,
                    viewingTimeSeconds = (dto.viewingTimeSeconds ?: 30).toLong(),
                    writingTimeMinutes = (dto.writingTimeMinutes ?: 4).toLong(),
                    minCharacters = (dto.minCharacters ?: 150).toLong(),
                    maxCharacters = (dto.maxCharacters ?: 1500).toLong(),
                    category = dto.category,
                    difficulty = dto.difficulty,
                    batchId = batchId,
                    cachedAt = now,
                    lastUsed = null,
                    usageCount = 0L
                )
            }

            if (images.isEmpty()) {
                Result.failure(Exception("No valid images parsed from batch $batchId"))
            } else {
                queries.transaction {
                    images.forEach { image ->
                        queries.insertOrReplaceTATImage(
                            id = image.id,
                            imageUrl = image.imageUrl,
                            cardPosition = image.cardPosition,
                            genderTag = image.genderTag,
                            imageContextJson = image.imageContextJson,
                            viewingTimeSeconds = image.viewingTimeSeconds,
                            writingTimeMinutes = image.writingTimeMinutes,
                            minCharacters = image.minCharacters,
                            maxCharacters = image.maxCharacters,
                            category = image.category,
                            difficulty = image.difficulty,
                            batchId = image.batchId,
                            cachedAt = image.cachedAt,
                            lastUsed = image.lastUsed,
                            usageCount = image.usageCount
                        )
                    }
                    queries.insertOrReplaceTATBatchMetadata(
                        batchId = batchId,
                        downloadedAt = now,
                        imageCount = images.size.toLong(),
                        version = batch.version,
                        lastStalenessCheckAt = now
                    )
                }
                Result.success(Unit)
            }
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Assembles 12 TATQuestions: positions 1-11 from pool (least-used, gender-matched), position 12 = blank card. */
    suspend fun getImagesForTest(genderTag: GenderTag? = null): Result<List<TATQuestion>> = try {
        val currentCount = queries.selectTotalTATImageCount().executeAsOne()
        if (currentCount < MINIMUM_CACHE_SIZE) {
            initialSync().getOrThrow()
        }

        val resolvedTag = genderTag?.name ?: GenderTag.MIXED.name
        val selected = mutableListOf<TATQuestion>()
        val usedIds = mutableListOf<String>()

        for (position in 1..11) {
            val entity = queries.selectLeastUsedTATImageByPosition(position.toLong(), resolvedTag).executeAsOneOrNull()
                ?: queries.selectLeastUsedTATImageByPosition(position.toLong(), GenderTag.MIXED.name).executeAsOneOrNull()
                ?: throw NoSuchElementException("No image available for cardPosition=$position (genderTag=$resolvedTag)")

            usedIds += entity.id
            selected += entity.toDomain()
        }

        selected += blankCard()

        queries.markTATImagesUsed(timestamp = Clock.System.now().toEpochMilliseconds(), imageIds = usedIds)
        Result.success(selected)
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getCacheStatus(): TATCacheStatus = try {
        val totalImages = queries.selectTotalTATImageCount().executeAsOne()
        val batches = queries.selectTotalTATBatchCount().executeAsOne()
        val lastSyncTime = queries.selectAllTATBatchMetadata().executeAsList().maxOfOrNull { it.downloadedAt }
        TATCacheStatus(cachedImages = totalImages.toInt(), batchesDownloaded = batches.toInt(), lastSyncTime = lastSyncTime)
    } catch (e: Exception) {
        TATCacheStatus()
    }

    suspend fun clearCache() {
        queries.clearAllTATImages()
    }
}

private fun CachedTATImageRow.toDomain(): TATQuestion = TATQuestion(
    id = id,
    imageUrl = normalizeUrl(imageUrl),
    cardPosition = cardPosition.toInt(),
    imageContextJson = imageContextJson,
    genderTag = genderTag,
    viewingTimeSeconds = viewingTimeSeconds.toInt(),
    writingTimeMinutes = writingTimeMinutes.toInt(),
    minCharacters = minCharacters.toInt(),
    maxCharacters = maxCharacters.toInt()
)

private fun blankCard(): TATQuestion = TATQuestion(
    id = "blank_card",
    imageUrl = "",
    cardPosition = 12,
    imageContextJson = "{}",
    viewingTimeSeconds = 30,
    writingTimeMinutes = 4,
    minCharacters = 150,
    maxCharacters = 1500
)

private fun normalizeUrl(raw: String): String =
    if (raw.startsWith("gs://")) raw.replaceFirst("gs://", "https://storage.googleapis.com/") else raw

data class TATCacheStatus(
    val cachedImages: Int = 0,
    val batchesDownloaded: Int = 0,
    val lastSyncTime: Long? = null
)

@Serializable
internal data class TATImageBatchDocDto(
    val images: List<TATImageFirestoreDto> = emptyList(),
    val version: String = "1.0.0"
)

@Serializable
internal data class TATImageFirestoreDto(
    val id: String? = null,
    val imageUrl: String? = null,
    val cardPosition: Int? = null,
    val genderTag: String? = null,
    val imageContext: TATImageContext? = null,
    val viewingTimeSeconds: Int? = null,
    val writingTimeMinutes: Int? = null,
    val minCharacters: Int? = null,
    val maxCharacters: Int? = null,
    val category: String? = null,
    val difficulty: String? = null
)
