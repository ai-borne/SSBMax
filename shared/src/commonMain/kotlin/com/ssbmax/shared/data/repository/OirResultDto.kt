package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.CategoryScore
import com.ssbmax.shared.domain.model.OIRAnswer
import com.ssbmax.shared.domain.model.OIRAnsweredQuestion
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.OIRTestResult
import com.ssbmax.shared.domain.model.QuestionDifficulty
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/**
 * Wire-format DTO for reading an OIR submission document via the GitLive
 * Firestore SDK, which requires kotlinx.serialization for typed document
 * reads (`DocumentSnapshot.data<T>(serializer)`), unlike the Android
 * firebase-firestore-ktx SDK which lets the existing ViewModel read a raw
 * `Map<String, Any>` and hand-parse it (see OIRSubmissionResultViewModel in
 * app/). This is a genuine structural difference between the two SDKs, not
 * a style choice.
 *
 * Mirrors the "data.testResult" nested shape of the existing Firestore
 * document (see OIRSubmissionResultViewModel.parseOIRTestResult).
 */
@Serializable
data class OirSubmissionDocumentDto(
    val data: OirSubmissionDataDto? = null
)

@Serializable
data class OirSubmissionDataDto(
    val testResult: OirTestResultDto? = null
)

@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class OirTestResultDto(
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
    val categoryScores: Map<String, OirCategoryScoreDto> = emptyMap(),
    /** Legacy Firestore field; decoded for compatibility but omitted from new cache writes. */
    @kotlinx.serialization.EncodeDefault(kotlinx.serialization.EncodeDefault.Mode.NEVER)
    val difficultyBreakdown: Map<String, OirDifficultyScoreDto> = emptyMap(),
    val answeredQuestions: List<OirAnsweredQuestionDto> = emptyList(),
    val completedAt: Long = 0L
)

@Serializable
data class OirCategoryScoreDto(
    val totalQuestions: Int = 0,
    val correctAnswers: Int = 0,
    val percentage: Float = 0f,
    val averageTimeSeconds: Int = 0
)

@Serializable
data class OirDifficultyScoreDto(
    val totalQuestions: Int = 0,
    val correctAnswers: Int = 0,
    val percentage: Float = 0f
)

@Serializable
data class OirAnsweredQuestionDto(
    val question: OirQuestionDto = OirQuestionDto(),
    val userAnswer: OirAnswerDto = OirAnswerDto(),
    val isCorrect: Boolean = false,
    val correctOption: OirOptionDto = OirOptionDto(),
    val selectedOption: OirOptionDto? = null,
    val correctOptions: List<OirOptionDto> = emptyList(),
    val selectedOptions: List<OirOptionDto> = emptyList()
)

@Serializable
data class OirQuestionDto(
    val id: String = "",
    val questionNumber: Int = 0,
    val type: String = "",
    val questionText: String = "",
    val options: List<OirOptionDto> = emptyList(),
    val correctAnswerId: String = "",
    val explanation: String = "",
    val difficulty: String = "",
    val timeSeconds: Int = 60,
    val questionImageUrl: String? = null,
    val correctAnswerIds: List<String> = emptyList()
)

@Serializable
data class OirOptionDto(
    val id: String = "",
    val text: String = "",
    val imageUrl: String? = null
)

@Serializable
data class OirAnswerDto(
    val questionId: String = "",
    val selectedOptionId: String? = null,
    val isCorrect: Boolean = false,
    val timeTakenSeconds: Int = 0,
    val skipped: Boolean = false,
    val selectedOptionIds: List<String> = emptyList()
)

@Suppress("DEPRECATION")
fun OirTestResultDto.toDomain(): OIRTestResult = OIRTestResult(
    testId = testId,
    sessionId = sessionId,
    userId = userId,
    totalQuestions = totalQuestions,
    correctAnswers = correctAnswers,
    incorrectAnswers = incorrectAnswers,
    skippedQuestions = skippedQuestions,
    totalTimeSeconds = if (totalTimeSeconds == 0) timeTakenSeconds else totalTimeSeconds,
    timeTakenSeconds = timeTakenSeconds,
    // Legacy results stored difficulty-weighted raw scores (for example, 20 for 10 correct).
    // The active OIR contract defines raw score as the correct-answer count.
    rawScore = correctAnswers,
    percentageScore = percentageScore,
    categoryScores = categoryScores.mapNotNull { (key, score) ->
        runCatching { OIRQuestionType.valueOf(key) }.getOrNull()?.let { type ->
            type to CategoryScore(type, score.totalQuestions, score.correctAnswers, score.percentage, score.averageTimeSeconds)
        }
    }.toMap(),
    difficultyBreakdown = difficultyBreakdown.mapNotNull { (key, score) ->
        runCatching { QuestionDifficulty.valueOf(key) }.getOrNull()?.let { difficulty ->
            difficulty to com.ssbmax.shared.domain.model.DifficultyScore(
                difficulty, score.totalQuestions, score.correctAnswers, score.percentage
            )
        }
    }.toMap(),
    answeredQuestions = answeredQuestions.mapNotNull { it.toDomain() },
    completedAt = completedAt
)

fun OirAnsweredQuestionDto.toDomain(): OIRAnsweredQuestion? {
    val questionType = runCatching { OIRQuestionType.valueOf(question.type) }.getOrNull() ?: return null
    // Difficulty was removed from the OIR contract. Keep the domain's legacy field populated so
    // historical answer-review records with no difficulty remain readable.
    val difficulty = runCatching { QuestionDifficulty.valueOf(question.difficulty) }
        .getOrDefault(QuestionDifficulty.MEDIUM)
    val domainQuestion = OIRQuestion(
        id = question.id,
        questionNumber = question.questionNumber,
        type = questionType,
        questionText = question.questionText,
        options = question.options.map { it.toDomain() },
        correctAnswerId = question.correctAnswerId,
        explanation = question.explanation,
        difficulty = difficulty,
        timeSeconds = question.timeSeconds,
        questionImageUrl = question.questionImageUrl,
        correctAnswerIds = question.correctAnswerIds
    )
    return OIRAnsweredQuestion(
        question = domainQuestion,
        userAnswer = userAnswer.toDomain(),
        isCorrect = isCorrect,
        correctOption = correctOption.toDomain(),
        selectedOption = selectedOption?.toDomain(),
        correctOptions = correctOptions.map { it.toDomain() },
        selectedOptions = selectedOptions.map { it.toDomain() }
    )
}

fun OirAnswerDto.toDomain() = OIRAnswer(
    questionId = questionId,
    selectedOptionId = selectedOptionId,
    isCorrect = isCorrect,
    timeTakenSeconds = timeTakenSeconds,
    skipped = skipped,
    selectedOptionIds = selectedOptionIds.toSet()
)

fun OirOptionDto.toDomain() = OIROption(id, text, imageUrl)

fun OIRAnsweredQuestion.toDto() = OirAnsweredQuestionDto(
    question = OirQuestionDto(
        id = question.id,
        questionNumber = question.questionNumber,
        type = question.type.name,
        questionText = question.questionText,
        options = question.options.map { OirOptionDto(it.id, it.text, it.imageUrl) },
        correctAnswerId = question.correctAnswerId,
        explanation = question.explanation,
        difficulty = question.difficulty.name,
        timeSeconds = question.timeSeconds,
        questionImageUrl = question.questionImageUrl,
        correctAnswerIds = question.correctAnswerIds
    ),
    userAnswer = OirAnswerDto(
        questionId = userAnswer.questionId,
        selectedOptionId = userAnswer.selectedOptionId,
        isCorrect = userAnswer.isCorrect,
        timeTakenSeconds = userAnswer.timeTakenSeconds,
        skipped = userAnswer.skipped,
        selectedOptionIds = userAnswer.selectedOptionIds.toList()
    ),
    isCorrect = isCorrect,
    correctOption = OirOptionDto(correctOption.id, correctOption.text, correctOption.imageUrl),
    selectedOption = selectedOption?.let { OirOptionDto(it.id, it.text, it.imageUrl) },
    correctOptions = correctOptions.map { OirOptionDto(it.id, it.text, it.imageUrl) },
    selectedOptions = selectedOptions.map { OirOptionDto(it.id, it.text, it.imageUrl) }
)
