package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.db.CachedGPEImage as CachedGPEImageRow
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.GPEQuestion
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/**
 * SQLDelight-backed port of the Android `GPEImageCacheManager` (Room-backed via
 * `GPEImageCacheDao`). Tenth Phase 2 Room DAO+manager slice.
 *
 * One real behavior difference from the Android original, documented rather
 * than silently dropped: `downloadBatch`'s Firestore read used a raw
 * `List<Map<String, Any?>>` decode on Android. GitLive Firestore 2.1.0 has no
 * public path to decode a raw map, so this port uses a typed `@Serializable`
 * DTO ([GPEImageBatchDocDto]) instead -- the same recurring blocker named in
 * the 7th/8th/9th slices' reports.
 *
 * A second documented deviation: `localFilePath`/`imageDownloaded` were
 * dropped from the schema entirely. `markImageAsDownloaded` -- the only
 * writer of either field -- has zero production callers even on the Android
 * side (grep confirms only its own DAO test exercises it), so
 * `getDownloadedImageCount` always returns 0 in production already; this
 * port keeps that real behavior by returning a literal 0 instead of carrying
 * a column that can never be anything else.
 */
class GitLiveGPEImageCacheManager(
    private val database: SharedDatabase
) {
    private val queries get() = database.sharedDatabaseQueries

    private companion object {
        const val TARGET_CACHE_SIZE = 15
        const val MIN_CACHE_SIZE = 5
        const val DEFAULT_BATCH_ID = "batch_001"
    }

    suspend fun initialSync(): Result<Unit> = try {
        val currentCount = queries.selectTotalGPEImageCount().executeAsOne()
        if (currentCount >= TARGET_CACHE_SIZE) {
            Result.success(Unit)
        } else {
            downloadBatch(DEFAULT_BATCH_ID).getOrThrow()
            Result.success(Unit)
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun downloadBatch(batchId: String): Result<Unit> = try {
        val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.GPE_BATCHES}/$batchId").get()

        if (!doc.exists) {
            Result.failure(Exception("Batch $batchId not found in Firestore"))
        } else {
            val batch = doc.data(GPEImageBatchDocDto.serializer())
            val now = Clock.System.now().toEpochMilliseconds()

            val images = batch.images.mapNotNull { imgDto ->
                val id = imgDto.id ?: return@mapNotNull null
                val imageUrl = imgDto.imageUrl ?: return@mapNotNull null
                CachedGPEImageRow(
                    id = id,
                    imageUrl = imageUrl,
                    scenario = imgDto.scenario
                        ?: "Tactical scenario requiring planning and resource allocation",
                    solution = imgDto.solution,
                    imageDescription = imgDto.imageDescription
                        ?: "Tactical scenario image showing obstacles and constraints",
                    resources = imgDto.resources?.let { Json.encodeToString(StringListSerializer, it) },
                    viewingTimeSeconds = (imgDto.viewingTimeSeconds ?: 60).toLong(),
                    planningTimeSeconds = (imgDto.planningTimeSeconds ?: 1740).toLong(),
                    minCharacters = (imgDto.minCharacters ?: 500).toLong(),
                    maxCharacters = (imgDto.maxCharacters ?: 2000).toLong(),
                    category = imgDto.category,
                    difficulty = imgDto.difficulty,
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
                        queries.insertOrReplaceGPEImage(
                            id = image.id,
                            imageUrl = image.imageUrl,
                            scenario = image.scenario,
                            solution = image.solution,
                            imageDescription = image.imageDescription,
                            resources = image.resources,
                            viewingTimeSeconds = image.viewingTimeSeconds,
                            planningTimeSeconds = image.planningTimeSeconds,
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
                    queries.insertOrReplaceGPEBatchMetadata(
                        batchId = batchId,
                        downloadedAt = now,
                        imageCount = images.size.toLong(),
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
     * Get a single image for GPE test. Mirrors the Android original's stale-cache
     * self-heal: if the least-used image has no `solution` (pre-solution cache),
     * clear and re-sync once before serving.
     */
    suspend fun getImageForTest(): Result<GPEQuestion> = try {
        val currentCount = queries.selectTotalGPEImageCount().executeAsOne()
        if (currentCount < MIN_CACHE_SIZE) {
            initialSync().getOrThrow()
        }

        var image = queries.selectLeastUsedGPEImages(1).executeAsList().firstOrNull()
            ?: throw NoSuchElementException("No images in cache")

        if (image.solution == null) {
            try {
                queries.clearAllGPEImages()
                queries.deleteGPEBatchMetadata(DEFAULT_BATCH_ID)
                initialSync().getOrThrow()
                queries.selectLeastUsedGPEImages(1).executeAsList().firstOrNull()?.let { image = it }
            } catch (_: Exception) {
                // Refresh failed -- continue serving the stale image rather than fail the test.
            }
        }

        queries.markGPEImagesUsed(timestamp = Clock.System.now().toEpochMilliseconds(), imageIds = listOf(image.id))
        Result.success(image.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getCacheStatus(): GPECacheStatus = try {
        val totalImages = queries.selectTotalGPEImageCount().executeAsOne()
        val batches = queries.selectTotalGPEBatchCount().executeAsOne()
        val lastSyncTime = queries.selectAllGPEBatchMetadata().executeAsList().maxOfOrNull { it.downloadedAt }

        GPECacheStatus(
            cachedImages = totalImages.toInt(),
            downloadedImages = 0, // markImageAsDownloaded is dead in production -- see class doc.
            batchesDownloaded = batches.toInt(),
            lastSyncTime = lastSyncTime
        )
    } catch (e: Exception) {
        GPECacheStatus()
    }

    suspend fun clearCache() {
        queries.clearAllGPEImages()
    }
}

private fun CachedGPEImageRow.toDomain(): GPEQuestion {
    val resourceList = resources?.let {
        runCatching { Json.decodeFromString(StringListSerializer, it) }.getOrDefault(emptyList())
    } ?: emptyList()
    return GPEQuestion(
        id = id,
        imageUrl = imageUrl,
        scenario = scenario,
        solution = solution,
        imageDescription = imageDescription,
        resources = resourceList,
        viewingTimeSeconds = viewingTimeSeconds.toInt(),
        planningTimeSeconds = planningTimeSeconds.toInt(),
        minCharacters = minCharacters.toInt(),
        maxCharacters = maxCharacters.toInt(),
        category = category,
        difficulty = difficulty
    )
}

private val StringListSerializer = ListSerializer(String.serializer())

data class GPECacheStatus(
    val cachedImages: Int = 0,
    val downloadedImages: Int = 0,
    val batchesDownloaded: Int = 0,
    val lastSyncTime: Long? = null
)

@Serializable
internal data class GPEImageBatchDocDto(
    val images: List<GPEImageFirestoreDto> = emptyList(),
    val version: String = "1.0.0"
)

@Serializable
internal data class GPEImageFirestoreDto(
    val id: String? = null,
    val imageUrl: String? = null,
    val scenario: String? = null,
    val solution: String? = null,
    val imageDescription: String? = null,
    val resources: List<String>? = null,
    val viewingTimeSeconds: Int? = null,
    val planningTimeSeconds: Int? = null,
    val minCharacters: Int? = null,
    val maxCharacters: Int? = null,
    val category: String? = null,
    val difficulty: String? = null
)
