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
 * Exercises GitLiveTestContentRepository's OIR/WAT/SRT delegation against a real in-memory
 * SQLite DB via a single shared [SharedDatabase], same pattern as every other repository
 * test in this suite. PPDT/GPE/TAT/SDT and the direct GTO-topic Firestore reads are covered
 * in [GitLiveTestContentRepositoryContentTest] -- split across two files to respect this
 * repo's 300-line-per-file limit, not a difference in testing approach.
 *
 * Cache managers' `initialSync`/`downloadBatch` need a live/emulated Firestore backend
 * outside this JVM unit test's reach (same documented gap as `GitLiveWATWordCacheManagerTest`
 * etc.), so those paths are exercised only for their honest-degradation/mock-fallback
 * behavior, not a successful Firestore round-trip.
 */
class GitLiveTestContentRepositoryTest {

    private lateinit var database: SharedDatabase
    private lateinit var repository: GitLiveTestContentRepository

    @Before
    fun setup() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        SharedDatabase.Schema.create(driver)
        database = SharedDatabase(driver)
        repository = GitLiveTestContentRepository(
            oirCacheManager = GitLiveOIRQuestionCacheManager(database, GitLiveOIRQuestionSelector(database), CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)),
            watWordCacheManager = GitLiveWATWordCacheManager(database),
            srtSituationCacheManager = GitLiveSRTSituationCacheManager(database),
            ppdtImageCacheManager = GitLivePPDTImageCacheManager(database),
            gpeImageCacheManager = GitLiveGPEImageCacheManager(database),
            tatImageCacheManager = GitLiveTATImageCacheManager(database)
        )
    }

    // ==================== OIR ====================

    @Test
    fun `getOIRTestQuestions delegates to the cache manager once the pool is seeded`() = runTest {
        // Why this matters: the repository must not reimplement type-distribution
        // selection itself -- it exists purely to orchestrate the cache manager.
        repeat(30) { i -> seedOirQuestion("v$i", "VERBAL_REASONING") }
        repeat(30) { i -> seedOirQuestion("nv$i", "NON_VERBAL_REASONING") }
        repeat(30) { i -> seedOirQuestion("n$i", "NUMERICAL_ABILITY") }

        val result = repository.getOIRTestQuestions(count = 50)

        assertTrue(result.isSuccess)
        assertEquals(50, result.getOrThrow().size)
    }

    @Test
    fun `getOIRTestQuestions fails when cache and Firestore are unavailable`() = runTest {
        // Why this matters: first-run content must fail closed. A successful empty list
        // would let callers mistake a partial sync for a usable 50-question test.
        val result = repository.getOIRTestQuestions(count = 50)

        assertTrue(result.isFailure)
    }

    @Suppress("DEPRECATION")
    @Test
    fun `deprecated getOIRQuestions delegates to getOIRTestQuestions`() = runTest {
        repeat(30) { i -> seedOirQuestion("v$i", "VERBAL_REASONING") }
        repeat(30) { i -> seedOirQuestion("nv$i", "NON_VERBAL_REASONING") }
        repeat(30) { i -> seedOirQuestion("n$i", "NUMERICAL_ABILITY") }

        val result = repository.getOIRQuestions(testId = "ignored")

        assertTrue(result.isSuccess)
        assertEquals(50, result.getOrThrow().size)
    }

    @Test
    fun `markOIRQuestionsUsed delegates and increments usage on the underlying row`() = runTest {
        seedOirQuestion("v0", "VERBAL_REASONING")

        val result = repository.markOIRQuestionsUsed(listOf("v0"))

        assertTrue(result.isSuccess)
        val row = database.sharedDatabaseQueries.selectOIRQuestionsByType("VERBAL_REASONING", 30).executeAsList()
            .first { it.id == "v0" }
        assertEquals(1L, row.usageCount)
    }

    @Test
    fun `getOIRCacheStatus reports the seeded question count`() = runTest {
        seedOirQuestion("v0", "VERBAL_REASONING")

        val status = repository.getOIRCacheStatus()

        assertEquals(1, status.cachedQuestions)
    }

    // ==================== WAT / SRT (mock fallback + cached path) ====================

    @Test
    fun `getWATQuestions returns the mock fallback when the cache is empty`() = runTest {
        // Why this matters: a candidate must always get a usable test, even before the
        // WAT cache has ever synced -- this is the resilience path the Android original
        // shipped, not dead scaffolding.
        val result = repository.getWATQuestions(testId = "ignored")

        assertTrue(result.isSuccess)
        assertEquals(20, result.getOrThrow().size)
        assertTrue(result.getOrThrow().all { it.id.startsWith("wat_mock_") })
    }

    @Test
    fun `getWATQuestions returns real cached words once the cache is seeded`() = runTest {
        repeat(20) { i -> seedWatWord("w$i", i.toLong()) }

        val result = repository.getWATQuestions(testId = "ignored")

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().none { it.id.startsWith("wat_mock_") })
    }

    @Test
    fun `getSRTQuestions returns the mock fallback when the cache is empty`() = runTest {
        val result = repository.getSRTQuestions(testId = "ignored")

        assertTrue(result.isSuccess)
        assertEquals(10, result.getOrThrow().size)
        assertTrue(result.getOrThrow().all { it.id.startsWith("srt_mock_") })
    }

    @Test
    fun `getSRTQuestions returns real cached situations once the cache is seeded`() = runTest {
        repeat(20) { i -> seedSrtSituation("s$i", i.toLong()) }

        val result = repository.getSRTQuestions(testId = "ignored")

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().none { it.id.startsWith("srt_mock_") })
    }

    // ==================== seed helpers ====================

    private fun seedOirQuestion(id: String, type: String) {
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
            usageCount = 0L,
            correctAnswerIds = null
        )
    }

    private fun seedWatWord(id: String, seq: Long) {
        database.sharedDatabaseQueries.insertOrReplaceWATWord(
            id = id,
            word = "word-$id",
            sequenceNumber = seq,
            timeAllowedSeconds = 15L,
            category = "leadership",
            difficulty = "medium",
            batchId = "batch_001",
            cachedAt = 0L,
            lastUsed = null,
            usageCount = 0L
        )
    }

    private fun seedSrtSituation(id: String, seq: Long) {
        database.sharedDatabaseQueries.insertOrReplaceSRTSituation(
            id = id,
            situation = "Situation $id",
            sequenceNumber = seq,
            category = "GENERAL",
            timeAllowedSeconds = 30L,
            difficulty = "medium",
            batchId = "batch_001",
            cachedAt = 0L,
            lastUsed = null,
            usageCount = 0L
        )
    }
}
