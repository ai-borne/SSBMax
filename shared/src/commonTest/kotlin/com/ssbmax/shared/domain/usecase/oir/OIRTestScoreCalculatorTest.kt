package com.ssbmax.shared.domain.usecase.oir

import kotlin.time.Clock

import com.ssbmax.shared.domain.model.OIRAnswer
import com.ssbmax.shared.domain.model.OIROption
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRQuestionType
import com.ssbmax.shared.domain.model.OIRTestSession
import com.ssbmax.shared.domain.model.QuestionDifficulty
import com.ssbmax.shared.domain.util.NoOpLogger
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.BeforeTest
import kotlin.test.Test

/**
 * Phase 2 (Web SSB Test Flow Parity plan): `calculate` no longer trusts
 * `OIRQuestion.correctAnswerId`/`OIRAnswer.isCorrect` -- correctness is an
 * explicit `correctnessByQuestionId` input (what `evaluateOIRAnswers` would
 * return server-side). These tests exercise `calculate`'s aggregation logic
 * (score/category/skip counting, answered-questions building) given that
 * input, not the correctness comparison itself (that now lives entirely in
 * `functions/src/oirScoring.js`, tested there).
 */
class OIRTestScoreCalculatorTest {

    private lateinit var calculator: OIRTestScoreCalculator

    @BeforeTest
    fun setUp() {
        calculator = OIRTestScoreCalculator(NoOpLogger())
    }

    // --- Helpers ---

    private fun options() = listOf(
        OIROption("opt_a", "1"),
        OIROption("opt_b", "2"),
        OIROption("opt_c", "3"),
        OIROption("opt_d", "4"),
        OIROption("opt_e", "5"),
    )

    private fun multiSelectQuestion(id: String = "q1") = OIRQuestion(
        id = id,
        questionNumber = 1,
        type = OIRQuestionType.NON_VERBAL_REASONING,
        questionText = "Which two figures belong to Class A?",
        options = options(),
        correctAnswerId = "",
        explanation = "Answer: 2 and 3.",
        difficulty = QuestionDifficulty.MEDIUM,
        correctAnswerIds = listOf("opt_b", "opt_c"),
    )

    private fun singleSelectQuestion(id: String = "q2") = OIRQuestion(
        id = id,
        questionNumber = 2,
        type = OIRQuestionType.VERBAL_REASONING,
        questionText = "Which figure completes the pattern?",
        options = options(),
        correctAnswerId = "opt_a",
        explanation = "Option 1 is correct.",
        difficulty = QuestionDifficulty.EASY,
    )

    private fun session(
        questions: List<OIRQuestion>,
        answers: Map<String, OIRAnswer>,
    ) = OIRTestSession(
        sessionId = "s1",
        userId = "user1",
        testId = "oir_standard",
        questions = questions,
        answers = answers,
        startTime = Clock.System.now().toEpochMilliseconds() - 60_000,
        timeRemainingSeconds = 0,
    )

    // --- calculate() aggregation, given a server-supplied correctness map ---

    @Test
    fun calculate_correctAnswer_scoresOnePointAndFullPercentage() {
        val question = singleSelectQuestion()
        val result = calculator.calculate(
            session(listOf(question), mapOf("q2" to OIRAnswer("q2", "opt_a"))),
            correctnessByQuestionId = mapOf("q2" to true)
        )

        assertEquals(1, result.rawScore)
        assertEquals(100f, result.percentageScore)
    }

    @Test
    fun calculate_difficultyDoesNotChangeScore() {
        val easy = singleSelectQuestion()
        val hard = singleSelectQuestion("q3").copy(difficulty = QuestionDifficulty.HARD)
        val result = calculator.calculate(
            session(
                listOf(easy, hard),
                mapOf("q2" to OIRAnswer("q2", "opt_a"), "q3" to OIRAnswer("q3", "opt_a"))
            ),
            correctnessByQuestionId = mapOf("q2" to true, "q3" to true)
        )

        assertEquals(2, result.rawScore)
        assertEquals(100f, result.percentageScore)
    }

    @Test
    fun calculate_tenCorrectAnswersInFiftyQuestions_scoresTenAndTwentyPercent() {
        val questions = (1..50).map { index ->
            singleSelectQuestion("q$index").copy(questionNumber = index)
        }
        val answers = questions.associate { question ->
            question.id to OIRAnswer(question.id, if (question.questionNumber <= 10) "opt_a" else "opt_b")
        }
        val correctness = questions.associate { it.id to (it.questionNumber <= 10) }

        val result = calculator.calculate(session(questions, answers), correctness)

        assertEquals(10, result.rawScore)
        assertEquals(20f, result.percentageScore)
    }

    @Test
    fun calculate_emptySessionReturnsSafeEmptyResult() {
        val result = calculator.calculate(session(emptyList(), emptyMap()), emptyMap())

        assertEquals(0, result.rawScore)
        assertEquals(0f, result.percentageScore)
        assertEquals(0, result.totalQuestions)
    }

    @Test
    fun calculate_missingQuestionIdInCorrectnessMap_defaultsToIncorrect() {
        // Server response never mentioned this question id -- must never default to "correct".
        val question = singleSelectQuestion()
        val result = calculator.calculate(
            session(listOf(question), mapOf("q2" to OIRAnswer("q2", "opt_a"))),
            correctnessByQuestionId = emptyMap()
        )

        assertEquals(0, result.rawScore)
        assertFalse(result.answeredQuestions.first().isCorrect)
    }

    @Test
    fun calculate_categoryScoresPreserveCountsAndAverageTiming() {
        val verbal = singleSelectQuestion("verbal").copy(type = OIRQuestionType.VERBAL_REASONING)
        val numerical = singleSelectQuestion("numerical").copy(type = OIRQuestionType.NUMERICAL_ABILITY)
        val result = calculator.calculate(
            session(
                listOf(verbal, numerical),
                mapOf(
                    "verbal" to OIRAnswer("verbal", "opt_a", timeTakenSeconds = 20),
                    "numerical" to OIRAnswer("numerical", "opt_b", timeTakenSeconds = 40),
                )
            ),
            correctnessByQuestionId = mapOf("verbal" to true, "numerical" to false)
        )

        assertEquals(1, result.categoryScores[OIRQuestionType.VERBAL_REASONING]?.correctAnswers)
        assertEquals(20, result.categoryScores[OIRQuestionType.VERBAL_REASONING]?.averageTimeSeconds)
        assertEquals(0, result.categoryScores[OIRQuestionType.NUMERICAL_ABILITY]?.correctAnswers)
        assertEquals(40, result.categoryScores[OIRQuestionType.NUMERICAL_ABILITY]?.averageTimeSeconds)
    }

    @Test
    fun calculate_incorrectAndSkippedScoreZeroAndRemainCounted() {
        val correct = singleSelectQuestion("correct")
        val incorrect = singleSelectQuestion("incorrect")
        val skipped = singleSelectQuestion("skipped")
        val result = calculator.calculate(
            session(
                listOf(correct, incorrect, skipped),
                mapOf(
                    "correct" to OIRAnswer("correct", "opt_a"),
                    "incorrect" to OIRAnswer("incorrect", "opt_b"),
                    "skipped" to OIRAnswer("skipped", null, skipped = true),
                )
            ),
            correctnessByQuestionId = mapOf("correct" to true, "incorrect" to false, "skipped" to false)
        )

        assertEquals(1, result.rawScore)
        assertEquals(1, result.correctAnswers)
        assertEquals(1, result.incorrectAnswers)
        assertEquals(1, result.skippedQuestions)
    }

    @Test
    fun calculate_multiSelectCorrect_countsInScore() {
        val question = multiSelectQuestion()
        val answer = OIRAnswer(
            questionId = "q1",
            selectedOptionId = null,
            selectedOptionIds = setOf("opt_b", "opt_c"),
        )
        val result = calculator.calculate(
            session(listOf(question), mapOf("q1" to answer)),
            correctnessByQuestionId = mapOf("q1" to true)
        )
        assertEquals(1, result.correctAnswers)
        assertEquals(0, result.incorrectAnswers)
    }

    @Test
    fun calculate_multiSelectWrong_notCountedInScore() {
        val question = multiSelectQuestion()
        val answer = OIRAnswer(
            questionId = "q1",
            selectedOptionId = null,
            selectedOptionIds = setOf("opt_a", "opt_d"),
        )
        val result = calculator.calculate(
            session(listOf(question), mapOf("q1" to answer)),
            correctnessByQuestionId = mapOf("q1" to false)
        )
        assertEquals(0, result.correctAnswers)
        assertEquals(1, result.incorrectAnswers)
    }

    @Test
    fun calculate_multiSelectQuestion_includedInAnsweredQuestions() {
        val question = multiSelectQuestion()
        val answer = OIRAnswer(
            questionId = "q1",
            selectedOptionId = null,
            selectedOptionIds = setOf("opt_b", "opt_c"),
        )
        val result = calculator.calculate(
            session(listOf(question), mapOf("q1" to answer)),
            correctnessByQuestionId = mapOf("q1" to true)
        )
        assertEquals(1, result.answeredQuestions.size)
        val answered = result.answeredQuestions.first()
        assertEquals(listOf("opt_b", "opt_c"), answered.correctOptions.map { it.id })
        assertEquals(setOf("opt_b", "opt_c"), answered.selectedOptions.map { it.id }.toSet())
    }

    @Test
    fun calculate_ignoresStaleIsCorrectOnAnswer_usesCorrectnessMapInstead() {
        // The ViewModel may set isCorrect on the local OIRAnswer optimistically/incorrectly;
        // the calculator must always defer to the server-supplied correctness map.
        val question = multiSelectQuestion()
        val answer = OIRAnswer(
            questionId = "q1",
            selectedOptionId = null,
            selectedOptionIds = setOf("opt_a", "opt_e"), // wrong pair
            isCorrect = true, // stale / wrong pre-computed value
        )
        val result = calculator.calculate(
            session(listOf(question), mapOf("q1" to answer)),
            correctnessByQuestionId = mapOf("q1" to false) // server says wrong
        )
        assertEquals(0, result.correctAnswers)
        assertFalse(result.answeredQuestions.first().isCorrect)
    }
}
