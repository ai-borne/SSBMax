package com.ssbmax.shared.domain.validation

import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionDistribution
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.OIRTestConfig

/** Enforces the minimum question-set contract before an OIR session starts. */
object OIRTestQuestionSetValidator {
    fun validate(
        questions: List<OIRQuestion>,
        config: OIRTestConfig = OIRTestConfig()
    ): Result<List<OIRQuestion>> {
        if (questions.size != config.totalQuestions) {
            return Result.failure(
                IllegalArgumentException(
                    "OIR test requires ${config.totalQuestions} questions, received ${questions.size}."
                )
            )
        }

        val invalidQuestion = questions.firstOrNull { !OIRQuestionValidator.validate(it).isValid }
        if (invalidQuestion != null) {
            return Result.failure(
                IllegalArgumentException("OIR question ${invalidQuestion.id} failed validation.")
            )
        }

        val counts = questions.groupingBy { it.type }.eachCount()
        val missingType = OIRQuestionDistribution.counts(config.totalQuestions)
            .entries
            .firstOrNull { (type, required) -> counts[type].orZero() < required }
            ?.key
        if (missingType != null) {
            return Result.failure(
                IllegalArgumentException("OIR test is missing required $missingType questions.")
            )
        }

        return Result.success(questions)
    }

    private fun Int?.orZero(): Int = this ?: 0
}
