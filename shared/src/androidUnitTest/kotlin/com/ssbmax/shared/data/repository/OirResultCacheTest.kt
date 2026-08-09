package com.ssbmax.shared.data.repository

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.QuestionDifficulty
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Exercises the SQLDelight cache against a real in-memory SQLite DB (JVM
 * driver) — closes the Phase 0 exit report's flagged gap ("SQLDelight
 * unexercised at runtime") without needing an Android emulator/iOS simulator.
 * Why this matters: a cache that only compiles but never round-trips data is
 * exactly the kind of silent migration failure the plan's regression strategy
 * warns about.
 */
class OirResultCacheTest {

    private lateinit var cache: OirResultCache

    @Before
    fun setup() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        SharedDatabase.Schema.create(driver)
        cache = OirResultCache(SharedDatabase(driver))
    }

    @Test
    fun `cache miss returns null`() {
        assertNull(cache.get("unknown-submission"))
    }

    @Test
    fun `put then get round-trips the full result, not just percentage`() {
        val dto = OirTestResultDto(
            testId = "test-1",
            sessionId = "session-1",
            userId = "user-1",
            totalQuestions = 50,
            correctAnswers = 40,
            incorrectAnswers = 5,
            skippedQuestions = 5,
            timeTakenSeconds = 1200,
            rawScore = 40,
            percentageScore = 80f,
            categoryScores = mapOf(
                "VERBAL" to OirCategoryScoreDto(totalQuestions = 25, correctAnswers = 20, percentage = 80f)
            ),
            completedAt = 1_700_000_000_000L
        )

        cache.put("submission-1", dto)
        val cached = cache.get("submission-1")

        assertEquals(dto, cached)
    }

    @Test
    fun `legacy weighted raw score is normalized to correct answers when loaded`() {
        val dto = OirTestResultDto(
            totalQuestions = 50,
            correctAnswers = 10,
            rawScore = 20,
            percentageScore = 20f
        )

        val result = dto.toDomain()

        assertEquals(10, result.rawScore)
        assertEquals(10, result.correctAnswers)
    }

    @Test
    fun `new cache serialization omits legacy difficulty breakdown`() {
        val dto = OirTestResultDto(correctAnswers = 10, rawScore = 10, percentageScore = 20f)

        val encoded = Json.encodeToString(OirTestResultDto.serializer(), dto)

        assertFalse(encoded.contains("difficultyBreakdown"))
    }

    @Test
    fun `legacy cached result with difficulty breakdown remains readable`() {
        val dto = OirTestResultDto(
            totalQuestions = 50,
            correctAnswers = 40,
            rawScore = 40,
            percentageScore = 80f,
            difficultyBreakdown = mapOf(
                "HARD" to OirDifficultyScoreDto(10, 8, 80f),
                "NOT_A_DIFFICULTY" to OirDifficultyScoreDto()
            )
        )

        cache.put("legacy-submission", dto)

        val cached = cache.get("legacy-submission")
        assertNotNull(cached)
        assertEquals(dto, cached)
        assertEquals(dto.toDomain(), cached?.toDomain())
        assertEquals(2, cached?.difficultyBreakdown?.size)
    }

    @Test
    fun `answer review without legacy question difficulty still loads`() {
        val answered = OirAnsweredQuestionDto(
            question = OirQuestionDto(
                id = "q1",
                type = "VERBAL_REASONING",
                questionText = "Question",
                correctAnswerId = "a",
                difficulty = ""
            )
        )

        val result = OirTestResultDto(answeredQuestions = listOf(answered)).toDomain()

        assertEquals(1, result.answeredQuestions.size)
        assertEquals(QuestionDifficulty.MEDIUM, result.answeredQuestions.single().question.difficulty)
    }

    @Test
    fun `insertOrReplace overwrites the previous cached value for the same id`() {
        val first = OirTestResultDto(percentageScore = 50f)
        val second = OirTestResultDto(percentageScore = 90f)

        cache.put("submission-2", first)
        cache.put("submission-2", second)

        assertEquals(90f, cache.get("submission-2")?.percentageScore)
    }
}
