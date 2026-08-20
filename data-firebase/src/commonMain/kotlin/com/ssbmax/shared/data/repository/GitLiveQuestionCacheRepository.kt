package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.interview.InterviewQuestion
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.QuestionCacheEntry
import com.ssbmax.shared.domain.model.interview.QuestionCacheRepository
import com.ssbmax.shared.domain.model.interview.QuestionCacheStats
import com.ssbmax.shared.domain.model.interview.QuestionCacheType
import com.ssbmax.shared.domain.model.interview.QuestionSource
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.Query
import dev.gitlive.firebase.firestore.firestore
import kotlin.time.Clock
import kotlin.time.Instant
import kotlinx.serialization.Serializable
import kotlin.time.Duration.Companion.seconds

/**
 * GitLive-Firebase-backed port of the Android FirestoreQuestionCacheRepository.
 * Same collections (question_cache, generic_questions, question_usage) and
 * same field names (see [QuestionCacheEntryDto]/[GenericQuestionDto]); uses
 * GitLive's WriteBatch/FieldValue.increment in place of the Android SDK's
 * equivalents, same shape otherwise.
 */
class GitLiveQuestionCacheRepository : QuestionCacheRepository {

    private val cacheCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.QUESTION_CACHE)
    private val genericCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.GENERIC_QUESTIONS)
    private val usageCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.QUESTION_USAGE)

    override suspend fun cachePIQQuestions(
        piqSnapshotId: String,
        questions: List<InterviewQuestion>,
        expirationDays: Int
    ): Result<Unit> = try {
        val secondsPerDay = 86400L
        val expiresAt = Clock.System.now() + (expirationDays * secondsPerDay).seconds
        val batch = Firebase.firestore.batch()

        questions.forEach { question ->
            val entry = QuestionCacheEntry(
                id = randomId(),
                question = question,
                cacheKey = piqSnapshotId,
                cacheType = QuestionCacheType.PIQ_BASED,
                createdAt = Clock.System.now(),
                usageCount = 0,
                lastUsedAt = null,
                expiresAt = expiresAt
            )
            batch.set(cacheCollection.document(entry.id), entry.toDto())
        }

        batch.commit()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getPIQQuestions(
        piqSnapshotId: String,
        limit: Int,
        excludeUsed: Boolean
    ): Result<List<InterviewQuestion>> = try {
        var query = cacheCollection
            .where { "cacheKey" equalTo piqSnapshotId }
            .where { "cacheType" equalTo QuestionCacheType.PIQ_BASED.name }
            .where { "expiresAt" greaterThan Clock.System.now().toEpochMilliseconds() }
            .orderBy("expiresAt", Direction.DESCENDING)

        if (excludeUsed) {
            query = query.orderBy("usageCount", Direction.ASCENDING)
        }

        val snapshot = query.limit(limit).get()
        val questions = snapshot.documents.mapNotNull { doc ->
            runCatching { doc.data(QuestionCacheEntryDto.serializer()).toDomain().question }.getOrNull()
        }
        Result.success(questions)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getGenericQuestions(
        targetOLQs: List<OLQ>?,
        difficulty: Int?,
        limit: Int,
        excludeUsed: Boolean
    ): Result<List<InterviewQuestion>> = try {
        var firestoreQuery: Query = genericCollection
        if (difficulty != null) {
            firestoreQuery = firestoreQuery.where { "difficulty" equalTo difficulty }
        }
        if (excludeUsed) {
            firestoreQuery = firestoreQuery.orderBy("usageCount", Direction.ASCENDING)
        }

        val snapshot = firestoreQuery.limit(limit).get()
        var questions = snapshot.documents.mapNotNull { doc ->
            runCatching { doc.data(GenericQuestionDto.serializer()).toDomain() }.getOrNull()
        }

        if (targetOLQs != null) {
            questions = questions.filter { q -> q.expectedOLQs.any { it in targetOLQs } }
        }

        Result.success(questions.take(limit))
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun markQuestionUsed(questionId: String, sessionId: String): Result<Unit> = try {
        val now = Clock.System.now().toEpochMilliseconds()

        val cacheQuery = cacheCollection.where { "question.id" equalTo questionId }.limit(1).get()
        cacheQuery.documents.firstOrNull()?.reference?.update(
            "usageCount" to FieldValue.increment(1),
            "lastUsedAt" to now
        )

        val genericQuery = genericCollection.where { "id" equalTo questionId }.limit(1).get()
        genericQuery.documents.firstOrNull()?.reference?.update(
            "usageCount" to FieldValue.increment(1),
            "lastUsedAt" to now
        )

        usageCollection.add(
            QuestionUsageDto(questionId = questionId, sessionId = sessionId, usedAt = now)
        )

        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun cleanupExpired(): Result<Int> = try {
        val expiredQuery = cacheCollection
            .where { "expiresAt" lessThan Clock.System.now().toEpochMilliseconds() }
            .get()
        val batch = Firebase.firestore.batch()
        expiredQuery.documents.forEach { batch.delete(it.reference) }
        batch.commit()
        Result.success(expiredQuery.documents.size)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun getCacheStats(userId: String?): Result<QuestionCacheStats> = try {
        val totalCached = cacheCollection.get().documents.size
        val piqBased = cacheCollection
            .where { "cacheType" equalTo QuestionCacheType.PIQ_BASED.name }
            .get().documents.size
        val expired = cacheCollection
            .where { "expiresAt" lessThan Clock.System.now().toEpochMilliseconds() }
            .get().documents.size
        val genericCount = genericCollection.get().documents.size

        val mostUsedSnapshot = cacheCollection
            .orderBy("usageCount", Direction.DESCENDING)
            .limit(5)
            .get()
        val mostUsed = mostUsedSnapshot.documents.mapNotNull { doc ->
            runCatching { doc.data(QuestionCacheEntryDto.serializer()).toDomain() }.getOrNull()
        }

        Result.success(
            QuestionCacheStats(
                totalCached = totalCached,
                piqBasedCount = piqBased,
                genericCount = genericCount,
                expiredCount = expired,
                mostUsedQuestions = mostUsed,
                cacheHitRate = 0f,
                avgGenerationTime = 0L
            )
        )
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun invalidatePIQCache(piqSnapshotId: String): Result<Unit> = try {
        val query = cacheCollection.where { "cacheKey" equalTo piqSnapshotId }.get()
        val batch = Firebase.firestore.batch()
        query.documents.forEach { batch.delete(it.reference) }
        batch.commit()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

}

@Serializable
internal data class QuestionCacheEntryDto(
    val id: String = "",
    val question: InterviewQuestionDto = InterviewQuestionDto(),
    val cacheKey: String = "",
    val cacheType: String = QuestionCacheType.GENERIC.name,
    val createdAt: Long = 0L,
    val usageCount: Int = 0,
    val lastUsedAt: Long? = null,
    val expiresAt: Long? = null
) {
    fun toDomain(): QuestionCacheEntry = QuestionCacheEntry(
        id = id,
        question = question.toDomain(),
        cacheKey = cacheKey,
        cacheType = runCatching { QuestionCacheType.valueOf(cacheType) }.getOrDefault(QuestionCacheType.GENERIC),
        createdAt = Instant.fromEpochMilliseconds(createdAt),
        usageCount = usageCount,
        lastUsedAt = lastUsedAt?.let { Instant.fromEpochMilliseconds(it) },
        expiresAt = expiresAt?.let { Instant.fromEpochMilliseconds(it) }
    )
}

internal fun QuestionCacheEntry.toDto(): QuestionCacheEntryDto = QuestionCacheEntryDto(
    id = id,
    question = question.toDto(),
    cacheKey = cacheKey,
    cacheType = cacheType.name,
    createdAt = createdAt.toEpochMilliseconds(),
    usageCount = usageCount,
    lastUsedAt = lastUsedAt?.toEpochMilliseconds(),
    expiresAt = expiresAt?.toEpochMilliseconds()
)

@Serializable
internal data class InterviewQuestionDto(
    val id: String = "",
    val questionText: String = "",
    val targetOLQs: List<String> = emptyList(),
    val context: String? = null,
    val source: String = QuestionSource.GENERIC_POOL.name
) {
    fun toDomain(): InterviewQuestion = InterviewQuestion(
        id = id,
        questionText = questionText,
        expectedOLQs = targetOLQs.mapNotNull { name -> OLQ.entries.find { it.name == name } },
        context = context,
        source = runCatching { QuestionSource.valueOf(source) }.getOrDefault(QuestionSource.GENERIC_POOL)
    )
}

internal fun InterviewQuestion.toDto(): InterviewQuestionDto = InterviewQuestionDto(
    id = id,
    questionText = questionText,
    targetOLQs = expectedOLQs.map { it.name },
    context = context,
    source = source.name
)

@Serializable
internal data class GenericQuestionDto(
    val id: String = "",
    val questionText: String? = null,
    val text: String? = null,
    val targetOLQs: List<String> = emptyList(),
    val context: String? = null,
    val source: String = QuestionSource.GENERIC_POOL.name
) {
    fun toDomain(): InterviewQuestion? {
        val text = questionText ?: text ?: return null
        return InterviewQuestion(
            id = id,
            questionText = text,
            expectedOLQs = targetOLQs.mapNotNull { name -> OLQ.entries.find { it.name == name } },
            context = context,
            source = runCatching { QuestionSource.valueOf(source) }.getOrDefault(QuestionSource.GENERIC_POOL)
        )
    }
}

@Serializable
internal data class QuestionUsageDto(
    val questionId: String = "",
    val sessionId: String = "",
    val usedAt: Long = 0L
)
