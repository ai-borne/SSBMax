package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.CacheStatus
import com.ssbmax.shared.domain.model.GPEQuestion
import com.ssbmax.shared.domain.model.GenderTag
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.PPDTQuestion
import com.ssbmax.shared.domain.model.SDTQuestion
import com.ssbmax.shared.domain.model.SRTSituation
import com.ssbmax.shared.domain.model.TATQuestion

import com.ssbmax.shared.domain.model.WATWord

// Type aliases for consistency
typealias WATQuestion = WATWord
typealias SRTQuestion = SRTSituation

/**
 * Repository for fetching test content from Firestore.
 * All test questions are stored in the cloud to prevent APK sideloading/extraction.
 * OIR content is persisted in the platform cache for first-run readiness; other test content
 * may be cached in memory during active test sessions.
 */
interface TestContentRepository {
    
    /**
     * Fetch OIR test questions from Firestore
     * @param testId The specific test ID to load
     * @return Result with list of OIR questions or error
     * 
     * @deprecated Use getOIRTestQuestions() for cached implementation
     */
    suspend fun getOIRQuestions(testId: String): Result<List<OIRQuestion>>
    
    /**
     * Get OIR test questions from cache (50 questions with proper distribution)
     * Uses progressive caching strategy for optimal performance
     * 
     * @param count Number of questions to fetch (default 50)
     * @return Result with list of OIR questions or error
     */
    suspend fun getOIRTestQuestions(count: Int = 50): Result<List<OIRQuestion>>
    
    /**
     * Initialize OIR question cache
     * Downloads first batch of questions from Firestore
     * 
     * @return Result indicating success or failure
     */
    suspend fun initializeOIRCache(): Result<Unit>
    
    /**
     * Get OIR cache status
     * @return Cache status with statistics
     */
    suspend fun getOIRCacheStatus(): CacheStatus
    
    /**
     * Fetch PPDT test questions from Firestore
     * @param testId The specific test ID to load
     * @return Result with list of PPDT questions or error
     */
    suspend fun getPPDTQuestions(testId: String): Result<List<PPDTQuestion>>

    /**
     * Fetch a single PPDT question by its ID.
     * Required for PPDT analysis to retrieve image context.
     * @param questionId The unique question ID
     * @return Result with the PPDT question or error
     */
    suspend fun getPPDTQuestion(questionId: String): Result<PPDTQuestion>

    /**
     * Fetch a gender-appropriate PPDT question from the cached image pool.
     * Used by the test flow to route female/male candidates to matching images.
     *
     * @param genderTag Filter for image gender classification.
     *   MALE/FEMALE → show same-gender + MIXED images.
     *   null → full pool (Gender.OTHER users, or profile fetch failed).
     *   NOTE: Filter is a no-op until Phase 6 adds genderTag to the Room entity.
     * @return Result with a random appropriate PPDTQuestion
     */
    suspend fun getPPDTQuestion(genderTag: GenderTag?): Result<PPDTQuestion>

    /**
     * Fetch GPE test questions from Firestore/Cache
     * @param testId The specific test ID to load
     * @return Result with list of GPE questions or error
     */
    suspend fun getGPEQuestions(testId: String): Result<List<GPEQuestion>>

    /**
     * Fetch TAT test questions from Firestore.
     * @param testId The specific test ID to load
     * @param genderTag Gender filter for image pool selection (MALE/FEMALE see MIXED for all)
     * @return Result with list of TAT questions (11 real + 1 blank card) or error
     */
    suspend fun getTATQuestions(testId: String, genderTag: GenderTag? = null): Result<List<TATQuestion>>
    
    /**
     * Fetch WAT test words from Firestore/Cache
     * @param testId The specific test ID to load
     * @return Result with list of WAT words or error
     */
    suspend fun getWATQuestions(testId: String): Result<List<WATWord>>
    
    /**
     * Fetch SRT test situations from Firestore/Cache
     * @param testId The specific test ID to load
     * @return Result with list of SRT situations or error
     */
    suspend fun getSRTQuestions(testId: String): Result<List<SRTSituation>>
    
    /**
     * Fetch SDT test questions (4 predefined questions)
     * @param testId The specific test ID to load
     * @return Result with list of SDT questions or error
     */
    suspend fun getSDTQuestions(testId: String): Result<List<SDTQuestion>>
    
    /**
     * Get random Group Discussion topic
     */
    suspend fun getRandomGDTopic(): Result<String>

    /**
     * Get 4 random Lecturette topics for selection
     */
    suspend fun getRandomLecturetteTopics(count: Int = 4): Result<List<String>>
    
    /**
     * Clear in-memory cache of test content
     * Call this after test completion or on memory pressure
     */
    fun clearCache()

    /**
     * Mark OIR question IDs as recently served so they are excluded from future
     * test selections for the next 7 days.
     *
     * Default implementation is a no-op so that existing fakes and test doubles
     * do not need to be updated.
     */
    suspend fun markOIRQuestionsUsed(questionIds: List<String>): Result<Unit> =
        Result.success(Unit)
}
