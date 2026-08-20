package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.GradingPriority
import com.ssbmax.shared.domain.model.GradingQueueItem
import com.ssbmax.shared.domain.model.InstructorGradingStats
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.GradingQueueRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed port of the Android GradingQueueRepositoryImpl.
 * Same "submissions" collection, same client-side stats aggregation (this
 * data isn't precomputed server-side in the Android version either); uses
 * Query.snapshots (a Flow) in place of the Android SDK's
 * addSnapshotListener/callbackFlow, same as the other GitLive*Repository ports.
 *
 * None of the four observe* methods catch-and-emit a default on listener
 * errors (an earlier version did) -- the Android original's
 * `addSnapshotListener` closes the flow with the error (`close(error)`), and
 * `InstructorGradingViewModel` already has its own `.catch { }` for
 * [observePendingSubmissions]/[observeSubmissionsByTestType] expecting to see
 * it and show a real error state. Swallowing it here made that ViewModel code
 * unreachable and showed "no submissions" for what was actually a
 * permission/network failure. [observeGradingStats]'s caller
 * (`InstructorHomeViewModel`) didn't have a `.catch` either -- fixed there too,
 * see its own comment.
 */
class GitLiveGradingQueueRepository : GradingQueueRepository {

    private val submissionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)

    override fun observePendingSubmissions(instructorId: String): Flow<List<GradingQueueItem>> =
        submissionsCollection
            .where { FIELD_STATUS inArray listOf(SubmissionStatus.SUBMITTED_PENDING_REVIEW.name, SubmissionStatus.UNDER_REVIEW.name) }
            .orderBy(FIELD_SUBMITTED_AT, Direction.ASCENDING)
            .snapshots
            .map { snapshot -> snapshot.documents.mapNotNull { documentToGradingQueueItem(it) } }

    override fun observeSubmissionsByBatch(batchId: String): Flow<List<GradingQueueItem>> =
        submissionsCollection
            .where { FIELD_STATUS equalTo SubmissionStatus.SUBMITTED_PENDING_REVIEW.name }
            .where { FIELD_BATCH_ID equalTo batchId }
            .orderBy(FIELD_SUBMITTED_AT, Direction.ASCENDING)
            .snapshots
            .map { snapshot -> snapshot.documents.mapNotNull { documentToGradingQueueItem(it) } }

    override fun observeSubmissionsByTestType(testType: TestType): Flow<List<GradingQueueItem>> =
        submissionsCollection
            .where { FIELD_STATUS equalTo SubmissionStatus.SUBMITTED_PENDING_REVIEW.name }
            .where { FIELD_TEST_TYPE equalTo testType.name }
            .orderBy(FIELD_SUBMITTED_AT, Direction.ASCENDING)
            .snapshots
            .map { snapshot -> snapshot.documents.mapNotNull { documentToGradingQueueItem(it) } }

    override fun observeGradingStats(instructorId: String): Flow<InstructorGradingStats> =
        submissionsCollection
            .snapshots
            .map { snapshot ->
                val documents = snapshot.documents.mapNotNull {
                    runCatching { it.data(SubmissionStatsDto.serializer()) }.getOrNull()
                }
                val now = Clock.System.now().toEpochMilliseconds()
                val oneDayAgo = now - (24 * 60 * 60 * 1000)
                val oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000)

                val totalPending = documents.count {
                    it.status == SubmissionStatus.SUBMITTED_PENDING_REVIEW.name ||
                        it.status == SubmissionStatus.UNDER_REVIEW.name
                }
                val totalGraded = documents.count { it.status == SubmissionStatus.GRADED.name }
                val todayGraded = documents.count {
                    it.status == SubmissionStatus.GRADED.name && (it.gradedAt ?: 0L) >= oneDayAgo
                }
                val weekGraded = documents.count {
                    it.status == SubmissionStatus.GRADED.name && (it.gradedAt ?: 0L) >= oneWeekAgo
                }

                val pendingByType = documents
                    .filter { it.status == SubmissionStatus.SUBMITTED_PENDING_REVIEW.name }
                    .groupBy { it.testType }
                    .mapNotNull { (typeStr, docs) ->
                        runCatching { TestType.valueOf(typeStr) }.getOrNull()?.let { it to docs.size }
                    }
                    .toMap()

                val gradedWithScores = documents
                    .filter { it.status == SubmissionStatus.GRADED.name }
                    .mapNotNull { it.data?.instructorScore?.overallScore }

                val averageScore = if (gradedWithScores.isNotEmpty()) gradedWithScores.average().toFloat() else 0f

                InstructorGradingStats(
                    totalPending = totalPending,
                    totalGraded = totalGraded,
                    averageGradingTimeMinutes = 0,
                    todayGraded = todayGraded,
                    weekGraded = weekGraded,
                    pendingByTestType = pendingByType,
                    averageScoreGiven = averageScore
                )
            }

    override suspend fun markSubmissionUnderReview(
        submissionId: String,
        instructorId: String
    ): Result<Unit> = try {
        submissionsCollection.document(submissionId).update(
            FIELD_STATUS to SubmissionStatus.UNDER_REVIEW.name,
            "gradedByInstructorId" to instructorId,
            "gradingTimestamp" to Clock.System.now().toEpochMilliseconds()
        )
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to mark as under review: ${e.message}", e))
    }

    override suspend fun releaseSubmissionFromReview(submissionId: String): Result<Unit> = try {
        submissionsCollection.document(submissionId).update(
            FIELD_STATUS to SubmissionStatus.SUBMITTED_PENDING_REVIEW.name,
            "gradedByInstructorId" to null,
            "gradingTimestamp" to null
        )
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to release from review: ${e.message}", e))
    }

    /**
     * Note: student name is not resolved here, same simplification as the
     * Android original (see its own TODO) — a real fix needs a user-profile
     * cache/join, which is bigger than this slice.
     */
    private fun documentToGradingQueueItem(doc: DocumentSnapshot): GradingQueueItem? {
        val dto = runCatching { doc.data(GradingQueueSubmissionDto.serializer()) }.getOrNull() ?: return null
        val testType = runCatching { TestType.valueOf(dto.testType) }.getOrNull() ?: return null
        val status = runCatching { SubmissionStatus.valueOf(dto.status) }.getOrNull() ?: return null

        val hoursWaiting = (Clock.System.now().toEpochMilliseconds() - dto.submittedAt) / (1000 * 60 * 60)
        val priority = gradingPriorityForHoursWaiting(hoursWaiting)

        val aiScore = dto.data?.aiPreliminaryScore?.overallScore

        return GradingQueueItem(
            submissionId = dto.id,
            studentId = dto.userId,
            studentName = "Student ${dto.userId}",
            testType = testType,
            testName = testType.name,
            submittedAt = dto.submittedAt,
            status = status,
            priority = priority,
            batchName = dto.batchId,
            aiScore = aiScore,
            hasAISuggestions = aiScore != null
        )
    }

    private companion object {
        const val FIELD_STATUS = "status"
        const val FIELD_TEST_TYPE = "testType"
        const val FIELD_BATCH_ID = "batchId"
        const val FIELD_SUBMITTED_AT = "submittedAt"
    }
}

/**
 * Priority escalates with wait time so instructors triage oldest-first, same
 * thresholds as the Android original.
 */
internal fun gradingPriorityForHoursWaiting(hoursWaiting: Long): GradingPriority = when {
    hoursWaiting > 72 -> GradingPriority.URGENT
    hoursWaiting > 48 -> GradingPriority.HIGH
    hoursWaiting > 24 -> GradingPriority.NORMAL
    else -> GradingPriority.LOW
}

@Serializable
internal data class GradingQueueSubmissionDto(
    val id: String = "",
    val userId: String = "",
    val testType: String = "",
    val status: String = "",
    val submittedAt: Long = 0L,
    val batchId: String? = null,
    val data: SubmissionScoresDto? = null
)

@Serializable
internal data class SubmissionStatsDto(
    val status: String = "",
    val testType: String = "",
    val gradedAt: Long? = null,
    val data: SubmissionScoresDto? = null
)

/** Mirrors the nested "data" map's score sub-objects the Android original reads via raw map lookups. */
@Serializable
internal data class SubmissionScoresDto(
    val aiPreliminaryScore: ScoreDto? = null,
    val instructorScore: ScoreDto? = null
)

@Serializable
internal data class ScoreDto(
    val overallScore: Float? = null
)
