package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.gto.GTOProgress
import com.ssbmax.shared.domain.model.gto.GTOTestType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * GTO progress/sequential-unlock cluster (`getUserProgress`/`observeUserProgress`/
 * `updateProgress`/`canUserTakeTest`/`getCompletedTests`/`getNextAvailableTest`), split out of
 * the former single `GitLiveGTORepository` god-class (300-line-file limit).
 *
 * Quota bookkeeping (`recordTestUsage`/`getTestUsageCount`/`resetMonthlyUsage`,
 * `GTOProgressDto.testsUsedThisMonth`) moved out entirely in Phase 5
 * (docs/plans/CrossPlatform_SSOT): it never actually gated anything (`GTOEligibilityChecker`
 * already read quota from `SubscriptionLimits`/`SubscriptionUsageDto`'s "GTO" bucket, not this
 * map), so it was a second, permanently-out-of-sync counter. GTO submissions now go through the
 * same [com.ssbmax.shared.domain.repository.TestUsageRecorder]/`recordTestUsage` callable as
 * every other test type, via `GTOSubmissionCoordinator`.
 *
 * **`updateProgress` is read-then-write instead of the Android original's
 * `firestore.runTransaction`** — see [GitLiveGTORepository]'s class doc for why (no other
 * `GitLive*Repository` port in this codebase has exercised GitLive's `Transaction` API yet).
 */
internal class GitLiveGTOProgressDelegate(private val collections: GitLiveGTOCollections) {

    private val progressCollection get() = collections.progress

    suspend fun getUserProgress(userId: String): Result<GTOProgress> = try {
        val doc = progressCollection.document(userId).get()
        if (!doc.exists) {
            Result.success(GTOProgress(userId = userId))
        } else {
            Result.success(doc.data(GTOProgressDto.serializer()).toDomain(userId))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    fun observeUserProgress(userId: String): Flow<GTOProgress?> =
        progressCollection.document(userId).snapshots
            .map<_, GTOProgress?> { snap ->
                if (snap.exists) {
                    runCatching { snap.data(GTOProgressDto.serializer()).toDomain(userId) }
                        .getOrDefault(GTOProgress(userId = userId))
                } else {
                    GTOProgress(userId = userId)
                }
            }
            .catch { emit(null) }

    /**
     * Read-then-write (not the Android original's `runTransaction`) — see the class doc for why.
     */
    suspend fun updateProgress(
        userId: String,
        completedTestType: GTOTestType
    ): Result<Unit> = try {
        val ref = progressCollection.document(userId)
        val snapshot = ref.get()
        val current = if (snapshot.exists) {
            runCatching { snapshot.data(GTOProgressDto.serializer()) }.getOrDefault(GTOProgressDto())
        } else {
            GTOProgressDto()
        }

        val completedTests = current.completedTests.toMutableList()
        if (completedTestType.name !in completedTests) {
            completedTests.add(completedTestType.name)
        }
        val nextOrder = completedTests
            .mapNotNull { runCatching { GTOTestType.valueOf(it) }.getOrNull()?.order }
            .maxOrNull()
            ?.plus(1) ?: 1

        ref.set(
            current.copy(
                completedTests = completedTests,
                currentSequentialOrder = nextOrder,
                lastCompletedAt = Clock.System.now().toEpochMilliseconds()
            )
        )

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun canUserTakeTest(userId: String, testType: GTOTestType): Result<Boolean> =
        getUserProgress(userId).map { it.isTestUnlocked(testType) }

    suspend fun getCompletedTests(userId: String): Result<List<GTOTestType>> =
        getUserProgress(userId).map { it.completedTests }

    suspend fun getNextAvailableTest(userId: String): Result<GTOTestType?> =
        getUserProgress(userId).map { it.getNextTest() }
}

@Serializable
internal data class GTOProgressDto(
    val completedTests: List<String> = emptyList(),
    val currentSequentialOrder: Int = 1,
    val lastCompletedAt: Long? = null
)

internal fun GTOProgressDto.toDomain(userId: String): GTOProgress = GTOProgress(
    userId = userId,
    completedTests = completedTests.mapNotNull { runCatching { GTOTestType.valueOf(it) }.getOrNull() },
    currentSequentialOrder = currentSequentialOrder,
    lastCompletedAt = lastCompletedAt
)
