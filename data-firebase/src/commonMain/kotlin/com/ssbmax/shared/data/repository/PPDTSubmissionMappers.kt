package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.PPDTDetailedScores
import com.ssbmax.shared.domain.model.PPDTInstructorReview
import com.ssbmax.shared.domain.model.PPDTSubmission
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import kotlinx.serialization.Serializable

/**
 * Wire format for [PPDTSubmission], split out of `GitLivePersonalTestSubmissionRepository.kt` to
 * keep both files under the 300-line limit. Mirrors the Android `PPDTPersonalSubmissionDataSource`
 * DTO shape field-for-field.
 */
@Serializable
internal data class PPDTDataDto(
    val submissionId: String = "",
    val questionId: String = "",
    val userId: String = "",
    val userName: String = "",
    val userEmail: String = "",
    val batchId: String? = null,
    val story: String = "",
    val charactersCount: Int = 0,
    val viewingTimeTakenSeconds: Int = 0,
    val writingTimeTakenMinutes: Int = 0,
    val submittedAt: Long = 0L,
    val status: String = "",
    val instructorReview: PPDTInstructorReviewDto? = null,
    // Not written by submitPPDT (see the Android original's "IMPORTANT: do NOT include" comment) —
    // only ever populated later, in place, by updatePPDTAnalysisStatus.
    val analysisStatus: String? = null,
    val olqResult: OLQAnalysisResultDto? = null
)

@Serializable
internal data class PPDTInstructorReviewDto(
    val reviewId: String = "",
    val instructorId: String = "",
    val instructorName: String = "",
    val finalScore: Float = 0f,
    val feedback: String = "",
    val detailedScores: PPDTDetailedScoresDto = PPDTDetailedScoresDto(),
    val agreedWithAI: Boolean = false,
    val reviewedAt: Long = 0L,
    val timeSpentMinutes: Int = 0
)

@Serializable
internal data class PPDTDetailedScoresDto(
    val perception: Float = 0f,
    val imagination: Float = 0f,
    val narration: Float = 0f,
    val characterDepiction: Float = 0f,
    val positivity: Float = 0f
)

internal fun PPDTSubmission.toDataDto() = PPDTDataDto(
    submissionId = submissionId,
    questionId = questionId,
    userId = userId,
    userName = userName,
    userEmail = userEmail,
    batchId = batchId,
    story = story,
    charactersCount = charactersCount,
    viewingTimeTakenSeconds = viewingTimeTakenSeconds,
    writingTimeTakenMinutes = writingTimeTakenMinutes,
    submittedAt = submittedAt,
    status = status.name,
    analysisStatus = AnalysisStatus.PENDING_ANALYSIS.name,
    instructorReview = instructorReview?.let {
        PPDTInstructorReviewDto(
            reviewId = it.reviewId,
            instructorId = it.instructorId,
            instructorName = it.instructorName,
            finalScore = it.finalScore,
            feedback = it.feedback,
            detailedScores = PPDTDetailedScoresDto(
                perception = it.detailedScores.perception,
                imagination = it.detailedScores.imagination,
                narration = it.detailedScores.narration,
                characterDepiction = it.detailedScores.characterDepiction,
                positivity = it.detailedScores.positivity
            ),
            agreedWithAI = it.agreedWithAI,
            reviewedAt = it.reviewedAt,
            timeSpentMinutes = it.timeSpentMinutes
        )
    }
)

internal fun PPDTDataDto.toDomain(): PPDTSubmission = PPDTSubmission(
    submissionId = submissionId,
    questionId = questionId,
    userId = userId,
    userName = userName,
    userEmail = userEmail,
    batchId = batchId,
    story = story,
    charactersCount = charactersCount,
    viewingTimeTakenSeconds = viewingTimeTakenSeconds,
    writingTimeTakenMinutes = writingTimeTakenMinutes,
    submittedAt = submittedAt,
    status = runCatching { SubmissionStatus.valueOf(status) }.getOrDefault(SubmissionStatus.SUBMITTED_PENDING_REVIEW),
    instructorReview = instructorReview?.let {
        PPDTInstructorReview(
            reviewId = it.reviewId,
            instructorId = it.instructorId,
            instructorName = it.instructorName,
            finalScore = it.finalScore,
            feedback = it.feedback,
            detailedScores = PPDTDetailedScores(
                perception = it.detailedScores.perception,
                imagination = it.detailedScores.imagination,
                narration = it.detailedScores.narration,
                characterDepiction = it.detailedScores.characterDepiction,
                positivity = it.detailedScores.positivity
            ),
            agreedWithAI = it.agreedWithAI,
            reviewedAt = it.reviewedAt,
            timeSpentMinutes = it.timeSpentMinutes
        )
    },
    analysisStatus = analysisStatus?.let { runCatching { AnalysisStatus.valueOf(it) }.getOrDefault(AnalysisStatus.PENDING_ANALYSIS) } ?: AnalysisStatus.PENDING_ANALYSIS,
    olqResult = olqResult?.toDomain()
)
