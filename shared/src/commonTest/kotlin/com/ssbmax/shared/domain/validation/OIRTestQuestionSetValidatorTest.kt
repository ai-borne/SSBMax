package com.ssbmax.shared.domain.validation

import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.QuestionDifficulty
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OIRTestQuestionSetValidatorTest {
    @Test
    fun `accepts exactly 50 valid questions with required distribution`() {
        val result = OIRTestQuestionSetValidator.validate(questionSet(20, 20, 10))

        assertTrue(result.isSuccess)
        assertEquals(50, result.getOrThrow().size)
    }

    @Test
    fun `rejects a partial question set`() {
        val result = OIRTestQuestionSetValidator.validate(questionSet(20, 20, 9))

        assertFalse(result.isSuccess)
        assertTrue(result.exceptionOrNull()?.message.orEmpty().contains("requires 50"))
    }

    @Test
    fun `rejects a set missing a required question type`() {
        val result = OIRTestQuestionSetValidator.validate(questionSet(21, 29, 0))

        assertFalse(result.isSuccess)
        assertTrue(result.exceptionOrNull()?.message.orEmpty().contains("NUMERICAL_ABILITY"))
    }

    @Test
    fun `rejects structurally invalid questions`() {
        val questions = questionSet(20, 20, 10).toMutableList()
        questions[0] = questions[0].copy(correctAnswerId = "missing")

        val result = OIRTestQuestionSetValidator.validate(questions)

        assertFalse(result.isSuccess)
        assertTrue(result.exceptionOrNull()?.message.orEmpty().contains("failed validation"))
    }

    private fun questionSet(verbal: Int, nonVerbal: Int, numerical: Int): List<OIRQuestion> = buildList {
        repeat(verbal) { add(question(OIRQuestionType.VERBAL_REASONING, size)) }
        repeat(nonVerbal) { add(question(OIRQuestionType.NON_VERBAL_REASONING, size)) }
        repeat(numerical) { add(question(OIRQuestionType.NUMERICAL_ABILITY, size)) }
    }

    private fun question(type: OIRQuestionType, index: Int) = OIRQuestion(
        id = "q-$index",
        questionNumber = index + 1,
        type = type,
        questionText = "Question $index",
        options = listOf(
            OIROption("opt_a", "A"),
            OIROption("opt_b", "B"),
            OIROption("opt_c", "C"),
            OIROption("opt_d", "D")
        ),
        correctAnswerId = "opt_a",
        explanation = "Explanation",
        difficulty = QuestionDifficulty.MEDIUM,
        timeSeconds = 60
    )
}
