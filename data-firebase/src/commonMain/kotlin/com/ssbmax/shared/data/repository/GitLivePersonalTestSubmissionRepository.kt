package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.OIRSubmission
import com.ssbmax.shared.domain.model.PIQSubmission
import com.ssbmax.shared.domain.model.PPDTSubmission
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.Source
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.transform

/**
 * GitLive-Firebase-backed port of the Android `PersonalTestSubmissionRepository` facade + its
 * `PPDTPersonalSubmissionDataSource`/`OIRPersonalSubmissionDataSource`/`PIQPersonalSubmissionDataSource`
 * delegates (PPDT, OIR, and PIQ).
 *
 * DTOs live in sibling files, split out to keep every file under the 300-line limit:
 * `PPDTSubmissionMappers.kt`, `OIRSubmissionMappers.kt`, `PIQSubmissionMappers.kt` +
 * `PIQSubmissionSectionDtos.kt`.
 *
 * **PIQ port note:** `PIQSubmission` (`shared/domain/model/PIQTest.kt`) is a ~90-field flat form
 * model (personal/family/education/NCC/interview-history sections), matching the Android
 * original's `PIQSubmission.toMap()`/`parsePIQSubmission()` field-for-field, including its one
 * real gap: `aiPreliminaryScore` is written but never read back (see `PIQDataDto`'s class doc).
 */
class GitLivePersonalTestSubmissionRepository {

    private val submissionsCollection = Firebase.firestore.collection(SUBMISSIONS_COLLECTION)
    private val ppdtResultsCollection = Firebase.firestore.collection(PPDT_RESULTS_COLLECTION)

    // ===========================
    // PPDT
    // ===========================

    suspend fun submitPPDT(submission: PPDTSubmission, batchId: String?): Result<String> = try {
        val doc = SubmissionDocDto(
            id = submission.submissionId,
            userId = submission.userId,
            testId = submission.questionId,
            testType = TestType.PPDT.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            batchId = batchId,
            data = submission.toDataDto()
        )
        submissionsCollection.document(submission.submissionId).set(doc)
        Result.success(submission.submissionId)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to submit PPDT: ${e.message}", e))
    }

    suspend fun getPPDTSubmission(submissionId: String): Result<PPDTSubmission?> = try {
        val snapshot = getWithServerThenCacheFallback { submissionsCollection.document(submissionId).get(it) }
        if (!snapshot.exists) Result.success(null)
        else Result.success(snapshot.data(SubmissionDocDto.serializer(PPDTDataDto.serializer())).data.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get PPDT submission: ${e.message}", e))
    }

    suspend fun getLatestPPDTSubmission(userId: String): Result<PPDTSubmission?> = try {
        val query = submissionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .where { FIELD_TEST_TYPE equalTo TestType.PPDT.name }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(1)
        val snapshot = getWithServerThenCacheFallback { query.get(it) }
        val doc = snapshot.documents.firstOrNull()
        if (doc == null) {
            Result.success(null)
        } else {
            Result.success(doc.data(SubmissionDocDto.serializer(PPDTDataDto.serializer())).data.toDomain())
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get latest PPDT submission: ${e.message}", e))
    }

    suspend fun updatePPDTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> = try {
        submissionsCollection.document(submissionId).update("$FIELD_DATA.analysisStatus" to status.name)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to update PPDT status: ${e.message}", e))
    }

    /**
     * Writes to `ppdt_results` and flips the submission to COMPLETED in one batch — same "GTO
     * pattern" (a dedicated results collection, not a nested `data.olqResult`) the Android
     * original uses for PPDT specifically, distinct from TAT/WAT/SRT/SDT's `psych_results`.
     */
    suspend fun updatePPDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> = try {
        val submissionDoc = submissionsCollection.document(submissionId).get()
        val userId = submissionDoc.data(SubmissionDocDto.serializer(PPDTDataDto.serializer())).userId
        if (userId.isEmpty()) {
            Result.failure(Exception("userId not found in submission"))
        } else {
            val batch = Firebase.firestore.batch()
            batch.set(ppdtResultsCollection.document(submissionId), olqResult.toDto(userId = userId))
            batch.update(
                submissionsCollection.document(submissionId),
                "$FIELD_DATA.analysisStatus" to SubmissionConstants.ANALYSIS_STATUS_COMPLETED,
                FIELD_STATUS to "COMPLETED"
            )
            batch.commit()
            Result.success(Unit)
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to update PPDT OLQ result: ${e.message}", e))
    }

    suspend fun getPPDTResult(submissionId: String): Result<OLQAnalysisResult?> = try {
        val doc = getWithServerThenCacheFallback { ppdtResultsCollection.document(submissionId).get(it) }
        if (!doc.exists) Result.success(null)
        else Result.success(doc.data(OLQAnalysisResultDto.serializer()).toDomain())
    } catch (e: Exception) {
        Result.failure(Exception("Error fetching PPDT result: ${e.message}", e))
    }

    /**
     * A regression-filtered snapshot is skipped (`transform`), not mapped to `null` — see
     * [GitLivePsychTestSubmissionRepository.observeTATSubmission]'s doc for why.
     */
    fun observePPDTSubmission(submissionId: String): Flow<PPDTSubmission?> =
        submissionsCollection.document(submissionId).snapshots
            .transform { snapshot ->
                if (!snapshot.exists) {
                    emit(null)
                    return@transform
                }
                val dto = snapshot.data(SubmissionDocDto.serializer(PPDTDataDto.serializer()))
                val filter = ppdtRegressionFilters.getOrPut(submissionId) { OLQRegressionFilter() }
                if (filter.shouldFilterSnapshot(dto.data.analysisStatus, dto.data.olqResult != null, snapshot.metadata)) return@transform
                emit(dto.data.toDomain())
            }

    // ===========================
    // OIR
    // ===========================

    suspend fun submitOIR(submission: OIRSubmission, batchId: String?): Result<String> = try {
        // Each attempt now writes under a fresh submission id (OIR Retake Seal, Phase 1),
        // so this branch is only reachable on a genuine same-id retry (e.g. a client-side
        // resubmit of an in-flight request) — a real retake never collides here.
        val existing = submissionsCollection.document(submission.id).get()
        if (existing.exists) {
            val existingUserId = existing.data(FirestoreRawMapSerializer)[FIELD_USER_ID] as? String
            val existingTestType = existing.data(FirestoreRawMapSerializer)[FIELD_TEST_TYPE] as? String
            if (isOirSubmissionIdentityConflict(existingUserId, existingTestType, submission.userId, TestType.OIR.name)) {
                Result.failure(IllegalStateException("Submission identity conflict"))
            } else {
                Result.success(submission.id)
            }
        } else {
            val doc = SubmissionDocDto(
                id = submission.id,
                userId = submission.userId,
                testId = submission.testId,
                testType = TestType.OIR.name,
                status = submission.status.name,
                submittedAt = submission.submittedAt,
                gradedByInstructorId = submission.gradedByInstructorId,
                gradingTimestamp = submission.gradingTimestamp,
                batchId = batchId,
                data = submission.toDataDto()
            )
            submissionsCollection.document(submission.id).set(doc, merge = true)
            Result.success(submission.id)
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to submit OIR: ${e.message}", e))
    }

    suspend fun getLatestOIRSubmission(userId: String): Result<OIRSubmission?> = try {
        val query = submissionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .where { FIELD_TEST_TYPE equalTo TestType.OIR.name }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(1)
        val snapshot = getWithServerThenCacheFallback { query.get(it) }
        val doc = snapshot.documents.firstOrNull()
        if (doc == null) {
            Result.success(null)
        } else {
            Result.success(doc.data(SubmissionDocDto.serializer(OIRDataDto.serializer())).data.toDomain())
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get latest OIR submission: ${e.message}", e))
    }

    // ===========================
    // PIQ
    // ===========================

    suspend fun submitPIQ(submission: PIQSubmission, batchId: String?): Result<String> = try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.PIQ.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            gradedByInstructorId = submission.gradedByInstructorId,
            gradingTimestamp = submission.gradingTimestamp,
            batchId = batchId,
            data = submission.toDataDto()
        )
        submissionsCollection.document(submission.id).set(doc, merge = true)
        Result.success(submission.id)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to submit PIQ: ${e.message}", e))
    }

    suspend fun getLatestPIQSubmission(userId: String): Result<PIQSubmission?> = try {
        val query = submissionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .where { FIELD_TEST_TYPE equalTo TestType.PIQ.name }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(1)
        val snapshot = getWithServerThenCacheFallback { query.get(it) }
        val doc = snapshot.documents.firstOrNull()
        if (doc == null) {
            Result.success(null)
        } else {
            Result.success(doc.data(SubmissionDocDto.serializer(PIQDataDto.serializer())).data.toDomain())
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get latest PIQ submission: ${e.message}", e))
    }

    // ===========================
    // Shared helpers
    // ===========================

    /**
     * Same server-then-cache-fallback pattern as the Android original (a plain `.get()` prefers
     * server data but silently returns cache on any offline/timeout failure).
     */
    private suspend fun <T> getWithServerThenCacheFallback(fetch: suspend (Source) -> T): T =
        try {
            fetch(Source.SERVER)
        } catch (e: Exception) {
            fetch(Source.CACHE)
        }

    private val ppdtRegressionFilters = mutableMapOf<String, OLQRegressionFilter>()

    private companion object {
        const val SUBMISSIONS_COLLECTION = "submissions"
        const val PPDT_RESULTS_COLLECTION = "ppdt_results"
        const val FIELD_USER_ID = "userId"
        const val FIELD_TEST_TYPE = "testType"
        const val FIELD_SUBMITTED_AT = "submittedAt"
        const val FIELD_STATUS = "status"
        const val FIELD_DATA = "data"
    }
}
