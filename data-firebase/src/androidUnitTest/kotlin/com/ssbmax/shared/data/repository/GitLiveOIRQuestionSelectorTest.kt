package com.ssbmax.shared.data.repository

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.ssbmax.shared.db.SharedDatabase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import kotlin.time.Clock

/**
 * Exercises GitLiveOIRQuestionSelector's SQLDelight-only surface (type-distribution
 * selection, toEntity/toDomain round-trip, validator-based dud filtering) against a
 * real in-memory SQLite DB, seeded directly via the generated queries.
 */
class GitLiveOIRQuestionSelectorTest {

    private lateinit var database: SharedDatabase
    private lateinit var selector: GitLiveOIRQuestionSelector

    @Before
    fun setup() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        SharedDatabase.Schema.create(driver)
        database = SharedDatabase(driver)
        selector = GitLiveOIRQuestionSelector(database)
    }

    private fun seedValidQuestion(
        id: String,
        type: String,
        difficulty: String = "MEDIUM",
        usageCount: Long = 0L,
        lastUsed: Long? = null
    ) {
        database.sharedDatabaseQueries.insertOrReplaceOIRQuestion(
            id = id,
            questionNumber = 1L,
            type = type,
            subtype = null,
            questionText = "This is a valid question text for $id",
            optionsJson = """[{"id":"opt_a","text":"A"},{"id":"opt_b","text":"B"},{"id":"opt_c","text":"C"},{"id":"opt_d","text":"D"}]""",
            correctAnswerId = "opt_a",
            explanation = "Because A is correct.",
            questionImageUrl = null,
            difficulty = difficulty,
            tags = "",
            batchId = "batch_pdf_001",
            cachedAt = 0L,
            lastUsed = lastUsed,
            usageCount = usageCount,
            correctAnswerIds = null
        )
    }

    /** Missing options -- fails OIRQuestionValidator, must be skipped at selection. */
    private fun seedInvalidQuestion(id: String, type: String) {
        database.sharedDatabaseQueries.insertOrReplaceOIRQuestion(
            id = id,
            questionNumber = 1L,
            type = type,
            subtype = null,
            questionText = "",
            optionsJson = "[]",
            correctAnswerId = "",
            explanation = "",
            questionImageUrl = null,
            difficulty = "MEDIUM",
            tags = "",
            batchId = "batch_pdf_001",
            cachedAt = 0L,
            lastUsed = null,
            usageCount = 0L,
            correctAnswerIds = null
        )
    }

    @Test
    fun `selectQuestions maintains the V40NV40N20 distribution`() = runTest {
        // Why this matters: OIRQuestionDistribution is the SSOT for the test's required
        // type mix -- a selector that ignores it would silently break test fairness.
        repeat(30) { i -> seedValidQuestion("v$i", "VERBAL_REASONING") }
        repeat(30) { i -> seedValidQuestion("nv$i", "NON_VERBAL_REASONING") }
        repeat(30) { i -> seedValidQuestion("n$i", "NUMERICAL_ABILITY") }

        val result = selector.selectQuestions(count = 50)

        assertTrue(result.isSuccess)
        val questions = result.getOrThrow()
        assertEquals(50, questions.size)
        val verbalCount = questions.count { it.type.name == "VERBAL_REASONING" }
        val nonVerbalCount = questions.count { it.type.name == "NON_VERBAL_REASONING" }
        val numericalCount = questions.count { it.type.name == "NUMERICAL_ABILITY" }
        assertEquals(20, verbalCount) // 40% of 50
        assertEquals(20, nonVerbalCount) // 40% of 50
        assertEquals(10, numericalCount) // 20% of 50
    }

    @Test
    fun `selectQuestions ignores legacy difficulty values and missing difficulty metadata`() = runTest {
        // Why this matters: difficulty is legacy metadata, so every valid record must remain
        // eligible regardless of whether the cache contains EASY, HARD, or no value at all.
        repeat(20) { i -> seedValidQuestion("v_easy_$i", "VERBAL_REASONING", "EASY") }
        repeat(20) { i -> seedValidQuestion("v_missing_$i", "VERBAL_REASONING", "") }
        repeat(30) { i -> seedValidQuestion("nv_hard_$i", "NON_VERBAL_REASONING", "HARD") }
        repeat(20) { i -> seedValidQuestion("n_missing_$i", "NUMERICAL_ABILITY", "") }

        val result = selector.selectQuestions(count = 50)

        assertTrue(result.isSuccess)
        assertEquals(20, result.getOrThrow().count { it.type == com.ssbmax.shared.domain.model.OIRQuestionType.VERBAL_REASONING })
        assertEquals(20, result.getOrThrow().count { it.type == com.ssbmax.shared.domain.model.OIRQuestionType.NON_VERBAL_REASONING })
        assertEquals(10, result.getOrThrow().count { it.type == com.ssbmax.shared.domain.model.OIRQuestionType.NUMERICAL_ABILITY })
    }

    @Test
    fun `toDomain tolerates malformed legacy difficulty metadata`() = runTest {
        val entity = selector.toEntity(
            mapOf(
                "id" to "legacy-missing-difficulty",
                "type" to "VERBAL_REASONING",
                "questionText" to "Pick the valid option",
                "options" to listOf(
                    mapOf("id" to "opt_a", "text" to "A"),
                    mapOf("id" to "opt_b", "text" to "B")
                ),
                "correctAnswerId" to "opt_a",
                "difficulty" to "NOT_A_DIFFICULTY"
            ),
            batchId = "batch_pdf_001",
            index = 0,
            cachedAt = 1000L
        )

        assertEquals(com.ssbmax.shared.domain.model.QuestionDifficulty.MEDIUM, selector.toDomain(entity).difficulty)
    }

    @Test
    fun `selectQuestions prefers questions unused within the last seven days`() = runTest {
        val recentlyUsed = Clock.System.now().toEpochMilliseconds()
        repeat(25) { i -> seedValidQuestion("v_recent_$i", "VERBAL_REASONING", lastUsed = recentlyUsed) }
        repeat(25) { i -> seedValidQuestion("v_unused_$i", "VERBAL_REASONING") }
        repeat(25) { i -> seedValidQuestion("nv_$i", "NON_VERBAL_REASONING") }
        repeat(15) { i -> seedValidQuestion("n_$i", "NUMERICAL_ABILITY") }

        val selected = selector.selectQuestions(count = 50).getOrThrow()

        assertEquals(20, selected.count { it.type.name == "VERBAL_REASONING" })
        assertTrue(selected.none { it.id.startsWith("v_recent_") })
    }

    @Test
    fun `selectQuestions skips structurally-invalid questions rather than serving them`() = runTest {
        // Why this matters: duds (missing options/text) already sitting in the cache must never
        // reach a live test -- the validator is the single source of truth for "is this usable."
        seedInvalidQuestion("bad1", "VERBAL_REASONING")
        repeat(5) { i -> seedValidQuestion("good$i", "VERBAL_REASONING") }
        repeat(5) { i -> seedValidQuestion("nv$i", "NON_VERBAL_REASONING") }
        repeat(5) { i -> seedValidQuestion("n$i", "NUMERICAL_ABILITY") }

        val result = selector.selectQuestions(count = 10)

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().none { it.id == "bad1" })
    }

    @Test
    fun `selectQuestions fails honestly when the cache is entirely empty`() = runTest {
        val result = selector.selectQuestions(count = 10)

        assertTrue(result.isSuccess) // empty pools just yield an empty (not failing) selection
        assertEquals(0, result.getOrThrow().size)
    }

    @Test
    fun `toEntity without difficulty still maps to a valid domain question`() = runTest {
        val entity = selector.toEntity(
            mapOf(
                "id" to "oir_q_missing_difficulty",
                "type" to "VERBAL_REASONING",
                "questionText" to "Pick the odd one out",
                "options" to listOf(
                    mapOf("id" to "opt_a", "text" to "Cat"),
                    mapOf("id" to "opt_b", "text" to "Car")
                ),
                "correctAnswerId" to "opt_b"
            ),
            batchId = "batch_pdf_001",
            index = 0,
            cachedAt = 1000L
        )

        assertEquals("", entity.difficulty)
        assertEquals(com.ssbmax.shared.domain.model.QuestionDifficulty.MEDIUM, selector.toDomain(entity).difficulty)
    }

    @Test
    fun `toEntity then toDomain round-trips options and correctAnswerIds`() = runTest {
        // Why this matters: the Firestore-map-shaped input (toEntityMap's output) must survive
        // the JSON round trip losslessly -- a broken options/correctAnswerIds encode would corrupt
        // every multi-select question silently.
        val map: Map<String, Any?> = mapOf(
            "id" to "oir_q_0001",
            "questionNumber" to 1,
            "type" to "VERBAL_REASONING",
            "questionText" to "Pick the odd one out",
            "options" to listOf(
                mapOf("id" to "opt_a", "text" to "Cat", "imageUrl" to null),
                mapOf("id" to "opt_b", "text" to "Dog", "imageUrl" to null),
                mapOf("id" to "opt_c", "text" to "Car", "imageUrl" to null)
            ),
            "correctAnswerId" to "opt_c",
            "correctAnswerIds" to listOf("opt_c"),
            "explanation" to "Car is not an animal.",
            "difficulty" to "EASY",
            "tags" to listOf("odd-one-out", "verbal")
        )

        val entity = selector.toEntity(map, batchId = "batch_pdf_001", index = 0, cachedAt = 1000L)
        val domain = selector.toDomain(entity)

        assertEquals("oir_q_0001", domain.id)
        assertEquals(3, domain.options.size)
        assertEquals("opt_c", domain.correctAnswerId)
        assertEquals(listOf("opt_c"), domain.correctAnswerIds)
        assertEquals("odd-one-out,verbal", entity.tags)
    }
}
