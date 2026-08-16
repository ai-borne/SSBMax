package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SDTInstructorScore
import com.ssbmax.shared.domain.model.SDTQuestionResponse
import com.ssbmax.shared.domain.model.SDTSubmission
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import dev.gitlive.firebase.firestore.Direction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.transform
import kotlinx.serialization.Serializable

/**
 * SDT half of the psych-test submission cluster, split out of the former single
 * `GitLivePsychTestSubmissionRepository` god-class (300-line-file limit) — see
 * [GitLivePsychTestSubmissionRepository]'s class doc for the shared "submissions"/"psych_results"
 * collection shape and the nested-`data`-duplication quirk this port faithfully reproduces.
 * Pure structural split — no behavior change from the original merged class.
 */
internal class GitLiveSDTSubmissionDelegate(private val store: GitLiveOlqResultStore) {

    private val submissionsCollection get() = store.submissionsCollection

    suspend fun submitSDT(submission: SDTSubmission, batchId: String?): Result<String> {
      if (!isUsableDocumentId(submission.id)) return blankDocumentIdFailure("submission.id")
      return try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.SD.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            gradedByInstructorId = submission.gradedByInstructorId,
            gradingTimestamp = submission.gradingTimestamp,
            batchId = batchId,
            data = SDTDataDto(
                id = submission.id,
                userId = submission.userId,
                testId = submission.testId,
                responses = submission.responses.map { it.toDto() },
                totalTimeTakenMinutes = submission.totalTimeTakenMinutes,
                submittedAt = submission.submittedAt,
                status = submission.status.name,
                instructorScore = submission.instructorScore?.toDto(),
                gradedByInstructorId = submission.gradedByInstructorId,
                gradingTimestamp = submission.gradingTimestamp
            )
        )
        submissionsCollection.document(submission.id).set(doc, merge = true)
        Result.success(submission.id)
      } catch (e: Exception) {
        Result.failure(Exception("Failed to submit SDT: ${e.message}", e))
      }
    }

    suspend fun getSDTSubmission(submissionId: String): Result<SDTSubmission?> {
        if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
        return try {
            val snapshot = submissionsCollection.document(submissionId).get()
            if (!snapshot.exists) Result.success(null)
            else Result.success(snapshot.data(SubmissionDocDto.serializer(SDTDataDto.serializer())).data.toDomain())
        } catch (e: Exception) {
            Result.failure(Exception("Failed to fetch SDT submission: ${e.message}", e))
        }
    }

    suspend fun getLatestSDTSubmission(userId: String): Result<SDTSubmission?> = try {
        val snapshot = submissionsCollection
            .where { PSYCH_FIELD_USER_ID equalTo userId }
            .where { PSYCH_FIELD_TEST_TYPE equalTo TestType.SD.name }
            .orderBy(PSYCH_FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(1)
            .get()
        val doc = snapshot.documents.firstOrNull()
        if (doc == null) {
            Result.success(null)
        } else {
            Result.success(doc.data(SubmissionDocDto.serializer(SDTDataDto.serializer())).data.toDomain())
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to fetch latest SDT submission: ${e.message}", e))
    }

    suspend fun updateSDTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> {
        if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
        return try {
            submissionsCollection.document(submissionId).update("$PSYCH_FIELD_DATA.analysisStatus" to status.name)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to update SDT status: ${e.message}", e))
        }
    }

    suspend fun updateSDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        store.updateOlqResultTwoStep(submissionId, olqResult)

    suspend fun getSDTResult(submissionId: String): Result<OLQAnalysisResult?> = store.getOlqResult(submissionId)

    private val sdtRegressionFilters = mutableMapOf<String, OLQRegressionFilter>()

    /**
     * A regression-filtered snapshot is skipped (`transform`), not mapped to `null` — see
     * [GitLivePsychTestSubmissionRepository.observeTATSubmission]'s doc for why.
     */
    fun observeSDTSubmission(submissionId: String): Flow<SDTSubmission?> {
        if (!isUsableDocumentId(submissionId)) return kotlinx.coroutines.flow.flowOf(null)
        return submissionsCollection.document(submissionId).snapshots
            .transform { snapshot ->
                if (!snapshot.exists) {
                    emit(null)
                    return@transform
                }
                val dto = snapshot.data(SubmissionDocDto.serializer(SDTDataDto.serializer()))
                val filter = sdtRegressionFilters.getOrPut(submissionId) { OLQRegressionFilter() }
                if (filter.shouldFilterSnapshot(dto.data.analysisStatus, dto.data.olqResult != null, snapshot.metadata)) return@transform
                emit(dto.data.toDomain())
            }
    }
}

// ===========================
// SDT DTOs
// ===========================

@Serializable
internal data class SDTDataDto(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val responses: List<SDTResponseDto> = emptyList(),
    val totalTimeTakenMinutes: Int = 0,
    val submittedAt: Long = 0L,
    val status: String = "",
    val instructorScore: SDTInstructorScoreDto? = null,
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null,
    val analysisStatus: String? = null,
    val olqResult: OLQAnalysisResultDto? = null
)

@Serializable
internal data class SDTResponseDto(
    val questionId: String = "",
    val question: String = "",
    val answer: String = "",
    val charCount: Int = 0,
    val timeTakenSeconds: Int = 0,
    val submittedAt: Long = 0L,
    val isSkipped: Boolean = false
)

@Serializable
internal data class SDTInstructorScoreDto(
    val overallScore: Float = 0f,
    val selfAwarenessScore: Float = 0f,
    val emotionalMaturityScore: Float = 0f,
    val socialPerceptionScore: Float = 0f,
    val introspectionScore: Float = 0f,
    val feedback: String = "",
    val flaggedResponses: List<String> = emptyList(),
    val exemplaryResponses: List<String> = emptyList(),
    val gradedByInstructorId: String = "",
    val gradedByInstructorName: String = "",
    val gradedAt: Long = 0L,
    val agreedWithAI: Boolean = false
)

internal fun SDTQuestionResponse.toDto() = SDTResponseDto(questionId, question, answer, charCount, timeTakenSeconds, submittedAt, isSkipped)
internal fun SDTResponseDto.toDomain() = SDTQuestionResponse(questionId, question, answer, charCount, timeTakenSeconds, submittedAt, isSkipped)

internal fun SDTInstructorScore.toDto() = SDTInstructorScoreDto(
    overallScore, selfAwarenessScore, emotionalMaturityScore, socialPerceptionScore, introspectionScore,
    feedback, flaggedResponses, exemplaryResponses, gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

internal fun SDTInstructorScoreDto.toDomain() = SDTInstructorScore(
    overallScore, selfAwarenessScore, emotionalMaturityScore, socialPerceptionScore, introspectionScore,
    feedback, flaggedResponses, exemplaryResponses, gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

internal fun SDTDataDto.toDomain(): SDTSubmission = SDTSubmission(
    id = id,
    userId = userId,
    testId = testId,
    responses = responses.map { it.toDomain() },
    totalTimeTakenMinutes = totalTimeTakenMinutes,
    submittedAt = submittedAt,
    status = runCatching { SubmissionStatus.valueOf(status) }.getOrDefault(SubmissionStatus.SUBMITTED_PENDING_REVIEW),
    instructorScore = instructorScore?.toDomain(),
    gradedByInstructorId = gradedByInstructorId,
    gradingTimestamp = gradingTimestamp,
    analysisStatus = analysisStatus?.let { runCatching { AnalysisStatus.valueOf(it) }.getOrDefault(AnalysisStatus.PENDING_ANALYSIS) } ?: AnalysisStatus.PENDING_ANALYSIS,
    olqResult = olqResult?.toDomain()
)
