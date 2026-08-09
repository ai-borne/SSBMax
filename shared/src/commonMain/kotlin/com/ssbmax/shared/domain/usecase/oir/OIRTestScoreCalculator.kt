package com.ssbmax.shared.domain.usecase.oir

import kotlin.time.Clock

import com.ssbmax.shared.domain.model.*
import com.ssbmax.shared.domain.util.DomainLogger

private const val TAG = "OIRScoreCalculator"

/** Calculates [OIRTestResult] from a completed [OIRTestSession]. Owns isCorrect computation — does NOT trust OIRAnswer.isCorrect. */
class OIRTestScoreCalculator constructor(
    private val logger: DomainLogger
) {

    fun calculate(session: OIRTestSession): OIRTestResult {
        val scoredAnswers = computeScoredAnswers(session)

        val correctAnswers   = scoredAnswers.values.count { it.isCorrect }
        val incorrectAnswers = scoredAnswers.values.count { !it.isCorrect && !it.skipped }
        val skippedQuestions = session.questions.count { question ->
            session.answers[question.id]?.skipped ?: true
        }

        val rawScore        = correctAnswers
        val percentageScore = if (session.questions.isNotEmpty()) {
            (correctAnswers.toFloat() / session.questions.size) * 100
        } else {
            0f
        }

        val categoryScores = OIRQuestionType.values().associateWith { type ->
            val catQs      = session.questions.filter { it.type == type }
            val catAnswers = catQs.mapNotNull { q -> scoredAnswers[q.id] }
            val correct    = catAnswers.count { it.isCorrect }
            val avgTime    = if (catAnswers.isNotEmpty()) catAnswers.map { it.timeTakenSeconds }.average().toInt() else 0
            CategoryScore(
                category            = type,
                totalQuestions      = catQs.size,
                correctAnswers      = correct,
                percentage          = if (catQs.isNotEmpty()) (correct.toFloat() / catQs.size) * 100 else 0f,
                averageTimeSeconds  = avgTime
            )
        }


        val answeredQuestions = buildAnsweredQuestions(session, scoredAnswers)

        return OIRTestResult(
            testId              = session.testId,
            sessionId           = session.sessionId,
            userId              = session.userId,
            totalQuestions      = session.questions.size,
            correctAnswers      = correctAnswers,
            incorrectAnswers    = incorrectAnswers,
            skippedQuestions    = skippedQuestions,
            totalTimeSeconds    = OIRTestConfig().totalTimeMinutes * 60,
            timeTakenSeconds    = ((Clock.System.now().toEpochMilliseconds() - session.startTime) / 1000).toInt(),
            rawScore            = rawScore,
            percentageScore     = percentageScore,
            categoryScores      = categoryScores,
            difficultyBreakdown = emptyMap(),
            answeredQuestions   = answeredQuestions,
            completedAt         = Clock.System.now().toEpochMilliseconds()
        )
    }

    private fun computeScoredAnswers(session: OIRTestSession): Map<String, OIRAnswer> =
        session.answers.mapValues { (_, answer) ->
            val question = session.questions.find { it.id == answer.questionId }
                ?: return@mapValues answer
            answer.copy(isCorrect = isCorrect(question, answer))
        }

    internal fun isCorrect(question: OIRQuestion, answer: OIRAnswer): Boolean =
        if (question.isMultiSelect) {
            answer.selectedOptionIds == question.correctAnswerIds.toSet()
        } else {
            // selectedOptionId fallback covers old Firestore submissions that pre-date multi-select migration
            val selected = answer.selectedOptionIds.singleOrNull() ?: answer.selectedOptionId
            selected == question.correctAnswerId
        }

    private fun buildAnsweredQuestions(
        session: OIRTestSession,
        scoredAnswers: Map<String, OIRAnswer>,
    ): List<OIRAnsweredQuestion> {
        logger.d(TAG, "📋 Building answered-questions list (${session.questions.size} questions)")
        val result = session.questions.mapNotNull { question ->
            val answer = scoredAnswers[question.id] ?: return@mapNotNull null
            if (question.isMultiSelect) {
                buildMultiSelectAnsweredQuestion(question, answer)
            } else {
                buildSingleSelectAnsweredQuestion(question, answer)
            }
        }
        logger.d(TAG, "✅ ${result.size} answered questions built")
        return result
    }

    private fun buildMultiSelectAnsweredQuestion(
        question: OIRQuestion,
        answer: OIRAnswer,
    ): OIRAnsweredQuestion? {
        val correctOptions = question.options.filter { it.id in question.correctAnswerIds }
        if (correctOptions.isEmpty()) {
            logger.e(
                TAG,
                "OIR scoring: no correctAnswerIds for multi-select ${question.id}",
                Exception("Empty correctAnswerIds for ${question.id}")
            )
            return null
        }
        val selectedOptions = question.options.filter { it.id in answer.selectedOptionIds }
        return OIRAnsweredQuestion(
            question        = question,
            userAnswer      = answer,
            isCorrect       = answer.isCorrect,
            correctOption   = correctOptions.first(),
            selectedOption  = null,
            correctOptions  = correctOptions,
            selectedOptions = selectedOptions,
        )
    }

    private fun buildSingleSelectAnsweredQuestion(
        question: OIRQuestion,
        answer: OIRAnswer,
    ): OIRAnsweredQuestion? {
        val correctOption = question.options.find { it.id == question.correctAnswerId }
        if (correctOption == null) {
            logger.e(
                TAG,
                "OIR scoring: correctAnswerId not found in options for ${question.id}",
                Exception("Invalid correctAnswerId for ${question.id}")
            )
            return null
        }
        return OIRAnsweredQuestion(
            question       = question,
            userAnswer     = answer,
            isCorrect      = answer.isCorrect,
            correctOption  = correctOption,
            selectedOption = answer.selectedOptionId?.let { id -> question.options.find { it.id == id } },
        )
    }
}
