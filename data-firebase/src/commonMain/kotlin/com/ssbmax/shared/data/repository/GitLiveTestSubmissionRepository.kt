package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.GradingStatus
import com.ssbmax.shared.domain.model.TestPhase
import com.ssbmax.shared.domain.model.TestResponse
import com.ssbmax.shared.domain.model.TestSubmission
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.TestSubmissionRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed port of the Android TestSubmissionRepositoryImpl. Same "submissions"
 * collection and field set; uses `Query.snapshots` (a Flow) in place of the Android SDK's
 * `addSnapshotListener`/`callbackFlow`, same as the other GitLive*Repository ports.
 *
 * `responses` round-trips through [TestResponseDto] the same way the Android original's
 * `Map<String, Any?>` mapper did: only [TestResponse.MultipleChoice] is actually reconstructed on
 * read (every response is deserialized to a `MultipleChoice` with `selectedOption = 0` regardless
 * of its original subtype) — a real known simplification carried forward unchanged, not silently
 * fixed, since a full polymorphic response codec is bigger than this slice.
 *
 * **Pre-existing field-name mismatch, carried forward unchanged (not silently fixed):** the
 * Android original's `submitTest`/`updateSubmission` write the domain `userId` under the
 * Firestore key `"userId"`, but `getPendingSubmissions`'s sibling `getSubmissionsForStudent`
 * queries field `"studentId"` — a key this repo's own write path never sets. Either another,
 * unported repo in the submission-repository cluster writes `"studentId"` onto the same
 * `submissions` collection, or this was already dead code on Android; not resolved here, since
 * establishing which needs the (not-yet-ported) submission-cluster repos as context.
 */
class GitLiveTestSubmissionRepository : TestSubmissionRepository {

    private val submissionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)

    override suspend fun getSubmissionById(submissionId: String): Result<TestSubmission> = try {
        val snapshot = submissionsCollection.document(submissionId).get()
        val dto = runCatching { snapshot.data(TestSubmissionDto.serializer()) }.getOrNull()
        val submission = dto?.toDomain()
        if (submission != null) {
            Result.success(submission)
        } else {
            Result.failure(Exception("Submission not found"))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Errors propagate uncaught — matches the Android original's `close(error)` on a listener error. */
    override fun getSubmissionsForStudent(studentId: String): Flow<List<TestSubmission>> =
        submissionsCollection
            .where { FIELD_STUDENT_ID equalTo studentId }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .snapshots
            .map { snapshot ->
                snapshot.documents.mapNotNull { doc ->
                    runCatching { doc.data(TestSubmissionDto.serializer()) }.getOrNull()?.toDomain()
                }
            }

    /** Errors propagate uncaught — matches the Android original's `close(error)` on a listener error. */
    override fun getPendingSubmissions(assessorId: String): Flow<List<TestSubmission>> =
        submissionsCollection
            .where { FIELD_GRADING_STATUS equalTo GradingStatus.PENDING.name }
            .orderBy(FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .snapshots
            .map { snapshot ->
                snapshot.documents.mapNotNull { doc ->
                    runCatching { doc.data(TestSubmissionDto.serializer()) }.getOrNull()?.toDomain()
                }
            }

    override suspend fun submitTest(submission: TestSubmission): Result<Unit> = try {
        submissionsCollection.document(submission.id).set(submission.toDto())
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun updateSubmission(submission: TestSubmission): Result<Unit> = try {
        submissionsCollection.document(submission.id).set(submission.toDto())
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun deleteSubmission(submissionId: String): Result<Unit> = try {
        submissionsCollection.document(submissionId).delete()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private companion object {
        const val FIELD_STUDENT_ID = "studentId"
        const val FIELD_GRADING_STATUS = "gradingStatus"
        const val FIELD_SUBMITTED_AT = "submittedAt"
    }
}

@Serializable
internal data class TestSubmissionDto(
    val id: String = "",
    val testId: String = "",
    val userId: String = "",
    val testType: String = "",
    val phase: String = "",
    val submittedAt: Long = 0L,
    val responses: List<TestResponseDto> = emptyList(),
    val aiPreliminaryScore: Float? = null,
    val instructorScore: Float? = null,
    val finalScore: Float? = null,
    val gradingStatus: String = GradingStatus.PENDING.name,
    val instructorId: String? = null,
    val instructorFeedback: String? = null,
    val gradedAt: Long? = null,
    val timeSpent: Long = 0L,
    val batchId: String? = null
)

@Serializable
internal data class TestResponseDto(
    val questionId: String = "",
    val timestamp: Long = 0L,
    val type: String? = null
)

/**
 * Returns null (dropped, not defaulted) when testType/phase don't parse, or when id/testId/userId/
 * submittedAt are blank/zero — every field on [TestSubmissionDto] has a Kotlin default so GitLive's
 * decoder never throws on a document missing them (unlike the Android original's hard-required
 * `getX(...) ?: return null` for each), so this guard is what makes a structurally incomplete
 * document fail loudly instead of silently becoming a submission with `id=""` — writing that back
 * via `updateSubmission` would target an empty-path document reference, exactly the "lost candidate
 * work" failure mode this phase's own risk register calls out. `gradingStatus` is deliberately left
 * lenient (defaults to `PENDING` rather than dropping the record) — matches the domain model's own
 * default and the Android original's crash-prone `"PENDING"` fallback was strictly worse.
 */
internal fun TestSubmissionDto.toDomain(): TestSubmission? {
    if (isStructurallyIncomplete()) return null
    val testTypeEnum = runCatching { TestType.valueOf(testType) }.getOrNull() ?: return null
    val phaseEnum = runCatching { TestPhase.valueOf(phase) }.getOrNull() ?: return null
    val gradingStatusEnum = runCatching { GradingStatus.valueOf(gradingStatus) }.getOrNull() ?: GradingStatus.PENDING

    return TestSubmission(
        id = id,
        testId = testId,
        userId = userId,
        testType = testTypeEnum,
        phase = phaseEnum,
        submittedAt = submittedAt,
        responses = responses.filter { it.questionId.isNotBlank() }.map { it.toDomain() },
        aiPreliminaryScore = aiPreliminaryScore,
        instructorScore = instructorScore,
        finalScore = finalScore,
        gradingStatus = gradingStatusEnum,
        instructorId = instructorId,
        instructorFeedback = instructorFeedback,
        gradedAt = gradedAt,
        timeSpent = timeSpent,
        batchId = batchId
    )
}

private fun TestSubmissionDto.isStructurallyIncomplete(): Boolean {
    val hasBlankRequiredField = id.isBlank() || testId.isBlank() || userId.isBlank()
    return hasBlankRequiredField || submittedAt <= 0L
}

/**
 * Same simplification as the Android original: every stored response is reconstructed as a
 * [TestResponse.MultipleChoice] regardless of its original subtype, since the wire format only
 * ever persisted `questionId`/`timestamp`/`type`, not the subtype-specific payload.
 */
internal fun TestResponseDto.toDomain(): TestResponse =
    TestResponse.MultipleChoice(
        questionId = questionId,
        timestamp = timestamp,
        selectedOption = 0,
        isCorrect = null
    )

internal fun TestSubmission.toDto(): TestSubmissionDto = TestSubmissionDto(
    id = id,
    testId = testId,
    userId = userId,
    testType = testType.name,
    phase = phase.name,
    submittedAt = submittedAt,
    responses = responses.map { it.toDto() },
    aiPreliminaryScore = aiPreliminaryScore,
    instructorScore = instructorScore,
    finalScore = finalScore,
    gradingStatus = gradingStatus.name,
    instructorId = instructorId,
    instructorFeedback = instructorFeedback,
    gradedAt = gradedAt,
    timeSpent = timeSpent,
    batchId = batchId
)

internal fun TestResponse.toDto(): TestResponseDto = TestResponseDto(
    questionId = questionId,
    timestamp = timestamp,
    type = this::class.simpleName
)
