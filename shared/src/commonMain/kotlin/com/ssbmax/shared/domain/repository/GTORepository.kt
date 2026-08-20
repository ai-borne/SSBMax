package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.gto.*
import kotlinx.coroutines.flow.Flow

/**
 * Repository interface for GTO (Group Testing Officer) tests
 * 
 * Handles all 8 GTO test types:
 * - Group Discussion (GD)
 * - Group Planning Exercise (GPE)
 * - Lecturette
 * - Progressive Group Task (PGT)
 * - Half Group Task (HGT)
 * - Group Obstacle Race (GOR)
 * - Individual Obstacles (IO)
 * - Command Task (CT)
 */
interface GTORepository {
    
    // ==================== Test Content Management ====================
    
    /**
     * Get a random GTO test of specified type
     */
    suspend fun getRandomTest(testType: GTOTestType): Result<GTOTest>
    
    /**
     * Get a specific test by ID
     */
    suspend fun getTestById(testId: String): Result<GTOTest>
    
    /**
     * Submit ANY GTO test result
     * @return Submission ID
     */
    // Moved to SubmissionRepository
    // suspend fun submitTest(submission: GTOSubmission): Result<String>
    
    /**
     * Get 8 random Lecturette topics
     */
    // Moved to TestContentRepository
    // suspend fun getRandomLecturetteTopics(count: Int = 4): Result<List<String>>
    
    /**
     * Get random GD topic
     */
    // Moved to TestContentRepository
    // suspend fun getRandomGDTopic(): Result<String>
    
    /**
     * Get random GPE scenario with image
     */
    suspend fun getRandomGPEScenario(): Result<GTOTest.GPETest>
    
    /**
     * Get obstacles for animation-based tests
     */
    suspend fun getObstaclesForTest(testType: GTOTestType): Result<List<ObstacleConfig>>
    
    // ==================== Submission Management ====================
    
    /**
     * Submit a GTO test response
     * Returns submission ID for navigation
     */
    // submitTest moved to SubmissionRepository
    
    /**
     * Get submission by ID
     */
    suspend fun getSubmission(submissionId: String): Result<GTOSubmission>
    
    /**
     * Observe submission updates (for real-time status changes)
     */
    fun observeSubmission(submissionId: String): Flow<GTOSubmission?>
    
    /**
     * Update submission status (used by worker)
     */
    suspend fun updateSubmissionStatus(
        submissionId: String,
        status: GTOSubmissionStatus
    ): Result<Unit>
    
    /**
     * Update submission with OLQ scores (after AI analysis)
     */
    suspend fun updateSubmissionOLQScores(
        submissionId: String,
        olqScores: Map<com.ssbmax.shared.domain.model.interview.OLQ, com.ssbmax.shared.domain.model.interview.OLQScore>
    ): Result<Unit>
    
    /**
     * Get all submissions for a user
     */
    suspend fun getUserSubmissions(
        userId: String,
        testType: GTOTestType? = null
    ): Result<List<GTOSubmission>>
    
    /**
     * Get submissions pending analysis (for worker)
     */
    suspend fun getPendingSubmissions(limit: Int = 10): Result<List<GTOSubmission>>
    
    // ==================== Progress Tracking ====================
    
    /**
     * Get user's GTO progress
     */
    suspend fun getUserProgress(userId: String): Result<GTOProgress>
    
    /**
     * Observe user's GTO progress (real-time updates)
     */
    fun observeUserProgress(userId: String): Flow<GTOProgress?>
    
    /**
     * Update user's progress after completing a test
     */
    suspend fun updateProgress(
        userId: String,
        completedTestType: GTOTestType
    ): Result<Unit>
    
    /**
     * Check if user can take a specific test (sequential access check)
     */
    suspend fun canUserTakeTest(
        userId: String,
        testType: GTOTestType
    ): Result<Boolean>
    
    /**
     * Get completed test types for a user
     */
    suspend fun getCompletedTests(userId: String): Result<List<GTOTestType>>
    
    /**
     * Get next available test for user (sequential order)
     */
    suspend fun getNextAvailableTest(userId: String): Result<GTOTestType?>
    
    // ==================== Results & Analysis ====================
    
    /**
     * Get test result with OLQ scores
     */
    suspend fun getTestResult(submissionId: String): Result<GTOResult>
    
    /**
     * Get all results for a user (for progress analytics)
     */
    suspend fun getUserResults(
        userId: String,
        testType: GTOTestType? = null
    ): Result<List<GTOResult>>

    /**
     * Get the latest result for a single test type — the lean path used by the dashboard.
     *
     * Resolves only the most-recent submission (one ordered query, not N), so it avoids the
     * O(N×reads) cost of [getUserResults]. Returns a [GTOResultStatus] so the caller can tell
     * "scored", "submitted but unscored" (analysis pending/failed) and "never attempted" apart.
     */
    suspend fun getLatestResult(
        userId: String,
        testType: GTOTestType
    ): Result<GTOResultStatus>
    
    /**
     * Get average OLQ scores across all GTO tests
     */
    suspend fun getAverageOLQScores(userId: String): Result<Map<com.ssbmax.shared.domain.model.interview.OLQ, Float>>
    
    // ==================== Cache Management ====================
    
    /**
     * Cache test content locally for offline access
     */
    suspend fun cacheTestContent(testType: GTOTestType): Result<Unit>
    
    /**
     * Clear cached test content
     */
    suspend fun clearCache(testType: GTOTestType? = null): Result<Unit>
    
    /**
     * Check if content is cached
     */
    suspend fun isContentCached(testType: GTOTestType): Result<Boolean>
}
