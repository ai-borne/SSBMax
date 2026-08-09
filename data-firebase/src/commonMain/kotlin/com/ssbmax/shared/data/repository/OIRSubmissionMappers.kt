package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.OIRSubmission
import com.ssbmax.shared.domain.model.SubmissionStatus
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/**
 * Wire format for [OIRSubmission], split out of `GitLivePersonalTestSubmissionRepository.kt` to
 * keep both files under the 300-line limit. Mirrors the Android `OIRPersonalSubmissionDataSource`
 * DTO shape field-for-field.
 */
@Serializable
internal data class OIRDataDto(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val testResult: OIRSubmissionTestResultDto = OIRSubmissionTestResultDto(),
    val submittedAt: Long = 0L,
    val status: String = "",
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null
)

@OptIn(ExperimentalSerializationApi::class)
@Serializable
internal data class OIRSubmissionTestResultDto(
    val testId: String = "",
    val sessionId: String = "",
    val userId: String = "",
    val totalQuestions: Int = 0,
    val correctAnswers: Int = 0,
    val incorrectAnswers: Int = 0,
    val skippedQuestions: Int = 0,
    val totalTimeSeconds: Int = 0,
    val timeTakenSeconds: Int = 0,
    val rawScore: Int = 0,
    val percentageScore: Float = 0f,
    val categoryScores: Map<String, CategoryScoreDto> = emptyMap(),
    /** Legacy Firestore field; decoded for compatibility but omitted from new writes. */
    @kotlinx.serialization.EncodeDefault(kotlinx.serialization.EncodeDefault.Mode.NEVER)
    val difficultyBreakdown: Map<String, DifficultyScoreDto> = emptyMap(),
    val answeredQuestions: List<OirAnsweredQuestionDto> = emptyList(),
    val completedAt: Long = 0L,
    val passed: Boolean = false,
    val grade: String = "C"
)

@Serializable
internal data class CategoryScoreDto(
    val totalQuestions: Int = 0,
    val correctAnswers: Int = 0,
    val percentage: Float = 0f,
    val averageTimeSeconds: Int = 0
)

@Serializable
internal data class DifficultyScoreDto(
    val totalQuestions: Int = 0,
    val correctAnswers: Int = 0,
    val percentage: Float = 0f
)

/** Canonical submission mapper preserving all result fields used by scoring and answer review. */
internal fun OIRSubmission.toDataDto() = OIRDataDto(
    id = id,
    userId = userId,
    testId = testId,
    testResult = OIRSubmissionTestResultDto(
        testId = testResult.testId,
        sessionId = testResult.sessionId,
        userId = testResult.userId,
        totalQuestions = testResult.totalQuestions,
        correctAnswers = testResult.correctAnswers,
        incorrectAnswers = testResult.incorrectAnswers,
        skippedQuestions = testResult.skippedQuestions,
        totalTimeSeconds = testResult.totalTimeSeconds,
        timeTakenSeconds = testResult.timeTakenSeconds,
        rawScore = testResult.rawScore,
        percentageScore = testResult.percentageScore,
        categoryScores = testResult.categoryScores.entries.associate { (category, score) ->
            category.name to CategoryScoreDto(score.totalQuestions, score.correctAnswers, score.percentage, score.averageTimeSeconds)
        },
        answeredQuestions = testResult.answeredQuestions.map { it.toDto() },
        completedAt = testResult.completedAt,
        passed = testResult.passed,
        grade = testResult.grade.name
    ),
    submittedAt = submittedAt,
    status = status.name,
    gradedByInstructorId = gradedByInstructorId,
    gradingTimestamp = gradingTimestamp
)

/**
 * True when a document already occupying an OIR submission's id belongs to a different
 * identity (user or test type) — a genuine collision, not a retry of the same attempt.
 * Extracted from [GitLivePersonalTestSubmissionRepository.submitOIR] purely for JVM
 * testability (the gitlive Firestore SDK isn't unit-testable). Pure, behavior-preserving
 * extraction — same equality check the inline guard used before extraction.
 */
internal fun isOirSubmissionIdentityConflict(
    existingUserId: String?,
    existingTestType: String?,
    incomingUserId: String,
    incomingTestType: String
): Boolean = !(existingUserId == incomingUserId && existingTestType == incomingTestType)

internal fun OIRDataDto.toDomain(): OIRSubmission {
    val result = OirTestResultDto(
        testId = testResult.testId,
        sessionId = testResult.sessionId,
        userId = testResult.userId,
        totalQuestions = testResult.totalQuestions,
        correctAnswers = testResult.correctAnswers,
        incorrectAnswers = testResult.incorrectAnswers,
        skippedQuestions = testResult.skippedQuestions,
        totalTimeSeconds = testResult.totalTimeSeconds,
        timeTakenSeconds = testResult.timeTakenSeconds,
        rawScore = testResult.rawScore,
        percentageScore = testResult.percentageScore,
        categoryScores = testResult.categoryScores.mapValues { (_, score) ->
            OirCategoryScoreDto(score.totalQuestions, score.correctAnswers, score.percentage, score.averageTimeSeconds)
        },
        difficultyBreakdown = testResult.difficultyBreakdown.mapValues { (_, score) ->
            OirDifficultyScoreDto(score.totalQuestions, score.correctAnswers, score.percentage)
        },
        answeredQuestions = testResult.answeredQuestions,
        completedAt = testResult.completedAt
    )
    return OIRSubmission(
        id = id,
        userId = userId,
        testId = testId,
        testResult = result.toDomain(),
        submittedAt = submittedAt,
        status = runCatching { SubmissionStatus.valueOf(status) }.getOrDefault(SubmissionStatus.SUBMITTED_PENDING_REVIEW),
        gradedByInstructorId = gradedByInstructorId,
        gradingTimestamp = gradingTimestamp
    )
}
