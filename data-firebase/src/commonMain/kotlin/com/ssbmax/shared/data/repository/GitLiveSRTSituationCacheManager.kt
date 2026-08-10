package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.db.CachedSRTSituation as CachedSRTSituationRow
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.SRTCategory
import com.ssbmax.shared.domain.model.SRTSituation
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * SQLDelight-backed port of the Android `SRTSituationCacheManager` (Room-backed
 * via `SRTSituationCacheDao`). Twelfth Phase 2 Room DAO+manager slice.
 *
 * Same documented Firestore-decode deviation as the 8th-11th slices: a typed
 * `@Serializable` DTO ([SRTSituationBatchDocDto]) replaces Android's raw
 * `List<Map<String, Any?>>` cast.
 */
class GitLiveSRTSituationCacheManager(
    private val database: SharedDatabase
) {
    private val queries get() = database.sharedDatabaseQueries

    private companion object {
        const val TARGET_CACHE_SIZE = 60
        const val MIN_CACHE_SIZE = 20
        const val DEFAULT_BATCH_ID = "batch_001"
        val CATEGORIES = listOf(
            "LEADERSHIP", "DECISION_MAKING", "CRISIS_MANAGEMENT", "ETHICAL_DILEMMA",
            "RESPONSIBILITY", "TEAMWORK", "INTERPERSONAL", "COURAGE", "GENERAL"
        )
    }

    suspend fun initialSync(): Result<Unit> = try {
        val currentCount = queries.selectTotalSRTSituationCount().executeAsOne()
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
        val doc = Firebase.firestore.document("${SsbContracts.FirestorePaths.TestContent.SRT_BATCHES}/$batchId").get()

        if (!doc.exists) {
            Result.failure(Exception("Batch $batchId not found in Firestore"))
        } else {
            val batch = doc.data(SRTSituationBatchDocDto.serializer())
            val now = Clock.System.now().toEpochMilliseconds()

            val situations = batch.situations.mapNotNull { dto ->
                val id = dto.id ?: return@mapNotNull null
                val situation = dto.situation ?: return@mapNotNull null
                CachedSRTSituationRow(
                    id = id,
                    situation = situation,
                    sequenceNumber = (dto.sequenceNumber ?: 0).toLong(),
                    category = dto.category ?: "GENERAL",
                    timeAllowedSeconds = (dto.timeAllowedSeconds ?: 30).toLong(),
                    difficulty = dto.difficulty,
                    batchId = batchId,
                    cachedAt = now,
                    lastUsed = null,
                    usageCount = 0L
                )
            }

            if (situations.isEmpty()) {
                Result.failure(Exception("No valid situations parsed from batch $batchId"))
            } else {
                queries.transaction {
                    situations.forEach { s ->
                        queries.insertOrReplaceSRTSituation(
                            id = s.id,
                            situation = s.situation,
                            sequenceNumber = s.sequenceNumber,
                            category = s.category,
                            timeAllowedSeconds = s.timeAllowedSeconds,
                            difficulty = s.difficulty,
                            batchId = s.batchId,
                            cachedAt = s.cachedAt,
                            lastUsed = s.lastUsed,
                            usageCount = s.usageCount
                        )
                    }
                    queries.insertOrReplaceSRTBatchMetadata(
                        batchId = batchId,
                        downloadedAt = now,
                        situationCount = situations.size.toLong(),
                        version = batch.version
                    )
                }
                Result.success(Unit)
            }
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Get situations for a test (60, balanced across categories when the pool is large enough). */
    suspend fun getSituationsForTest(count: Int = 60): Result<List<SRTSituation>> = try {
        val currentCount = queries.selectTotalSRTSituationCount().executeAsOne()
        if (currentCount < MIN_CACHE_SIZE) {
            initialSync().getOrThrow()
        }

        val cachedSituations = if (currentCount >= count) {
            getBalancedSelection(count)
        } else {
            queries.selectLeastUsedSRTSituations(count.toLong()).executeAsList()
        }

        if (cachedSituations.isEmpty()) {
            Result.failure(Exception("No situations in cache"))
        } else {
            queries.markSRTSituationsUsed(
                timestamp = Clock.System.now().toEpochMilliseconds(),
                situationIds = cachedSituations.map { it.id }
            )
            Result.success(cachedSituations.map { it.toDomain() })
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun getBalancedSelection(count: Int): List<CachedSRTSituationRow> {
        val perCategory = count / CATEGORIES.size
        val remainder = count % CATEGORIES.size

        val selected = mutableListOf<CachedSRTSituationRow>()
        CATEGORIES.forEachIndexed { index, category ->
            val countForCategory = if (index < remainder) perCategory + 1 else perCategory
            selected += queries.selectBalancedSRTByCategory(category, countForCategory.toLong()).executeAsList()
        }

        if (selected.size < count) {
            val additionalNeeded = count - selected.size
            val selectedIds = selected.map { it.id }.toSet()
            val additional = queries.selectLeastUsedSRTSituations(additionalNeeded.toLong()).executeAsList()
                .filter { it.id !in selectedIds }
            selected += additional
        }

        return selected.shuffled().take(count)
    }

    suspend fun getCacheStatus(): SRTCacheStatus = try {
        val totalSituations = queries.selectTotalSRTSituationCount().executeAsOne()
        val batches = queries.selectTotalSRTBatchCount().executeAsOne()
        val lastSyncTime = queries.selectAllSRTBatchMetadata().executeAsList().maxOfOrNull { it.downloadedAt }

        SRTCacheStatus(
            cachedSituations = totalSituations.toInt(),
            batchesDownloaded = batches.toInt(),
            lastSyncTime = lastSyncTime,
            leadershipCount = queries.selectSRTSituationCountByCategory("LEADERSHIP").executeAsOne().toInt(),
            decisionMakingCount = queries.selectSRTSituationCountByCategory("DECISION_MAKING").executeAsOne().toInt(),
            crisisManagementCount = queries.selectSRTSituationCountByCategory("CRISIS_MANAGEMENT").executeAsOne().toInt(),
            ethicalDilemmaCount = queries.selectSRTSituationCountByCategory("ETHICAL_DILEMMA").executeAsOne().toInt(),
            responsibilityCount = queries.selectSRTSituationCountByCategory("RESPONSIBILITY").executeAsOne().toInt()
        )
    } catch (e: Exception) {
        SRTCacheStatus()
    }

    suspend fun clearCache() {
        queries.clearAllSRTSituations()
    }
}

private fun CachedSRTSituationRow.toDomain(): SRTSituation = SRTSituation(
    id = id,
    situation = situation,
    sequenceNumber = sequenceNumber.toInt(),
    category = parseSRTCategory(category),
    timeAllowedSeconds = timeAllowedSeconds.toInt()
)

private fun parseSRTCategory(category: String): SRTCategory =
    runCatching { SRTCategory.valueOf(category.uppercase()) }.getOrDefault(SRTCategory.GENERAL)

data class SRTCacheStatus(
    val cachedSituations: Int = 0,
    val batchesDownloaded: Int = 0,
    val lastSyncTime: Long? = null,
    val leadershipCount: Int = 0,
    val decisionMakingCount: Int = 0,
    val crisisManagementCount: Int = 0,
    val ethicalDilemmaCount: Int = 0,
    val responsibilityCount: Int = 0
)

@Serializable
internal data class SRTSituationBatchDocDto(
    val situations: List<SRTSituationFirestoreDto> = emptyList(),
    val version: String = "1.0.0"
)

@Serializable
internal data class SRTSituationFirestoreDto(
    val id: String? = null,
    val situation: String? = null,
    val sequenceNumber: Int? = null,
    val category: String? = null,
    val timeAllowedSeconds: Int? = null,
    val difficulty: String? = null
)
