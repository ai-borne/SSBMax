package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.db.CachedPPDTImage as CachedPPDTImageRow
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.GenderTag
import com.ssbmax.shared.domain.model.PPDTImageContext
import com.ssbmax.shared.domain.model.PPDTQuestion
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * SQLDelight-backed port of the Android `PPDTImageCacheManager` (Room-backed via
 * `PPDTImageCacheDao`). Eleventh Phase 2 Room DAO+manager slice.
 *
 * Same documented Firestore-decode deviation as the 8th-10th slices: a typed
 * `@Serializable` DTO ([PPDTImageBatchDocDto]) replaces Android's raw
 * `List<Map<String, Any?>>` cast, because GitLive Firestore 2.1.0 has no
 * public path to decode a raw map.
 *
 * `imageContext` is stored as a JSON string ([PPDTImageContext] serialized),
 * same representation the Android entity uses (`imageContextJson`) --
 * decoded back to [PPDTImageContext] on read, degrading to the all-defaults
 * instance on parse failure exactly like the Android original's Gson-based
 * fallback.
 *
 * `localFilePath`/`imageDownloaded` dropped from the schema for the same
 * reason as the 10th slice's GPE port: `markImageAsDownloaded` has zero
 * production callers even on Android, so `getDownloadedImageCount` is a
 * literal 0 here rather than a query over a column that can never be
 * anything else.
 */
class GitLivePPDTImageCacheManager(
    private val database: SharedDatabase
) {
    private val queries get() = database.sharedDatabaseQueries
    private val json = Json { ignoreUnknownKeys = true }

    private companion object {
        const val TARGET_CACHE_SIZE = 15
        const val MIN_CACHE_SIZE = 5
        const val DEFAULT_BATCH_ID = "batch_001"
        const val STALENESS_TTL_HOURS = 24
    }

    suspend fun initialSync(): Result<Unit> = try {
        val currentCount = queries.selectTotalPPDTImageCount().executeAsOne()
        if (currentCount >= TARGET_CACHE_SIZE) {
            if (!isCacheStale(DEFAULT_BATCH_ID)) {
                Result.success(Unit)
            } else {
                queries.clearAllPPDTImages()
                downloadBatch(DEFAULT_BATCH_ID).getOrThrow()
                Result.success(Unit)
            }
        } else {
            downloadBatch(DEFAULT_BATCH_ID).getOrThrow()
            Result.success(Unit)
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Returns true if the local batch is outdated vs Firestore, gated by a 24h TTL. */
    private suspend fun isCacheStale(batchId: String): Boolean = try {
        val localMeta = queries.selectPPDTBatchMetadata(batchId).executeAsOneOrNull()
        if (localMeta == null) {
            true
        } else {
            val now = Clock.System.now().toEpochMilliseconds()
            val hoursSinceCheck = (now - localMeta.lastStalenessCheckAt) / 3_600_000
            if (hoursSinceCheck < STALENESS_TTL_HOURS) {
                false
            } else {
                val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.PPDT_BATCHES}/$batchId").get()
                val remoteVersion = doc.get<String?>("version")
                if (remoteVersion == null) {
                    false
                } else {
                    val isStale = remoteVersion != localMeta.version
                    queries.insertOrReplacePPDTBatchMetadata(
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
        false // On network error, serve stale rather than break.
    }

    suspend fun downloadBatch(batchId: String): Result<Unit> = try {
        val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.PPDT_BATCHES}/$batchId").get()

        if (!doc.exists) {
            Result.failure(Exception("Batch $batchId not found in Firestore"))
        } else {
            val batch = doc.data(PPDTImageBatchDocDto.serializer())
            val now = Clock.System.now().toEpochMilliseconds()

            val images = batch.images.mapNotNull { imgDto ->
                val id = imgDto.id ?: return@mapNotNull null
                val imageUrl = imgDto.imageUrl ?: return@mapNotNull null
                val contextJson = imgDto.imageContext?.let {
                    runCatching { json.encodeToString(PPDTImageContext.serializer(), it) }.getOrNull()
                } ?: "{}"
                val genderTag = GenderTag.entries.firstOrNull { it.name == imgDto.genderTag?.uppercase() }
                    ?: GenderTag.MIXED
                CachedPPDTImageRow(
                    id = id,
                    imageUrl = imageUrl,
                    imageDescription = imgDto.imageDescription ?: "Picture showing an ambiguous scene",
                    imageContextJson = contextJson,
                    viewingTimeSeconds = (imgDto.viewingTimeSeconds ?: 30).toLong(),
                    writingTimeMinutes = (imgDto.writingTimeMinutes ?: 4).toLong(),
                    minCharacters = (imgDto.minCharacters ?: 200).toLong(),
                    maxCharacters = (imgDto.maxCharacters ?: 1000).toLong(),
                    category = imgDto.category,
                    difficulty = imgDto.difficulty,
                    batchId = batchId,
                    cachedAt = now,
                    lastUsed = null,
                    usageCount = 0L,
                    genderTag = genderTag.name
                )
            }

            if (images.isEmpty()) {
                Result.failure(Exception("No valid images parsed from batch $batchId"))
            } else {
                queries.transaction {
                    images.forEach { image ->
                        queries.insertOrReplacePPDTImage(
                            id = image.id,
                            imageUrl = image.imageUrl,
                            imageDescription = image.imageDescription,
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
                            usageCount = image.usageCount,
                            genderTag = image.genderTag
                        )
                    }
                    queries.insertOrReplacePPDTBatchMetadata(
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

    /** Get a single image, optionally filtered by gender (falls back to MIXED at the SQL level). */
    suspend fun getImageForTest(genderTag: GenderTag? = null): Result<PPDTQuestion> = try {
        val currentCount = queries.selectTotalPPDTImageCount().executeAsOne()
        if (currentCount < MIN_CACHE_SIZE) {
            initialSync().getOrThrow()
        }

        val image = if (genderTag != null) {
            queries.selectLeastUsedPPDTImagesByGender(genderTag.name, 1).executeAsList().firstOrNull()
        } else {
            queries.selectLeastUsedPPDTImages(1).executeAsList().firstOrNull()
        } ?: throw NoSuchElementException("No images available for genderTag=$genderTag")

        queries.markPPDTImagesUsed(timestamp = Clock.System.now().toEpochMilliseconds(), imageIds = listOf(image.id))
        Result.success(image.toDomain(json))
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getImageById(imageId: String): Result<PPDTQuestion> = try {
        val entity = queries.selectPPDTImageById(imageId).executeAsOneOrNull()
            ?: return Result.failure(Exception("Image not found in cache: $imageId"))
        Result.success(entity.toDomain(json))
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getCacheStatus(): PPDTCacheStatus = try {
        val totalImages = queries.selectTotalPPDTImageCount().executeAsOne()
        val batches = queries.selectTotalPPDTBatchCount().executeAsOne()
        val lastSyncTime = queries.selectAllPPDTBatchMetadata().executeAsList().maxOfOrNull { it.downloadedAt }
        PPDTCacheStatus(
            cachedImages = totalImages.toInt(),
            downloadedImages = 0, // markImageAsDownloaded is dead in production -- see class doc.
            batchesDownloaded = batches.toInt(),
            lastSyncTime = lastSyncTime
        )
    } catch (e: Exception) {
        PPDTCacheStatus()
    }

    suspend fun clearCache() {
        queries.clearAllPPDTImages()
    }
}

private fun CachedPPDTImageRow.toDomain(json: Json): PPDTQuestion {
    val context = runCatching { json.decodeFromString(PPDTImageContext.serializer(), imageContextJson) }
        .getOrDefault(PPDTImageContext())
    return PPDTQuestion(
        id = id,
        imageUrl = normalizeUrl(imageUrl),
        imageDescription = imageDescription,
        imageContext = context,
        viewingTimeSeconds = viewingTimeSeconds.toInt(),
        writingTimeMinutes = writingTimeMinutes.toInt(),
        minCharacters = minCharacters.toInt(),
        maxCharacters = maxCharacters.toInt()
    )
}

private fun normalizeUrl(raw: String): String =
    if (raw.startsWith("gs://")) raw.replaceFirst("gs://", "https://storage.googleapis.com/") else raw

data class PPDTCacheStatus(
    val cachedImages: Int = 0,
    val downloadedImages: Int = 0,
    val batchesDownloaded: Int = 0,
    val lastSyncTime: Long? = null
)

@Serializable
internal data class PPDTImageBatchDocDto(
    val images: List<PPDTImageFirestoreDto> = emptyList(),
    val version: String = "1.0.0"
)

@Serializable
internal data class PPDTImageFirestoreDto(
    val id: String? = null,
    val imageUrl: String? = null,
    val imageDescription: String? = null,
    val imageContext: PPDTImageContext? = null,
    val viewingTimeSeconds: Int? = null,
    val writingTimeMinutes: Int? = null,
    val minCharacters: Int? = null,
    val maxCharacters: Int? = null,
    val category: String? = null,
    val difficulty: String? = null,
    val genderTag: String? = null
)
