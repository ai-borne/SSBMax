package com.ssbmax.shared.data.repository

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.ssbmax.shared.db.SharedDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Exercises GitLiveOIRQuestionCacheManager's SQLDelight-only surface (question-cache
 * queries, batch/sync metadata, status math) against a real in-memory SQLite DB, seeded
 * directly via the generated queries -- `downloadBatch`/`initialSync`/`fetchMetaConfig`'s
 * Firestore reads need a live/emulated backend outside this JVM unit test's reach, same
 * category of gap as the GTO/WAT manager tests. `getTestQuestions` is exercised with a
 * pool already at/above the requested count so it never calls `initialSync` internally.
 */
class GitLiveOIRQuestionCacheManagerTest {

    private lateinit var database: SharedDatabase
    private lateinit var manager: GitLiveOIRQuestionCacheManager

    @Before
    fun setup() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        SharedDatabase.Schema.create(driver)
        database = SharedDatabase(driver)
        manager = GitLiveOIRQuestionCacheManager(database, GitLiveOIRQuestionSelector(database), CoroutineScope(SupervisorJob() + Dispatchers.Unconfined))
    }

    private fun seedQuestion(id: String, type: String, usageCount: Long = 0L) {
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
            difficulty = "MEDIUM",
            tags = "",
            batchId = "batch_pdf_001",
            cachedAt = 0L,
            lastUsed = null,
            usageCount = usageCount,
            correctAnswerIds = null
        )
    }

    private fun seedFullPool() {
        repeat(30) { i -> seedQuestion("v$i", "VERBAL_REASONING") }
        repeat(30) { i -> seedQuestion("nv$i", "NON_VERBAL_REASONING") }
        repeat(30) { i -> seedQuestion("n$i", "NUMERICAL_ABILITY") }
    }

    @Test
    fun `getTestQuestions delegates to the selector and returns the requested count`() = runTest {
        seedFullPool()

        val result = manager.getTestQuestions(count = 50)

        assertTrue(result.isSuccess)
        assertEquals(50, result.getOrThrow().size)
    }

    @Test
    fun `markQuestionsUsed increments usage count and stamps lastUsed`() = runTest {
        seedFullPool()

        manager.markQuestionsUsed(listOf("v0", "v1"))

        val row = database.sharedDatabaseQueries.selectOIRQuestionsByType("VERBAL_REASONING", 30).executeAsList()
            .first { it.id == "v0" }
        assertEquals(1L, row.usageCount)
        assertTrue(row.lastUsed != null)
    }

    @Test
    fun `getCacheStatus reports total and per-type counts plus last sync time`() = runTest {
        seedFullPool()
        database.sharedDatabaseQueries.insertOrReplaceOIRBatchMetadata(
            batchId = "batch_pdf_001", downloadedAt = 314L, questionCount = 90, version = "1.0.0"
        )

        val status = manager.getCacheStatus()

        assertEquals(90, status.cachedQuestions)
        assertEquals(1, status.batchesDownloaded)
        assertEquals(314L, status.lastSyncTime)
        assertEquals(30, status.verbalCount)
        assertEquals(30, status.nonVerbalCount)
        assertEquals(30, status.numericalCount)
        assertEquals(0, status.spatialCount) // bank has zero SPATIAL_REASONING questions, see OIRQuestionDistribution
    }

    @Test
    fun `clearCache empties both the question and batch-metadata tables`() = runTest {
        seedFullPool()
        database.sharedDatabaseQueries.insertOrReplaceOIRBatchMetadata(
            batchId = "batch_pdf_001", downloadedAt = 1L, questionCount = 90, version = "1.0.0"
        )

        val result = manager.clearCache()

        assertTrue(result.isSuccess)
        assertEquals(0L, database.sharedDatabaseQueries.selectTotalOIRQuestionCount().executeAsOne())
        assertEquals(0, database.sharedDatabaseQueries.selectAllOIRBatchMetadata().executeAsList().size)
    }
}
