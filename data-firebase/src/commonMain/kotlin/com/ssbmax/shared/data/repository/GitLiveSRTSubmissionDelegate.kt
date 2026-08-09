package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SRTCategory
import com.ssbmax.shared.domain.model.SRTInstructorScore
import com.ssbmax.shared.domain.model.SRTSituationResponse
import com.ssbmax.shared.domain.model.SRTSubmission
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import dev.gitlive.firebase.firestore.Direction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.transform
import kotlinx.serialization.Serializable

/**
 * SRT half of the psych-test submission cluster, split out of the former single
 * `GitLivePsychTestSubmissionRepository` god-class (300-line-file limit) — see
 * [GitLivePsychTestSubmissionRepository]'s class doc for the shared "submissions"/"psych_results"
 * collection shape and the nested-`data`-duplication quirk this port faithfully reproduces.
 * Pure structural split — no behavior change from the original merged class.
 */
internal class GitLiveSRTSubmissionDelegate(private val store: GitLiveOlqResultStore) {

    private val submissionsCollection get() = store.submissionsCollection

    suspend fun submitSRT(submission: SRTSubmission, batchId: String?): Result<String> = try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.SRT.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            gradedByInstructorId = submission.gradedByInstructorId,
            gradingTimestamp = submission.gradingTimestamp,
            batchId = batchId,
            data = SRTDataDto(
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
        Result.failure(Exception("Failed to submit SRT: ${e.message}", e))
    }

    suspend fun getSRTSubmission(submissionId: String): Result<SRTSubmission?> = try {
        val snapshot = submissionsCollection.document(submissionId).get()
        if (!snapshot.exists) Result.success(null)
        else Result.success(snapshot.data(SubmissionDocDto.serializer(SRTDataDto.serializer())).data.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception("Failed to fetch SRT submission: ${e.message}", e))
    }

    suspend fun getLatestSRTSubmission(userId: String): Result<SRTSubmission?> = try {
        val snapshot = submissionsCollection
            .where { PSYCH_FIELD_USER_ID equalTo userId }
            .where { PSYCH_FIELD_TEST_TYPE equalTo TestType.SRT.name }
            .orderBy(PSYCH_FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(1)
            .get()
        val doc = snapshot.documents.firstOrNull()
        if (doc == null) {
            Result.success(null)
        } else {
            Result.success(doc.data(SubmissionDocDto.serializer(SRTDataDto.serializer())).data.toDomain())
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to fetch latest SRT submission: ${e.message}", e))
    }

    suspend fun updateSRTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> = try {
        submissionsCollection.document(submissionId).update("$PSYCH_FIELD_DATA.analysisStatus" to status.name)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to update SRT status: ${e.message}", e))
    }

    suspend fun updateSRTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        store.updateOlqResultTwoStep(submissionId, olqResult)

    suspend fun getSRTResult(submissionId: String): Result<OLQAnalysisResult?> = store.getOlqResult(submissionId)

    private val srtRegressionFilters = mutableMapOf<String, OLQRegressionFilter>()

    /**
     * A regression-filtered snapshot is skipped (`transform`), not mapped to `null` — see
     * [GitLivePsychTestSubmissionRepository.observeTATSubmission]'s doc for why.
     */
    fun observeSRTSubmission(submissionId: String): Flow<SRTSubmission?> =
        submissionsCollection.document(submissionId).snapshots
            .transform { snapshot ->
                if (!snapshot.exists) {
                    emit(null)
                    return@transform
                }
                val dto = snapshot.data(SubmissionDocDto.serializer(SRTDataDto.serializer()))
                val filter = srtRegressionFilters.getOrPut(submissionId) { OLQRegressionFilter() }
                if (filter.shouldFilterSnapshot(dto.data.analysisStatus, dto.data.olqResult != null, snapshot.metadata)) return@transform
                emit(dto.data.toDomain())
            }
}

// ===========================
// SRT DTOs
// ===========================

@Serializable
internal data class SRTDataDto(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val responses: List<SRTResponseDto> = emptyList(),
    val totalTimeTakenMinutes: Int = 0,
    val submittedAt: Long = 0L,
    val status: String = "",
    val instructorScore: SRTInstructorScoreDto? = null,
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null,
    val analysisStatus: String? = null,
    val olqResult: OLQAnalysisResultDto? = null
)

@Serializable
internal data class SRTResponseDto(
    val situationId: String = "",
    val situation: String = "",
    val response: String = "",
    val charactersCount: Int = 0,
    val timeTakenSeconds: Int = 0,
    val submittedAt: Long = 0L,
    val isSkipped: Boolean = false
)

@Serializable
internal data class SRTInstructorScoreDto(
    val overallScore: Float = 0f,
    val leadershipScore: Float = 0f,
    val decisionMakingScore: Float = 0f,
    val practicalityScore: Float = 0f,
    val initiativeScore: Float = 0f,
    val socialResponsibilityScore: Float = 0f,
    val feedback: String = "",
    val categoryWiseComments: Map<String, String> = emptyMap(),
    val flaggedResponses: List<String> = emptyList(),
    val exemplaryResponses: List<String> = emptyList(),
    val gradedByInstructorId: String = "",
    val gradedByInstructorName: String = "",
    val gradedAt: Long = 0L,
    val agreedWithAI: Boolean = false
)

internal fun SRTSituationResponse.toDto() = SRTResponseDto(situationId, situation, response, charactersCount, timeTakenSeconds, submittedAt, isSkipped)
internal fun SRTResponseDto.toDomain() = SRTSituationResponse(situationId, situation, response, charactersCount, timeTakenSeconds, submittedAt, isSkipped)

internal fun SRTInstructorScore.toDto() = SRTInstructorScoreDto(
    overallScore, leadershipScore, decisionMakingScore, practicalityScore, initiativeScore, socialResponsibilityScore,
    feedback, categoryWiseComments.entries.associate { (k, v) -> k.name to v }, flaggedResponses, exemplaryResponses,
    gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

/** Unparseable category keys are dropped, same defensive behavior as the Android original. */
internal fun SRTInstructorScoreDto.toDomain() = SRTInstructorScore(
    overallScore, leadershipScore, decisionMakingScore, practicalityScore, initiativeScore, socialResponsibilityScore,
    feedback,
    categoryWiseComments.mapNotNull { (k, v) -> runCatching { SRTCategory.valueOf(k) }.getOrNull()?.let { it to v } }.toMap(),
    flaggedResponses, exemplaryResponses, gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

internal fun SRTDataDto.toDomain(): SRTSubmission = SRTSubmission(
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
