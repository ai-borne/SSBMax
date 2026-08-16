package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.constants.InterviewConstants
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.interview.InterviewLimits
import com.ssbmax.shared.domain.model.interview.InterviewMode
import com.ssbmax.shared.domain.model.interview.InterviewQuestion
import com.ssbmax.shared.domain.model.interview.InterviewResponse
import com.ssbmax.shared.domain.model.interview.InterviewResult
import com.ssbmax.shared.domain.model.interview.InterviewSession
import com.ssbmax.shared.domain.model.interview.InterviewStatus
import com.ssbmax.shared.domain.model.interview.PrerequisiteCheckResult
import com.ssbmax.shared.domain.model.interview.QuestionCacheRepository
import com.ssbmax.shared.domain.repository.InterviewRepository
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlin.time.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

/**
 * GitLive-Firebase-backed port of the Android `FirestoreInterviewRepository`. Same collections
 * (`interview_sessions`, `interview_responses`, `interview_results`, `interview_questions`,
 * `submissions`) as the Android original. Question generation delegates to
 * [InterviewQuestionGenerator], result aggregation to the top-level [aggregateInterviewResult]
 * helper — both extracted (like [GitLiveGTORepository]'s own DTO/helper split) to keep this file
 * under this repo's 300-line limit.
 *
 * [checkPrerequisites] stays an unconditional `UnsupportedOperationException` stub, identical to
 * the Android original: its real check lives in `CheckInterviewPrerequisitesUseCase` (use-case
 * layer, out of this repository's scope).
 *
 * [checkInterviewLimits] was the same kind of stub until Phase 7b -- it had no caller anywhere
 * (its would-be use-case was confirmed dead code and deleted in the Phase 5 exit sweep), so it
 * stayed unimplemented rather than silently wrong. It's now real, following the exact
 * tier + monthly-usage pattern [com.ssbmax.shared.domain.usecase.subscription.CheckTestEligibilityUseCase]
 * uses for every other test type, keyed on the same `"INTERVIEW"` [SubscriptionLimits] entry
 * [com.ssbmax.shared.domain.model.TestType.IO] already maps to. `mode` is accepted (interface
 * contract) but unused -- [SubscriptionLimits]/[dev.gitlive.firebase.firestore] usage tracking
 * doesn't differentiate by interview mode, same as [getRemainingInterviews] below.
 */
class GitLiveInterviewRepository(
    private val questionCacheRepository: QuestionCacheRepository,
    private val questionGenerator: InterviewQuestionGenerator,
    private val subscriptionRepository: SubscriptionRepository
) : InterviewRepository {

    private val sessionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.INTERVIEW_SESSIONS)
    private val responsesCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.INTERVIEW_RESPONSES)
    private val resultsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.INTERVIEW_RESULTS)
    private val questionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.INTERVIEW_QUESTIONS)
    private val submissionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)

    override suspend fun checkPrerequisites(userId: String): Result<PrerequisiteCheckResult> =
        Result.failure(UnsupportedOperationException("Use CheckInterviewPrerequisitesUseCase"))

    override suspend fun checkInterviewLimits(userId: String, mode: InterviewMode): Result<Boolean> {
        val tier = subscriptionRepository.getSubscriptionTier(userId).getOrElse { return Result.failure(it) }
        val now = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault())
        val month = "${now.year}-${(now.month.ordinal + 1).toString().padStart(2, '0')}"
        val usage = subscriptionRepository.getMonthlyUsage(userId, month).getOrElse { return Result.failure(it) }
        val key = SubscriptionLimits.keyFor(TestType.IO)
        val info = usage[key]
        val limit = info?.limit ?: SubscriptionLimits.limitFor(key, tier)
        val used = info?.used ?: 0
        return Result.success(limit == -1 || used < limit)
    }

    // ==================== Session Management ====================

    override suspend fun createSession(
        userId: String,
        mode: InterviewMode,
        piqSnapshotId: String,
        consentGiven: Boolean
    ): Result<InterviewSession> = try {
        val questions = questionGenerator.generateQuestions(piqSnapshotId, InterviewConstants.TARGET_TOTAL_QUESTIONS)
            .getOrElse { return Result.failure(it) }

        val session = InterviewSession(
            id = randomId(),
            userId = userId,
            mode = mode,
            status = InterviewStatus.IN_PROGRESS,
            startedAt = Clock.System.now(),
            completedAt = null,
            piqSnapshotId = piqSnapshotId,
            consentGiven = consentGiven,
            questionIds = questions.map { it.id },
            currentQuestionIndex = 0,
            estimatedDuration = InterviewConstants.DEFAULT_DURATION_MINUTES
        )

        val batch = Firebase.firestore.batch()
        questions.forEach { question -> batch.set(questionsCollection.document(question.id), question.toDto()) }
        batch.set(sessionsCollection.document(session.id), session.toDto())
        batch.commit()

        Result.success(session)
    } catch (e: Exception) { Result.failure(e) }

    override suspend fun getActiveSession(userId: String): Result<InterviewSession?> = try {
        val snapshot = sessionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .where { FIELD_STATUS equalTo InterviewStatus.IN_PROGRESS.name }
            .orderBy(FIELD_STARTED_AT, Direction.DESCENDING)
            .limit(1)
            .get()
        Result.success(snapshot.documents.firstOrNull()?.data(InterviewSessionDto.serializer())?.toDomain())
    } catch (e: Exception) { Result.failure(e) }

    override suspend fun getSession(sessionId: String): Result<InterviewSession> {
        if (!isUsableDocumentId(sessionId)) return blankDocumentIdFailure("sessionId")
        return try {
            val doc = sessionsCollection.document(sessionId).get()
            if (!doc.exists) Result.failure(IllegalStateException("Session not found: $sessionId"))
            else Result.success(doc.data(InterviewSessionDto.serializer()).toDomain())
        } catch (e: Exception) { Result.failure(e) }
    }

    override suspend fun updateSession(session: InterviewSession): Result<Unit> {
        if (!isUsableDocumentId(session.id)) return blankDocumentIdFailure("session.id")
        return try {
            sessionsCollection.document(session.id).set(session.toDto())
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    override suspend fun abandonSession(sessionId: String): Result<Unit> = try {
        val session = getSession(sessionId).getOrElse { return Result.failure(it) }
        updateSession(session.copy(status = InterviewStatus.ABANDONED, completedAt = Clock.System.now()))
    } catch (e: Exception) { Result.failure(e) }

    // ==================== Question Management ====================

    override suspend fun generateQuestions(
        sessionId: String,
        piqSnapshotId: String,
        count: Int
    ): Result<List<InterviewQuestion>> = questionGenerator.generateQuestions(piqSnapshotId, count)

    override suspend fun getQuestion(questionId: String): Result<InterviewQuestion> {
        if (!isUsableDocumentId(questionId)) return blankDocumentIdFailure("questionId")
        return try {
            val doc = questionsCollection.document(questionId).get()
            if (!doc.exists) Result.failure(IllegalStateException("Question not found: $questionId"))
            else Result.success(doc.data(InterviewQuestionDto.serializer()).toDomain())
        } catch (e: Exception) { Result.failure(e) }
    }

    override suspend fun cacheQuestions(piqSnapshotId: String, questions: List<InterviewQuestion>): Result<Unit> =
        questionCacheRepository.cachePIQQuestions(
            piqSnapshotId = piqSnapshotId,
            questions = questions,
            expirationDays = InterviewConstants.DEFAULT_CACHE_EXPIRATION_DAYS
        )

    override suspend fun getCachedQuestions(piqSnapshotId: String, limit: Int): Result<List<InterviewQuestion>> =
        questionCacheRepository.getPIQQuestions(piqSnapshotId = piqSnapshotId, limit = limit, excludeUsed = true)

    // ==================== Response Management ====================

    override suspend fun submitResponse(response: InterviewResponse): Result<InterviewResponse> {
        if (!isUsableDocumentId(response.id)) return blankDocumentIdFailure("response.id")
        return try {
            val session = getSession(response.sessionId).getOrElse { return Result.failure(it) }
            responsesCollection.document(response.id).set(response.toDto(session.userId))
            Result.success(response)
        } catch (e: Exception) { Result.failure(e) }
    }

    override suspend fun updateResponse(response: InterviewResponse): Result<InterviewResponse> =
        submitResponse(response)

    override suspend fun getResponses(sessionId: String): Result<List<InterviewResponse>> = try {
        val session = getSession(sessionId).getOrElse { return Result.failure(it) }
        val snapshot = responsesCollection
            .where { FIELD_SESSION_ID equalTo sessionId }
            .where { FIELD_USER_ID equalTo session.userId }
            .orderBy(FIELD_RESPONDED_AT, Direction.ASCENDING)
            .get()
        Result.success(snapshot.documents.map { it.data(InterviewResponseDto.serializer()).toDomain() })
    } catch (e: Exception) { Result.failure(e) }

    override suspend fun getResponse(responseId: String): Result<InterviewResponse> {
        if (!isUsableDocumentId(responseId)) return blankDocumentIdFailure("responseId")
        return try {
            val doc = responsesCollection.document(responseId).get()
            if (!doc.exists) Result.failure(IllegalStateException("Response not found: $responseId"))
            else Result.success(doc.data(InterviewResponseDto.serializer()).toDomain())
        } catch (e: Exception) { Result.failure(e) }
    }

    // ==================== Result Management ====================

    override suspend fun completeInterview(sessionId: String): Result<InterviewResult> = try {
        val session = getSession(sessionId).getOrElse { return Result.failure(it) }
        val responses = getResponses(sessionId).getOrDefault(emptyList())
        val result = aggregateInterviewResult(session, responses)

        resultsCollection.document(result.id).set(result.toDto())
        updateSession(session.copy(status = InterviewStatus.COMPLETED, completedAt = Clock.System.now()))

        // Progress-tracking submission record so a completed interview shows up in "Your Progress"
        val submissionId = "interview_${result.id}"
        submissionsCollection.document(submissionId).set(
            InterviewProgressSubmissionDto(
                id = submissionId,
                userId = session.userId,
                testId = sessionId,
                testType = "IO",
                status = "COMPLETED",
                submittedAt = result.completedAt.toEpochMilliseconds(),
                score = (10 - result.overallRating).toFloat() * 10,
                resultId = result.id,
                mode = result.mode.name
            )
        )

        Result.success(result)
    } catch (e: Exception) { Result.failure(e) }

    override suspend fun getResult(sessionId: String): Result<InterviewResult> = try {
        val snapshot = resultsCollection.where { FIELD_SESSION_ID equalTo sessionId }.limit(1).get()
        val result = snapshot.documents.firstOrNull()?.data(InterviewResultDto.serializer())?.toDomain()
            ?: return Result.failure(IllegalStateException("Result not found for session: $sessionId"))
        Result.success(result)
    } catch (e: Exception) { Result.failure(e) }

    override suspend fun getResultById(resultId: String): Result<InterviewResult> {
        if (!isUsableDocumentId(resultId)) return blankDocumentIdFailure("resultId")
        return try {
            val doc = resultsCollection.document(resultId).get()
            if (!doc.exists) Result.failure(IllegalStateException("Result not found: $resultId"))
            else Result.success(doc.data(InterviewResultDto.serializer()).toDomain())
        } catch (e: Exception) { Result.failure(e) }
    }

    override fun getUserResults(userId: String): Flow<List<InterviewResult>> =
        resultsCollection
            .where { FIELD_USER_ID equalTo userId }
            .orderBy(FIELD_COMPLETED_AT, Direction.DESCENDING)
            .snapshots
            .map { snapshot -> snapshot.documents.map { it.data(InterviewResultDto.serializer()).toDomain() } }

    override suspend fun getLatestResult(userId: String): Result<InterviewResult?> = try {
        val snapshot = resultsCollection
            .where { FIELD_USER_ID equalTo userId }
            .orderBy(FIELD_COMPLETED_AT, Direction.DESCENDING)
            .limit(1)
            .get()
        Result.success(snapshot.documents.firstOrNull()?.data(InterviewResultDto.serializer())?.toDomain())
    } catch (e: Exception) { Result.failure(e) }

    // ==================== Analytics ====================

    override suspend fun getInterviewStats(userId: String): Result<Map<InterviewMode, Int>> = try {
        val snapshot = sessionsCollection
            .where { FIELD_USER_ID equalTo userId }
            .where { FIELD_STATUS equalTo InterviewStatus.COMPLETED.name }
            .get()
        val stats = snapshot.documents
            .map { it.data(InterviewSessionDto.serializer()).toDomain() }
            .groupBy { it.mode }
            .mapValues { it.value.size }
        Result.success(stats)
    } catch (e: Exception) { Result.failure(e) }

    override suspend fun getRemainingInterviews(userId: String, mode: InterviewMode): Result<Int> = try {
        val tier = subscriptionRepository.getSubscriptionTier(userId).getOrNull() ?: return Result.success(0)
        val totalUsed = getInterviewStats(userId).getOrDefault(emptyMap()).values.sum()
        val limits = InterviewLimits.forSubscription(tier, totalUsed)
        Result.success(limits.remaining)
    } catch (e: Exception) { Result.failure(e) }

    private companion object {
        const val FIELD_USER_ID = "userId"
        const val FIELD_STATUS = "status"
        const val FIELD_STARTED_AT = "startedAt"
        const val FIELD_COMPLETED_AT = "completedAt"
        const val FIELD_SESSION_ID = "sessionId"
        const val FIELD_RESPONDED_AT = "respondedAt"
    }
}
