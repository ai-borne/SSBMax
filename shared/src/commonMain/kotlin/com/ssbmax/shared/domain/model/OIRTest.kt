package com.ssbmax.shared.domain.model

enum class OIRQuestionType {
    VERBAL_REASONING,
    NON_VERBAL_REASONING,
    NUMERICAL_ABILITY,
    SPATIAL_REASONING;

    val displayName: String
        get() = when (this) {
            VERBAL_REASONING -> "Verbal Reasoning"
            NON_VERBAL_REASONING -> "Non-Verbal Reasoning"
            NUMERICAL_ABILITY -> "Numerical Ability"
            SPATIAL_REASONING -> "Spatial Reasoning"
        }
}

data class OIRQuestion(
    val id: String,
    val questionNumber: Int,
    val type: OIRQuestionType,
    val questionText: String,
    val options: List<OIROption>,
    val correctAnswerId: String,
    val explanation: String,
    val difficulty: QuestionDifficulty,
    val timeSeconds: Int = 60,
    val questionImageUrl: String? = null,
    val correctAnswerIds: List<String> = emptyList(),
) {
    val isMultiSelect: Boolean get() = correctAnswerIds.size > 1
}

data class OIROption(
    val id: String,
    val text: String,
    val imageUrl: String? = null,
)

enum class QuestionDifficulty {
    EASY,
    MEDIUM,
    HARD;

    val displayName: String
        get() = when (this) {
            EASY -> "Easy"
            MEDIUM -> "Medium"
            HARD -> "Hard"
        }

    val points: Int
        get() = when (this) {
            EASY -> 1
            MEDIUM -> 2
            HARD -> 3
        }
}

data class OIRAnswer(
    val questionId: String,
    val selectedOptionId: String?,
    val isCorrect: Boolean = false,
    val timeTakenSeconds: Int = 0,
    val skipped: Boolean = false,
    val selectedOptionIds: Set<String> = emptySet(),
)

data class OIRTestSession(
    val sessionId: String,
    val userId: String,
    val testId: String,
    val questions: List<OIRQuestion>,
    val answers: Map<String, OIRAnswer> = emptyMap(),
    val currentQuestionIndex: Int = 0,
    val startTime: Long,
    val timeRemainingSeconds: Int,
    val expiresAt: Long = startTime + timeRemainingSeconds * 1000L,
    val isPaused: Boolean = false,
    val isCompleted: Boolean = false,
) {
    val progress: Float
        get() = if (questions.isNotEmpty()) answers.size.toFloat() / questions.size else 0f

    val currentQuestion: OIRQuestion?
        get() = questions.getOrNull(currentQuestionIndex)

    val answeredCount: Int
        get() = answers.count { !it.value.skipped }

    val skippedCount: Int
        get() = answers.count { it.value.skipped }

    val unansweredCount: Int
        get() = questions.size - answers.size
}

@Suppress("DEPRECATION")
data class OIRTestResult(
    val testId: String,
    val sessionId: String,
    val userId: String,
    val totalQuestions: Int,
    val correctAnswers: Int,
    val incorrectAnswers: Int,
    val skippedQuestions: Int,
    val totalTimeSeconds: Int,
    val timeTakenSeconds: Int,
    val rawScore: Int,
    val percentageScore: Float,
    val categoryScores: Map<OIRQuestionType, CategoryScore>,
    @Deprecated("Legacy OIR field; no longer calculated for new results")
    val difficultyBreakdown: Map<QuestionDifficulty, DifficultyScore> = emptyMap(),
    val answeredQuestions: List<OIRAnsweredQuestion>,
    val completedAt: Long,
) {
    val passed: Boolean
        get() = percentageScore >= 50f

    val grade: TestGrade
        get() = when {
            percentageScore >= 90 -> TestGrade.EXCELLENT
            percentageScore >= 75 -> TestGrade.VERY_GOOD
            percentageScore >= 60 -> TestGrade.GOOD
            percentageScore >= 50 -> TestGrade.AVERAGE
            else -> TestGrade.NEEDS_IMPROVEMENT
        }
}

data class CategoryScore(
    val category: OIRQuestionType,
    val totalQuestions: Int,
    val correctAnswers: Int,
    val percentage: Float,
    val averageTimeSeconds: Int,
)

@Deprecated("Legacy OIR field retained for historical result compatibility")
data class DifficultyScore(
    val difficulty: QuestionDifficulty,
    val totalQuestions: Int,
    val correctAnswers: Int,
    val percentage: Float,
)

data class OIRAnsweredQuestion(
    val question: OIRQuestion,
    val userAnswer: OIRAnswer,
    val isCorrect: Boolean,
    val correctOption: OIROption,
    val selectedOption: OIROption?,
    val correctOptions: List<OIROption> = emptyList(),
    val selectedOptions: List<OIROption> = emptyList(),
)

enum class TestGrade {
    EXCELLENT,
    VERY_GOOD,
    GOOD,
    AVERAGE,
    NEEDS_IMPROVEMENT;

    val displayName: String
        get() = when (this) {
            EXCELLENT -> "Excellent"
            VERY_GOOD -> "Very Good"
            GOOD -> "Good"
            AVERAGE -> "Average"
            NEEDS_IMPROVEMENT -> "Needs Improvement"
        }

    val emoji: String
        get() = when (this) {
            EXCELLENT -> "🌟"
            VERY_GOOD -> "⭐"
            GOOD -> "👍"
            AVERAGE -> "👌"
            NEEDS_IMPROVEMENT -> "📚"
        }
}

data class OIRTestConfig(
    val testId: String = "oir_standard",
    val title: String = "OIR Test",
    val description: String = "Officer Intelligence Rating Test",
    val totalQuestions: Int = 50,
    val totalTimeMinutes: Int = 40,
    val passingPercentage: Float = 50f,
    val showImmediateFeedback: Boolean = true,
    val allowReview: Boolean = true,
    val shuffleQuestions: Boolean = true,
)

data class OIRSubmission(
    val id: String,
    val userId: String,
    val testId: String,
    val testResult: OIRTestResult,
    val submittedAt: Long,
    val status: SubmissionStatus,
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null,
)
