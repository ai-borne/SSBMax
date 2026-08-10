package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.StudyProgress
import com.ssbmax.shared.domain.model.StudySession
import com.ssbmax.shared.domain.repository.StudyProgressRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed port of the Android StudyProgressRepositoryImpl.
 * Same collections (study_progress, study_sessions) and same doc-id scheme
 * (`${userId}_$materialId` for progress); uses DocumentReference.snapshots
 * (a Flow) in place of the Android SDK's addSnapshotListener/callbackFlow,
 * same as the other GitLive*Repository ports.
 *
 * [observeProgress] deliberately does NOT catch-and-emit-null on listener
 * errors (an earlier version did) -- the Android original's
 * `addSnapshotListener` closes the flow with the error (`close(error)`),
 * and every ViewModel caller (`TopicViewModel`) already has its own
 * `.catch { }` expecting to see it and show a real error state. Swallowing
 * it here made that ViewModel code unreachable and showed "no progress"
 * for what was actually a permission/network failure.
 */
class GitLiveStudyProgressRepository : StudyProgressRepository {

    private val progressCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.STUDY_PROGRESS)
    private val sessionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.STUDY_SESSIONS)

    override fun observeProgress(userId: String, materialId: String): Flow<StudyProgress?> =
        progressCollection
            .document(progressDocId(userId, materialId))
            .snapshots
            .map { snapshot ->
                if (snapshot.exists) snapshot.data(StudyProgressDto.serializer()).toDomain() else null
            }

    override suspend fun saveProgress(progress: StudyProgress): Result<Unit> = try {
        progressCollection
            .document(progressDocId(progress.userId, progress.materialId))
            .set(progress.toDto())
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getProgress(userId: String, materialId: String): Result<StudyProgress?> = try {
        val snapshot = progressCollection.document(progressDocId(userId, materialId)).get()
        val progress = if (snapshot.exists) snapshot.data(StudyProgressDto.serializer()).toDomain() else null
        Result.success(progress)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getAllProgress(userId: String): Result<List<StudyProgress>> = try {
        val snapshot = progressCollection.where { "userId" equalTo userId }.get()
        Result.success(snapshot.documents.map { it.data(StudyProgressDto.serializer()).toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun deleteProgress(userId: String, materialId: String): Result<Unit> = try {
        progressCollection.document(progressDocId(userId, materialId)).delete()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun startSession(userId: String, materialId: String): Result<StudySession> = try {
        val session = StudySession(
            id = "",
            userId = userId,
            materialId = materialId,
            startedAt = Clock.System.now().toEpochMilliseconds(),
            endedAt = null,
            duration = 0,
            progressIncrement = 0f
        )
        val docRef = sessionsCollection.add(session.toDto())
        Result.success(session.copy(id = docRef.id))
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun endSession(sessionId: String, progressIncrement: Float): Result<Unit> = try {
        val now = Clock.System.now().toEpochMilliseconds()
        val sessionDoc = sessionsCollection.document(sessionId)
        // Matches the Android original's forgiving fallback: a missing/already-deleted
        // session doc defaults startedAt to `now` (duration = 0) rather than failing --
        // this is a best-effort close of a session that may have raced with deletion,
        // not a caller error worth surfacing.
        val snapshot = sessionDoc.get()
        val startedAt = if (snapshot.exists) {
            snapshot.data(StudySessionDto.serializer()).startedAt
        } else {
            now
        }
        val duration = now - startedAt

        sessionDoc.update(
            "endedAt" to now,
            "duration" to duration,
            "progressIncrement" to progressIncrement
        )
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getActiveSession(userId: String): Result<StudySession?> = try {
        val snapshot = sessionsCollection
            .where { "userId" equalTo userId }
            .where { "endedAt" equalTo null }
            .limit(1)
            .get()
        val session = snapshot.documents.firstOrNull()?.let {
            it.data(StudySessionDto.serializer()).toDomain(it.id)
        }
        Result.success(session)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getSessionsForMaterial(
        userId: String,
        materialId: String
    ): Result<List<StudySession>> = try {
        val snapshot = sessionsCollection
            .where { "userId" equalTo userId }
            .where { "materialId" equalTo materialId }
            .get()
        Result.success(snapshot.documents.map { it.data(StudySessionDto.serializer()).toDomain(it.id) })
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun progressDocId(userId: String, materialId: String): String = "${userId}_$materialId"

}

@Serializable
internal data class StudyProgressDto(
    val materialId: String = "",
    val userId: String = "",
    val progress: Float = 0f,
    val lastReadAt: Long? = null,
    val timeSpent: Long = 0L,
    val isBookmarked: Boolean = false,
    val isCompleted: Boolean = false,
    val notes: String? = null,
    val highlights: List<String> = emptyList()
) {
    fun toDomain(): StudyProgress = StudyProgress(
        materialId = materialId,
        userId = userId,
        progress = progress,
        lastReadAt = lastReadAt,
        timeSpent = timeSpent,
        isBookmarked = isBookmarked,
        isCompleted = isCompleted,
        notes = notes,
        highlights = highlights
    )
}

internal fun StudyProgress.toDto(): StudyProgressDto = StudyProgressDto(
    materialId = materialId,
    userId = userId,
    progress = progress,
    lastReadAt = lastReadAt,
    timeSpent = timeSpent,
    isBookmarked = isBookmarked,
    isCompleted = isCompleted,
    notes = notes,
    highlights = highlights
)

@Serializable
internal data class StudySessionDto(
    val userId: String = "",
    val materialId: String = "",
    val startedAt: Long = 0L,
    val endedAt: Long? = null,
    val duration: Long = 0L,
    val progressIncrement: Float = 0f
) {
    fun toDomain(id: String): StudySession = StudySession(
        id = id,
        userId = userId,
        materialId = materialId,
        startedAt = startedAt,
        endedAt = endedAt,
        duration = duration,
        progressIncrement = progressIncrement
    )
}

internal fun StudySession.toDto(): StudySessionDto = StudySessionDto(
    userId = userId,
    materialId = materialId,
    startedAt = startedAt,
    endedAt = endedAt,
    duration = duration,
    progressIncrement = progressIncrement
)
