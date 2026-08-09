package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.TestSessionRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlinx.serialization.Serializable
/**
 * GitLive-Firebase-backed port of the Android `core:data`
 * `TestSessionManagerImpl` (durable Firestore persistence, same
 * `test_sessions` collection and field names; the Android original's
 * in-memory `ConcurrentHashMap` fast-path is dropped — `shared` code runs on
 * both platforms with no shared-process guarantee to make an in-memory map
 * meaningful the same way, and every real caller of this interface only
 * calls `createTestSession` and one explicit terminal transition per session, never
 * `hasActiveTestSession` in a hot loop — so the Firestore round trip isn't
 * a regression in practice).
 *
 * Session creation is durable and fail-closed: a successful ID is returned only after Firestore
 * has persisted the active session. Exiting abandons the session; successful submission completes
 * it. Resume is intentionally not exposed yet, so abandoned and expired sessions cannot re-enter
 * the OIR flow.
 */
class GitLiveTestSessionRepository : TestSessionRepository {

    private val sessionsCollection = Firebase.firestore.collection(COLLECTION)

    override suspend fun hasActiveTestSession(userId: String, testId: String): Result<Boolean> = try {
        val snapshot = sessionsCollection
            .where { "userId" equalTo userId }
            .where { "testId" equalTo testId }
            .where { "isActive" equalTo true }
            .get()
        Result.success(snapshot.documents.isNotEmpty())
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun createTestSession(userId: String, testId: String, testType: TestType): Result<String> {
        val now = Clock.System.now().toEpochMilliseconds()
        // The rules use this stable key to authorize question access. Eligibility prevents a
        // second active session for the same user/test.
        val sessionId = "${userId}_${testId}"
        val dto = TestSessionDto(
            id = sessionId,
            userId = userId,
            testId = testId,
            testType = testType.name,
            startTime = now,
            expiresAt = now + TWO_HOURS_MS,
            isActive = true,
            status = SESSION_ACTIVE
        )
        return try {
            sessionsCollection.document(sessionId).set(dto)
            Result.success(sessionId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun completeTestSession(sessionId: String): Result<Unit> = updateTerminalState(
        sessionId = sessionId,
        status = SESSION_SUBMITTED
    )

    override suspend fun abandonTestSession(sessionId: String): Result<Unit> = updateTerminalState(
        sessionId = sessionId,
        status = SESSION_ABANDONED
    )

    override suspend fun expireTestSession(sessionId: String): Result<Unit> = updateTerminalState(
        sessionId = sessionId,
        status = SESSION_EXPIRED
    )

    private suspend fun updateTerminalState(sessionId: String, status: String): Result<Unit> = try {
        sessionsCollection.document(sessionId).update(
            "isActive" to false,
            "status" to status,
            "endTime" to Clock.System.now().toEpochMilliseconds()
        )
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private companion object {
        const val COLLECTION = "test_sessions"
        const val TWO_HOURS_MS = 2 * 60 * 60 * 1000L
        const val SESSION_ACTIVE = "ACTIVE"
        const val SESSION_SUBMITTED = "SUBMITTED"
        const val SESSION_ABANDONED = "ABANDONED"
        const val SESSION_EXPIRED = "EXPIRED"
    }
}

@Serializable
private data class TestSessionDto(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val testType: String = "",
    val startTime: Long = 0L,
    val expiresAt: Long = 0L,
    val isActive: Boolean = true,
    val status: String = "ACTIVE"
)
