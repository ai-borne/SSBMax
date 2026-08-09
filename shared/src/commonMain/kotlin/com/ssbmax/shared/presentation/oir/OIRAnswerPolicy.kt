package com.ssbmax.shared.presentation.oir

import com.ssbmax.shared.domain.model.OIRAnswer
import com.ssbmax.shared.domain.model.OIRTestSession

internal fun addSkippedAnswerIfNeeded(
    session: OIRTestSession,
    nowMs: Long,
    questionStartTimeMs: Long
): OIRTestSession {
    val question = session.currentQuestion ?: return session
    if (question.id in session.answers) return session
    val timeTaken = ((nowMs - questionStartTimeMs) / 1000L).toInt().coerceAtLeast(0)
    val answer = OIRAnswer(
        questionId = question.id,
        selectedOptionId = null,
        selectedOptionIds = emptySet(),
        timeTakenSeconds = timeTaken,
        skipped = true
    )
    return session.copy(answers = session.answers + (question.id to answer))
}

internal fun markUnansweredQuestionsSkipped(
    session: OIRTestSession,
    nowMs: Long,
    questionStartTimeMs: Long
): OIRTestSession {
    val timeTaken = ((nowMs - questionStartTimeMs) / 1000L).toInt().coerceAtLeast(0)
    val answers = session.questions.associate { question ->
        question.id to (session.answers[question.id] ?: OIRAnswer(
            questionId = question.id,
            selectedOptionId = null,
            selectedOptionIds = emptySet(),
            timeTakenSeconds = timeTaken,
            skipped = true
        ))
    }
    return session.copy(answers = answers)
}
