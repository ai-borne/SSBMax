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
 * Exercises GitLiveTestContentRepository's PPDT/GPE/TAT/SDT delegation and the direct
 * (uncached) GTO-topic Firestore reads. Split from [GitLiveTestContentRepositoryTest]
 * (which covers OIR/WAT/SRT) purely to respect this repo's 300-line-per-file limit --
 * same DB/repository setup and same documented Firestore-reach gap as that file.
 */
class GitLiveTestContentRepositoryContentTest {

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

    // ==================== PPDT (per-testId session cache) ====================

    @Test
    fun `getPPDTQuestions returns the mock fallback when the cache is empty`() = runTest {
        val result = repository.getPPDTQuestions(testId = "session-1")

        assertTrue(result.isSuccess)
        assertEquals(1, result.getOrThrow().size)
        assertEquals("ppdt_mock_1", result.getOrThrow().first().id)
    }

    @Test
    fun `getPPDTQuestions caches its result per testId so a repeat call skips the manager`() = runTest {
        repeat(5) { i -> seedPpdtImage("p$i") }

        val first = repository.getPPDTQuestions(testId = "session-1").getOrThrow()
        val second = repository.getPPDTQuestions(testId = "session-1").getOrThrow()

        // Why this matters: getImageForTest marks an image "used" on every real call, so
        // calling it twice for the same test session would silently burn two images from
        // the pool instead of reusing the one already assigned to this session.
        assertEquals(first, second)
        val usageCount = database.sharedDatabaseQueries.selectPPDTImageById(first.first().id).executeAsOne().usageCount
        assertEquals(1L, usageCount)
    }

    @Test
    fun `getPPDTQuestion by id finds a session-cached question without calling the manager`() = runTest {
        val result = repository.getPPDTQuestions(testId = "session-1")
        val cachedId = result.getOrThrow().first().id

        val byId = repository.getPPDTQuestion(questionId = cachedId)

        assertTrue(byId.isSuccess)
        assertEquals(cachedId, byId.getOrThrow().id)
    }

    @Test
    fun `clearCache empties the per-testId PPDT session cache`() = runTest {
        repository.getPPDTQuestions(testId = "session-1")

        repository.clearCache()

        // The mock question's id was never written to the DB, so once the session cache is
        // cleared, looking it up by id must fail rather than silently succeed from memory.
        val byId = repository.getPPDTQuestion(questionId = "ppdt_mock_1")
        assertTrue(byId.isFailure)
    }

    // ==================== GPE ====================

    @Test
    fun `getGPEQuestions returns the mock fallback when the cache is empty`() = runTest {
        val result = repository.getGPEQuestions(testId = "session-1")

        assertTrue(result.isSuccess)
        assertEquals("gpe_generated_1", result.getOrThrow().first().id)
    }

    @Test
    fun `getGPEQuestions returns and session-caches a real image once seeded above the manager's min cache size`() = runTest {
        // GPEImageCacheManager.getImageForTest re-syncs whenever the pool is below its own
        // MIN_CACHE_SIZE (5) -- seeding fewer than that would (correctly) trigger a resync
        // attempt that fails without a live Firestore, falling through to the mock. Seeding
        // at the threshold exercises the real cached-image path instead.
        repeat(5) { i -> seedGpeImage("g$i") }

        val result = repository.getGPEQuestions(testId = "session-1")

        assertTrue(result.isSuccess)
        assertTrue(result.getOrThrow().none { it.id == "gpe_generated_1" })
    }

    // ==================== TAT ====================

    @Test
    fun `getTATQuestions returns the mock fallback when Firestore is unreachable`() = runTest {
        // initialSync is called unconditionally on every call (matches the Android
        // original); with an empty cache and no live Firestore this always fails through
        // to the mock pool.
        val result = repository.getTATQuestions(testId = "session-1")

        assertTrue(result.isSuccess)
        assertEquals(12, result.getOrThrow().size)
    }

    // ==================== SDT (no Firestore involvement) ====================

    @Test
    fun `getSDTQuestions always returns the 4 standard questions`() = runTest {
        val result = repository.getSDTQuestions(testId = "ignored")

        assertTrue(result.isSuccess)
        assertEquals(4, result.getOrThrow().size)
    }

    // ==================== GTO topics (direct, uncached Firestore reads) ====================

    @Test
    fun `getRandomGDTopic fails honestly without a live Firestore backend`() = runTest {
        val result = repository.getRandomGDTopic()

        assertTrue(result.isFailure)
    }

    @Test
    fun `getRandomLecturetteTopics fails honestly without a live Firestore backend`() = runTest {
        val result = repository.getRandomLecturetteTopics(count = 4)

        assertTrue(result.isFailure)
    }

    // ==================== seed helpers ====================

    private fun seedPpdtImage(id: String) {
        database.sharedDatabaseQueries.insertOrReplacePPDTImage(
            id = id,
            imageUrl = "https://example.com/$id.jpg",
            imageDescription = "desc-$id",
            imageContextJson = "{}",
            viewingTimeSeconds = 30L,
            writingTimeMinutes = 4L,
            minCharacters = 200L,
            maxCharacters = 1000L,
            category = null,
            difficulty = null,
            batchId = "batch_001",
            cachedAt = 0L,
            lastUsed = null,
            usageCount = 0L,
            genderTag = "MIXED"
        )
    }

    private fun seedGpeImage(id: String) {
        database.sharedDatabaseQueries.insertOrReplaceGPEImage(
            id = id,
            imageUrl = "https://example.com/$id.jpg",
            scenario = "Tactical scenario for $id",
            solution = "Cross the river using the rope and planks.",
            imageDescription = "desc-$id",
            resources = null,
            viewingTimeSeconds = 60L,
            planningTimeSeconds = 1740L,
            minCharacters = 500L,
            maxCharacters = 2000L,
            category = "river_crossing",
            difficulty = "medium",
            batchId = "batch_001",
            cachedAt = 0L,
            lastUsed = null,
            usageCount = 0L
        )
    }
}
