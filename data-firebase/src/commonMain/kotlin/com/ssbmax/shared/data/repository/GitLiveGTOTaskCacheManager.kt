package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.db.CachedGTOTask as CachedGTOTaskRow
import com.ssbmax.shared.db.SharedDatabase
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * SQLDelight-backed port of the Android `GTOTaskCacheManager` (Room-backed via
 * `GTOTaskCacheDao`). Closes the named gap left by the 5th slice's
 * `GitLiveGTORepository` port: [cacheTestContent]/[clearCache]/[isContentCached]
 * for GD/LECTURETTE previously returned honest "not cached" defaults because
 * this table didn't exist in KMP yet.
 *
 * One real behavior difference from the Android original, documented rather
 * than silently dropped: `downloadBatch`'s Firestore read used a raw
 * `List<Map<String, Any?>>` decode (`doc.get("tasks") as? List<Map<String, Any?>>`)
 * on Android. GitLive Firestore 2.1.0 has no public path to decode a raw map
 * (`DocumentSnapshot.encodedData()`/`getEncoded()` are `@PublishedApi internal`
 * -- the same blocker the 7th slice's submission-cluster report named for
 * `CommonSubmissionRepository`'s generic-Map reads), so this port uses a typed
 * `@Serializable` DTO ([GTOTaskBatchDocDto]) instead. This is a stricter (not
 * looser) contract than the Android original's per-field `as?` casting, but it
 * is the only path GitLive's Firestore module exposes.
 */
class GitLiveGTOTaskCacheManager(
    private val database: SharedDatabase
) {
    private val queries get() = database.sharedDatabaseQueries

    private companion object {
        const val TARGET_CACHE_SIZE = 40 // Multiple GTO tasks
        const val MIN_CACHE_SIZE = 10 // Minimum before resyncing
        const val DEFAULT_BATCH_ID = "batch_001"
    }

    /**
     * Initialize cache with first batch. Called when app starts or cache is empty.
     */
    suspend fun initialSync(): Result<Unit> = try {
        val currentCount = queries.selectTotalGTOTaskCount().executeAsOne()
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
        val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.GTO_BATCHES}/$batchId").get()

        if (!doc.exists) {
            Result.failure(Exception("Batch $batchId not found in Firestore"))
        } else {
            val batch = doc.data(GTOTaskBatchDocDto.serializer())
            val now = Clock.System.now().toEpochMilliseconds()

            val tasks = batch.tasks.mapNotNull { taskDto ->
                val id = taskDto.id ?: return@mapNotNull null
                val title = taskDto.title ?: return@mapNotNull null
                CachedGTOTaskRow(
                    id = id,
                    taskType = taskDto.taskType ?: "GD",
                    title = title,
                    description = taskDto.description ?: "",
                    instructions = taskDto.instructions ?: "",
                    timeAllowedMinutes = (taskDto.timeAllowedMinutes ?: 30).toLong(),
                    difficultyLevel = taskDto.difficultyLevel,
                    category = taskDto.category,
                    scenario = taskDto.scenario,
                    resources = taskDto.resources,
                    objectives = taskDto.objectives,
                    evaluationCriteria = taskDto.evaluationCriteria,
                    batchId = batchId,
                    cachedAt = now,
                    lastUsed = null,
                    usageCount = 0L
                )
            }

            if (tasks.isEmpty()) {
                Result.failure(Exception("No valid tasks parsed from batch $batchId"))
            } else {
                queries.transaction {
                    tasks.forEach { task ->
                        queries.insertOrReplaceGTOTask(
                            id = task.id,
                            taskType = task.taskType,
                            title = task.title,
                            description = task.description,
                            instructions = task.instructions,
                            timeAllowedMinutes = task.timeAllowedMinutes,
                            difficultyLevel = task.difficultyLevel,
                            category = task.category,
                            scenario = task.scenario,
                            resources = task.resources,
                            objectives = task.objectives,
                            evaluationCriteria = task.evaluationCriteria,
                            batchId = task.batchId,
                            cachedAt = task.cachedAt,
                            lastUsed = task.lastUsed,
                            usageCount = task.usageCount
                        )
                    }
                    queries.insertOrReplaceGTOBatchMetadata(
                        batchId = batchId,
                        downloadedAt = now,
                        taskCount = tasks.size.toLong(),
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
     * Get tasks by specific type (GD, GPE, etc.), prioritizing least-used ones.
     */
    suspend fun getTasksByType(taskType: String, count: Int = 1): Result<List<GTOCachedTask>> = try {
        val currentCount = queries.selectTotalGTOTaskCount().executeAsOne()
        if (currentCount < MIN_CACHE_SIZE) {
            initialSync().getOrThrow()
        }

        val cachedTasks = queries.selectLeastUsedGTOTasksByType(taskType, count.toLong()).executeAsList()

        if (cachedTasks.isEmpty()) {
            Result.failure(Exception("No tasks of type $taskType in cache"))
        } else {
            markTasksUsed(cachedTasks.map { it.id })
            Result.success(cachedTasks.map { it.toDomain() })
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Get random selection of tasks (for mixed exercises), prioritizing least-used ones.
     */
    suspend fun getRandomTasks(count: Int = 5): Result<List<GTOCachedTask>> = try {
        val currentCount = queries.selectTotalGTOTaskCount().executeAsOne()
        if (currentCount < MIN_CACHE_SIZE) {
            initialSync().getOrThrow()
        }

        val cachedTasks = queries.selectLeastUsedGTOTasks(count.toLong()).executeAsList()

        if (cachedTasks.isEmpty()) {
            Result.failure(Exception("No tasks in cache"))
        } else {
            markTasksUsed(cachedTasks.map { it.id })
            Result.success(cachedTasks.map { it.toDomain() })
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Get cache status for diagnostics.
     */
    suspend fun getCacheStatus(): GTOCacheStatus = try {
        val totalTasks = queries.selectTotalGTOTaskCount().executeAsOne()
        val batches = queries.selectTotalGTOBatchCount().executeAsOne()
        val lastSyncTime = queries.selectAllGTOBatchMetadata().executeAsList().maxOfOrNull { it.downloadedAt }

        GTOCacheStatus(
            cachedTasks = totalTasks.toInt(),
            batchesDownloaded = batches.toInt(),
            lastSyncTime = lastSyncTime,
            gdTaskCount = queries.selectGTOTaskCountByType("GD").executeAsOne().toInt(),
            gpeTaskCount = queries.selectGTOTaskCountByType("GPE").executeAsOne().toInt(),
            pgtTaskCount = queries.selectGTOTaskCountByType("PGT").executeAsOne().toInt(),
            commandTaskCount = queries.selectGTOTaskCountByType("COMMAND").executeAsOne().toInt()
        )
    } catch (e: Exception) {
        GTOCacheStatus()
    }

    /**
     * Clear all cache (for debugging/testing).
     */
    suspend fun clearCache() {
        queries.clearAllGTOTasks()
    }

    private fun markTasksUsed(taskIds: List<String>) {
        queries.markGTOTasksUsed(timestamp = Clock.System.now().toEpochMilliseconds(), taskIds = taskIds)
    }
}

private fun CachedGTOTaskRow.toDomain(): GTOCachedTask = GTOCachedTask(
    id = id,
    taskType = taskType,
    title = title,
    description = description,
    instructions = instructions,
    timeAllowedMinutes = timeAllowedMinutes.toInt(),
    difficultyLevel = difficultyLevel,
    category = category,
    scenario = scenario
)

/**
 * GTO cache status for diagnostics -- same shape as the Android original's
 * `GTOCacheStatus`.
 */
data class GTOCacheStatus(
    val cachedTasks: Int = 0,
    val batchesDownloaded: Int = 0,
    val lastSyncTime: Long? = null,
    val gdTaskCount: Int = 0, // Group Discussion
    val gpeTaskCount: Int = 0, // Group Planning Exercise
    val pgtTaskCount: Int = 0, // Progressive Group Tasks
    val commandTaskCount: Int = 0 // Command Tasks
)

/**
 * Lightweight cached-task read model -- same shape as the Android original's
 * `GTOTask` (renamed `GTOCachedTask` here to avoid colliding with the domain
 * layer's `GTOTest` sealed hierarchy naming; this class was never part of the
 * domain model on Android either, just this manager's own return type).
 */
data class GTOCachedTask(
    val id: String,
    val taskType: String,
    val title: String,
    val description: String,
    val instructions: String,
    val timeAllowedMinutes: Int,
    val difficultyLevel: String?,
    val category: String?,
    val scenario: String?
)

/** Firestore batch document shape for `test_content/gto/task_batches/{batchId}`. */
@Serializable
internal data class GTOTaskBatchDocDto(
    val tasks: List<GTOTaskFirestoreDto> = emptyList(),
    val version: String = "1.0.0"
)

@Serializable
internal data class GTOTaskFirestoreDto(
    val id: String? = null,
    val taskType: String? = null,
    val title: String? = null,
    val description: String? = null,
    val instructions: String? = null,
    val timeAllowedMinutes: Int? = null,
    val difficultyLevel: String? = null,
    val category: String? = null,
    val scenario: String? = null,
    val resources: String? = null,
    val objectives: String? = null,
    val evaluationCriteria: String? = null
)
