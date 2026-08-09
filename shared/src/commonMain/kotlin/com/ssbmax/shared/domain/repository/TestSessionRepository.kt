package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.TestType

/**
 * Repository interface for managing test sessions.
 * Extracted from [TestContentRepository] to separate content concerns from session lifecycle.
 */
interface TestSessionRepository {

    /** Returns true if the user has an active (non-expired) session for the given test. */
    suspend fun hasActiveTestSession(userId: String, testId: String): Result<Boolean>

    /**
     * Creates a test session for the user. Must be called before accessing test content.
     * @return The new session ID on success.
     */
    suspend fun createTestSession(userId: String, testId: String, testType: TestType): Result<String>

    /** Marks a successfully submitted session as terminal. */
    suspend fun completeTestSession(sessionId: String): Result<Unit>

    /** Marks an exited session as abandoned and invalidates content access. */
    suspend fun abandonTestSession(sessionId: String): Result<Unit>

    /** Marks an unsubmitted session expired after its absolute deadline. */
    suspend fun expireTestSession(sessionId: String): Result<Unit>


}
