package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TestType
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.Query
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.transform
import kotlin.time.Clock

/**
 * GitLive-Firebase-backed port of the Android `CommonSubmissionRepository`.
 *
 * All raw `Map<String, Any>` read/observe methods (`getSubmission`, `getUserSubmissions`,
 * `getUserSubmissionsByTestType`, `observeSubmission`, `observeUserSubmissions`,
 * `getPendingSubmissionsForInstructor`) decode documents through [FirestoreRawMapSerializer] —
 * see that file's class doc for why this is a real fix built on GitLive's public API surface
 * (`FirebaseDecoder`/`data(strategy)`), not a workaround or a domain-interface change.
 */
class GitLiveCommonSubmissionRepository {

    private val submissionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)
    private val regressionFilters = mutableMapOf<String, OLQRegressionFilter>()

    suspend fun updateSubmissionStatus(submissionId: String, status: SubmissionStatus): Result<Unit> = try {
        submissionsCollection.document(submissionId).update(FIELD_STATUS to status.name)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to update status: ${e.message}", e))
    }

    suspend fun updateWithInstructorGrading(
        submissionId: String,
        instructorId: String,
        status: SubmissionStatus = SubmissionStatus.GRADED
    ): Result<Unit> = try {
        submissionsCollection.document(submissionId).update(
            FIELD_STATUS to status.name,
            FIELD_GRADED_BY_INSTRUCTOR_ID to instructorId,
            FIELD_GRADING_TIMESTAMP to Clock.System.now().toEpochMilliseconds()
        )
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to update grading: ${e.message}", e))
    }

    suspend fun deleteSubmission(submissionId: String): Result<Unit> = try {
        submissionsCollection.document(submissionId).delete()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to delete submission: ${e.message}", e))
    }

    suspend fun getSubmission(submissionId: String): Result<Map<String, Any>?> = try {
        val snapshot = submissionsCollection.document(submissionId).get()
        if (!snapshot.exists) Result.success(null) else Result.success(snapshot.data(FirestoreRawMapSerializer))
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get submission: ${e.message}", e))
    }

    suspend fun getUserSubmissions(userId: String, limit: Int): Result<List<Map<String, Any>>> = try {
        val snapshot = submissionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(limit)
            .get()
        Result.success(snapshot.documents.map { it.data(FirestoreRawMapSerializer) })
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get user submissions: ${e.message}", e))
    }

    suspend fun getUserSubmissionsByTestType(
        userId: String,
        testType: TestType,
        limit: Int
    ): Result<List<Map<String, Any>>> = try {
        val snapshot = submissionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .where { FIELD_TEST_TYPE equalTo testType.name }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(limit)
            .get()
        Result.success(snapshot.documents.map { it.data(FirestoreRawMapSerializer) })
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get submissions by type: ${e.message}", e))
    }

    suspend fun getPendingSubmissionsForInstructor(
        batchId: String? = null,
        limit: Int = 100
    ): Result<List<Map<String, Any>>> = try {
        var query: Query = submissionsCollection
            .where { FIELD_STATUS equalTo SubmissionStatus.SUBMITTED_PENDING_REVIEW.name }
            .orderBy(FIELD_SUBMITTED_AT, Direction.ASCENDING)
        if (batchId != null) {
            query = query.where { FIELD_BATCH_ID equalTo batchId }
        }
        val snapshot = query.limit(limit).get()
        Result.success(snapshot.documents.map { it.data(FirestoreRawMapSerializer) })
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get pending submissions: ${e.message}", e))
    }

    /**
     * Same OLQ-regression protection as the Android original: a nested `data.analysisStatus`/
     * `data.olqResult` pair is inspected on every emission so a stale cache-only snapshot can
     * never regress a caller-visible submission back from COMPLETED to PENDING. A filtered
     * snapshot is skipped entirely (via `transform`, not mapped to `null`) — the Android
     * original's `addSnapshotListener` callback returns without a `trySend` in that case, and a
     * bare `null` here would incorrectly read as "not found" to callers like
     * `SubmissionDetailViewModel`. A real Firestore listener error is NOT swallowed either — the
     * Android original calls `close(error)`, propagating it to the collector's own `catch`.
     */
    fun observeSubmission(submissionId: String): Flow<Map<String, Any>?> =
        submissionsCollection.document(submissionId).snapshots
            .transform { snapshot ->
                if (!snapshot.exists) {
                    emit(null)
                    return@transform
                }
                val raw = snapshot.data(FirestoreRawMapSerializer)
                val nested = raw[FIELD_DATA] as? Map<*, *>
                val analysisStatus = nested?.get(FIELD_ANALYSIS_STATUS) as? String
                val hasOlqResult = nested?.get(FIELD_OLQ_RESULT) != null
                val filter = regressionFilters.getOrPut(submissionId) { OLQRegressionFilter() }
                if (filter.shouldFilterSnapshot(analysisStatus, hasOlqResult, snapshot.metadata)) return@transform
                emit(raw)
            }

    /** Errors propagate uncaught — matches the Android original's `close(error)`. */
    fun observeUserSubmissions(userId: String, limit: Int): Flow<List<Map<String, Any>>> =
        submissionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(limit)
            .snapshots
            .map { snapshot -> snapshot.documents.map { it.data(FirestoreRawMapSerializer) } }

    private companion object {
        const val FIELD_STATUS = "status"
        const val FIELD_GRADED_BY_INSTRUCTOR_ID = "gradedByInstructorId"
        const val FIELD_GRADING_TIMESTAMP = "gradingTimestamp"
        const val FIELD_USER_ID = "userId"
        const val FIELD_TEST_TYPE = "testType"
        const val FIELD_SUBMITTED_AT = "submittedAt"
        const val FIELD_BATCH_ID = "batchId"
        const val FIELD_DATA = "data"
        const val FIELD_ANALYSIS_STATUS = "analysisStatus"
        const val FIELD_OLQ_RESULT = "olqResult"
    }
}
