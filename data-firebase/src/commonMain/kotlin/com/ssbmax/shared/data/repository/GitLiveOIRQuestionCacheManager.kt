package com.ssbmax.shared.data.repository

import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.CacheStatus
import com.ssbmax.shared.domain.model.OIRCacheReadiness
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.CoroutineScope

import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * SQLDelight-backed port of the Android `OIRQuestionCacheManager` (Room-backed
 * via `OIRQuestionCacheDao`). Fourteenth (largest) Phase 2 Room DAO+manager
 * slice, spanning 3 tables (question cache, batch metadata, single-row
 * content-version sync metadata).
 *
 * Kept split into two classes -- this manager (sync/download/lifecycle) and
 * [GitLiveOIRQuestionSelector] (selection/distribution logic) -- mirroring the
 * Android original's own SRP split, and needed here to respect this repo's
 * 300-line-per-file limit; a merged class combining Firestore parsing +
 * selection + status mapping would exceed it.
 *
 * Same documented Firestore-decode deviation as the 8th-13th slices: a typed
 * `@Serializable` DTO ([OirBatchDocDto]) replaces Android's raw
 * `List<Map<String, Any>>` cast for the questions array; [selector] still
 * receives a `Map<String, Any?>`-shaped view per question ([toEntityMap]) so
 * [GitLiveOIRQuestionSelector.toEntity] can stay signature-compatible with the
 * Android original's `Map`-based `toEntity`.
 *
 * Background downloads use the application-owned scope supplied by Koin. The
 * manager never creates an untracked scope, so application shutdown can cancel
 * pending Phase 2 work deterministically.
 */
class GitLiveOIRQuestionCacheManager(
    private val database: SharedDatabase,
    private val selector: GitLiveOIRQuestionSelector,
    private val backgroundScope: CoroutineScope
) {
    private val queries get() = database.sharedDatabaseQueries
    private val syncMutex = Mutex()
    private var readiness = OIRCacheReadiness.NOT_INITIALIZED
    private var expectedBatches = 0
    private var lastSyncError: String? = null

    private companion object {
        const val FIRESTORE_OIR_DOC = "oir"
        const val FIRESTORE_BATCHES = "batches"
        const val FIRESTORE_META = "meta"
        const val FIRESTORE_META_CONFIG = "config"
        const val PHASE_1_LAST = 4
    }

    internal data class MetaConfig(val contentVersion: Int?, val batchCount: Int)

    private fun batchId(i: Int): String = "batch_pdf_" + i.toString().padStart(3, '0')

    /**
     * Content-version-aware initial sync: reconcile (clear + re-download) if the
     * remote contentVersion differs from local; otherwise top up missing batches.
     * Phase 1 (1..4) is blocking; the rest downloads in the background.
     */
    suspend fun initialSync(): Result<Unit> = syncMutex.withLock {
        readiness = OIRCacheReadiness.SYNCING
        lastSyncError = null
        runCatching {
            val meta = fetchMetaConfig().getOrThrow()
            expectedBatches = meta.batchCount
            val localVersion = queries.selectOIRSyncMetadata().executeAsOneOrNull()?.contentVersion?.toInt()
            val needsReconcile = meta.contentVersion != localVersion

            if (needsReconcile) {
                queries.deleteAllOIRQuestions()
                queries.deleteAllOIRBatchMetadata()
            }
            val missingBatches = (1..meta.batchCount).filterNot { isBatchDownloaded(batchId(it)) }
            val blockingBatches = missingBatches.filter { it <= PHASE_1_LAST }
            blockingBatches.forEach { downloadBatch(batchId(it)).getOrThrow() }
            meta.contentVersion?.let {
                queries.upsertOIRSyncMetadata(contentVersion = it.toLong(), lastSyncAt = Clock.System.now().toEpochMilliseconds())
            }
            readiness = if (hasEnoughQuestions()) OIRCacheReadiness.READY
            else OIRCacheReadiness.INSUFFICIENT_CONTENT
        missingBatches.filter { it > PHASE_1_LAST }.takeIf { it.isNotEmpty() }?.let { batches ->
                backgroundScope.launch {
                    val failure = batches.firstNotNullOfOrNull { batch ->
                        downloadBatch(batchId(batch)).exceptionOrNull()
                    }
                    if (failure != null) {
                        lastSyncError = failure.message
                        readiness = OIRCacheReadiness.FAILED
                    }
                }
            }
            Unit
        }.onFailure { error ->
            lastSyncError = error.message
            readiness = if (error.message?.contains("metadata", ignoreCase = true) == true) {
                OIRCacheReadiness.METADATA_UNAVAILABLE
            } else OIRCacheReadiness.FAILED
        }
    }

    private fun isBatchDownloaded(batchId: String): Boolean =
        queries.countOIRBatchMetadataById(batchId).executeAsOne() > 0

    /** Read `test_content/oir/meta/config`; missing or malformed metadata fails closed. */
    internal suspend fun fetchMetaConfig(): Result<MetaConfig> {
        return try {
        val doc = Firebase.firestore.collection(SsbContracts.FirestorePaths.TEST_CONTENT)
            .document(FIRESTORE_OIR_DOC)
            .collection(FIRESTORE_META)
            .document(FIRESTORE_META_CONFIG)
            .get()
        if (!doc.exists) {
            Result.failure(IllegalStateException("OIR metadata document is unavailable"))
        } else {
            val batchCount = doc.get<Long?>("batchCount")?.toInt()
                ?: return Result.failure(IllegalStateException("OIR metadata batch count is missing"))
            if (batchCount <= 0) return Result.failure(IllegalStateException("OIR metadata batch count is invalid"))
            Result.success(MetaConfig(doc.get<Long?>("contentVersion")?.toInt(), batchCount))
        }
    } catch (e: Exception) {
        Result.failure(IllegalStateException("OIR metadata read failed", e))
        }
    }

    /** Download a single batch from Firestore and persist it. Idempotent -- returns early if already local. */
    suspend fun downloadBatch(batchId: String): Result<Unit> = try {
        if (isBatchDownloaded(batchId)) {
            Result.success(Unit)
        } else {
            val doc = Firebase.firestore.collection(SsbContracts.FirestorePaths.TEST_CONTENT)
                .document(FIRESTORE_OIR_DOC)
                .collection(FIRESTORE_BATCHES)
                .document(batchId)
                .get()

            if (!doc.exists) {
                Result.failure(Exception("Batch $batchId not found in Firestore"))
            } else {
                val batch = doc.data(OirBatchDocDto.serializer())
                val questionCount = batch.totalQuestions ?: batch.questions.size
                val version = batch.version ?: "1.0.0"
                val now = Clock.System.now().toEpochMilliseconds()

                val entities = batch.questions.mapIndexed { index, q -> selector.toEntity(q.toEntityMap(), batchId, index, now) }
                queries.transaction {
                    entities.forEach { e ->
                        queries.insertOrReplaceOIRQuestion(
                            id = e.id,
                            questionNumber = e.questionNumber,
                            type = e.type,
                            subtype = e.subtype,
                            questionText = e.questionText,
                            optionsJson = e.optionsJson,
                            correctAnswerId = e.correctAnswerId,
                            explanation = e.explanation,
                            questionImageUrl = e.questionImageUrl,
                            difficulty = e.difficulty,
                            tags = e.tags,
                            batchId = e.batchId,
                            cachedAt = e.cachedAt,
                            lastUsed = e.lastUsed,
                            usageCount = e.usageCount,
                            correctAnswerIds = e.correctAnswerIds
                        )
                    }
                    queries.insertOrReplaceOIRBatchMetadata(
                        batchId = batchId,
                        downloadedAt = now,
                        questionCount = questionCount.toLong(),
                        version = version
                    )
                }
                Result.success(Unit)
            }
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Delegates question selection to [GitLiveOIRQuestionSelector]; triggers a sync first if the cache is thin. */
    suspend fun getTestQuestions(count: Int = 50): Result<List<com.ssbmax.shared.domain.model.OIRQuestion>> {
        if (!hasEnoughQuestions()) initialSync().getOrThrow()
        val selected = selector.selectQuestions(count).getOrThrow()
        return if (selected.size == count) Result.success(selected)
        else Result.failure(IllegalStateException("OIR cache has insufficient valid questions"))
    }

    private suspend fun hasEnoughQuestions(): Boolean =
        selector.selectQuestions(count = 50).getOrNull()?.size == 50

    suspend fun markQuestionsUsed(questionIds: List<String>) {
        try {
            queries.markOIRQuestionsUsed(timestamp = Clock.System.now().toEpochMilliseconds(), questionIds = questionIds)
        } catch (_: Exception) {
            // Best-effort usage tracking -- matches Android original's swallow-and-log.
        }
    }

    suspend fun getCacheStatus(): CacheStatus = try {
        val count = queries.selectTotalOIRQuestionCount().executeAsOne()
        val batches = queries.selectAllOIRBatchMetadata().executeAsList()
        CacheStatus(
            cachedQuestions = count.toInt(),
            batchesDownloaded = batches.size,
            lastSyncTime = batches.maxOfOrNull { it.downloadedAt },
            verbalCount = queries.selectOIRQuestionCountByType(OIRQuestionType.VERBAL_REASONING.name).executeAsOne().toInt(),
            nonVerbalCount = queries.selectOIRQuestionCountByType(OIRQuestionType.NON_VERBAL_REASONING.name).executeAsOne().toInt(),
            numericalCount = queries.selectOIRQuestionCountByType(OIRQuestionType.NUMERICAL_ABILITY.name).executeAsOne().toInt(),
            spatialCount = queries.selectOIRQuestionCountByType(OIRQuestionType.SPATIAL_REASONING.name).executeAsOne().toInt(),
            readiness = readiness,
            expectedBatches = expectedBatches,
            lastError = lastSyncError
        )
    } catch (e: Exception) {
        CacheStatus(0, 0, null, 0, 0, 0, 0, OIRCacheReadiness.FAILED, expectedBatches, e.message)
    }

    suspend fun clearCache(): Result<Unit> = try {
        queries.deleteAllOIRQuestions()
        queries.deleteAllOIRBatchMetadata()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

/** Firestore batch document shape for `test_content/oir/batches/{batchId}`. */
@Serializable
internal data class OirBatchDocDto(
    val questions: List<OirQuestionFirestoreDto> = emptyList(),
    val totalQuestions: Int? = null,
    val version: String? = null
)

@Serializable
internal data class OirQuestionFirestoreDto(
    val id: String? = null,
    val questionNumber: Int? = null,
    val type: String? = null,
    val subtype: String? = null,
    val questionText: String? = null,
    val options: List<OirOptionFirestoreDto>? = null,
    val correctAnswerId: String? = null,
    val correctAnswerIds: List<String>? = null,
    val explanation: String? = null,
    val questionImageUrl: String? = null,
    val difficulty: String? = null,
    val tags: List<String>? = null
)

@Serializable
internal data class OirOptionFirestoreDto(
    val id: String? = null,
    val text: String? = null,
    val imageUrl: String? = null
)

/**
 * Adapts the typed Firestore DTO back to the `Map<String, Any>`-ish shape
 * [GitLiveOIRQuestionSelector.toEntity] expects, so that helper stays
 * signature-compatible with the Android original's `Map`-based `toEntity`
 * (which parses Firestore's loosely-typed documents directly). Only the keys
 * `toEntity` actually reads are populated.
 */
internal fun OirQuestionFirestoreDto.toEntityMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "questionNumber" to questionNumber,
    "type" to type,
    "subtype" to subtype,
    "questionText" to questionText,
    "options" to options?.map { mapOf("id" to it.id, "text" to it.text, "imageUrl" to it.imageUrl) },
    "correctAnswerId" to correctAnswerId,
    "correctAnswerIds" to correctAnswerIds,
    "explanation" to explanation,
    "questionImageUrl" to questionImageUrl,
    "difficulty" to difficulty,
    "tags" to tags
)
