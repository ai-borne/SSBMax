package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.WATInstructorScore
import com.ssbmax.shared.domain.model.WATWordResponse
import com.ssbmax.shared.domain.model.WATSubmission
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import dev.gitlive.firebase.firestore.Direction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.transform
import kotlinx.serialization.Serializable

/**
 * WAT half of the psych-test submission cluster, split out of the former single
 * `GitLivePsychTestSubmissionRepository` god-class (300-line-file limit) — see
 * [GitLivePsychTestSubmissionRepository]'s class doc for the shared "submissions"/"psych_results"
 * collection shape and the nested-`data`-duplication quirk this port faithfully reproduces.
 * Pure structural split — no behavior change from the original merged class.
 */
internal class GitLiveWATSubmissionDelegate(private val store: GitLiveOlqResultStore) {

    private val submissionsCollection get() = store.submissionsCollection

    suspend fun submitWAT(submission: WATSubmission, batchId: String?): Result<String> = try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.WAT.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            gradedByInstructorId = submission.gradedByInstructorId,
            gradingTimestamp = submission.gradingTimestamp,
            batchId = batchId,
            data = WATDataDto(
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
        Result.failure(Exception("Failed to submit WAT: ${e.message}", e))
    }

    suspend fun getWATSubmission(submissionId: String): Result<WATSubmission?> = try {
        val snapshot = submissionsCollection.document(submissionId).get()
        if (!snapshot.exists) Result.success(null)
        else Result.success(snapshot.data(SubmissionDocDto.serializer(WATDataDto.serializer())).data.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception("Failed to fetch WAT submission: ${e.message}", e))
    }

    suspend fun getLatestWATSubmission(userId: String): Result<WATSubmission?> = try {
        val snapshot = submissionsCollection
            .where { PSYCH_FIELD_USER_ID equalTo userId }
            .where { PSYCH_FIELD_TEST_TYPE equalTo TestType.WAT.name }
            .orderBy(PSYCH_FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(1)
            .get()
        val doc = snapshot.documents.firstOrNull()
        if (doc == null) {
            Result.success(null)
        } else {
            Result.success(doc.data(SubmissionDocDto.serializer(WATDataDto.serializer())).data.toDomain())
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to fetch latest WAT submission: ${e.message}", e))
    }

    suspend fun updateWATAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> = try {
        submissionsCollection.document(submissionId).update("$PSYCH_FIELD_DATA.analysisStatus" to status.name)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to update WAT status: ${e.message}", e))
    }

    suspend fun updateWATOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        store.updateOlqResultTwoStep(submissionId, olqResult)

    suspend fun getWATResult(submissionId: String): Result<OLQAnalysisResult?> = store.getOlqResult(submissionId)

    private val watRegressionFilters = mutableMapOf<String, OLQRegressionFilter>()

    /**
     * A regression-filtered snapshot is skipped (`transform`), not mapped to `null` — see
     * [GitLivePsychTestSubmissionRepository.observeTATSubmission]'s doc for why.
     */
    fun observeWATSubmission(submissionId: String): Flow<WATSubmission?> =
        submissionsCollection.document(submissionId).snapshots
            .transform { snapshot ->
                if (!snapshot.exists) {
                    emit(null)
                    return@transform
                }
                val dto = snapshot.data(SubmissionDocDto.serializer(WATDataDto.serializer()))
                val filter = watRegressionFilters.getOrPut(submissionId) { OLQRegressionFilter() }
                if (filter.shouldFilterSnapshot(dto.data.analysisStatus, dto.data.olqResult != null, snapshot.metadata)) return@transform
                emit(dto.data.toDomain())
            }
}

// ===========================
// WAT DTOs
// ===========================

@Serializable
internal data class WATDataDto(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val responses: List<WATResponseDto> = emptyList(),
    val totalTimeTakenMinutes: Int = 0,
    val submittedAt: Long = 0L,
    val status: String = "",
    val instructorScore: WATInstructorScoreDto? = null,
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null,
    val analysisStatus: String? = null,
    val olqResult: OLQAnalysisResultDto? = null
)

@Serializable
internal data class WATResponseDto(
    val wordId: String = "",
    val word: String = "",
    val response: String = "",
    val timeTakenSeconds: Int = 0,
    val submittedAt: Long = 0L,
    val isSkipped: Boolean = false
)

@Serializable
internal data class WATInstructorScoreDto(
    val overallScore: Float = 0f,
    val positivityScore: Float = 0f,
    val creativityScore: Float = 0f,
    val speedScore: Float = 0f,
    val relevanceScore: Float = 0f,
    val emotionalMaturityScore: Float = 0f,
    val feedback: String = "",
    val flaggedResponses: List<String> = emptyList(),
    val notableResponses: List<String> = emptyList(),
    val gradedByInstructorId: String = "",
    val gradedByInstructorName: String = "",
    val gradedAt: Long = 0L,
    val agreedWithAI: Boolean = false
)

internal fun WATWordResponse.toDto() = WATResponseDto(wordId, word, response, timeTakenSeconds, submittedAt, isSkipped)
internal fun WATResponseDto.toDomain() = WATWordResponse(wordId, word, response, timeTakenSeconds, submittedAt, isSkipped)

internal fun WATInstructorScore.toDto() = WATInstructorScoreDto(
    overallScore, positivityScore, creativityScore, speedScore, relevanceScore, emotionalMaturityScore,
    feedback, flaggedResponses, notableResponses, gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

internal fun WATInstructorScoreDto.toDomain() = WATInstructorScore(
    overallScore, positivityScore, creativityScore, speedScore, relevanceScore, emotionalMaturityScore,
    feedback, flaggedResponses, notableResponses, gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

internal fun WATDataDto.toDomain(): WATSubmission = WATSubmission(
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
