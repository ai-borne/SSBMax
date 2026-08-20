package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TATInstructorScore
import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.TATStoryResponse
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.SDTSubmission
import com.ssbmax.shared.domain.model.SRTSubmission
import com.ssbmax.shared.domain.model.WATSubmission
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import dev.gitlive.firebase.firestore.Direction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.transform
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed port of the Android psychology-test submission cluster
 * (`PsychTestSubmissionRepository` + its four delegates `TATSubmissionRepository`/
 * `WATSubmissionRepository`/`SRTSubmissionRepository`/`SDTSubmissionRepository`, plus the shared
 * `PsychTestMapper`/`OLQMapper`). Merged into one class here — Koin doesn't need the Hilt
 * DI-boundary reason the Android originals were split for (300-line-file limit per class), same
 * merge rationale as the 6th slice's `StudyContentRepositoryImpl`+`FirestoreContentSource` merge.
 *
 * TAT stays directly on this facade; WAT/SRT/SDT are delegated to [GitLiveWATSubmissionDelegate]/
 * [GitLiveSRTSubmissionDelegate]/[GitLiveSDTSubmissionDelegate] (all sharing the same
 * [GitLiveOlqResultStore]) — a later structural split of this originally-single class, done purely
 * to keep every file under the repo's 300-line-per-file limit. No behavior changed by that split.
 *
 * Same "submissions"/"psych_results" collections as the Android original. One real, faithfully
 * preserved quirk: the Android `toFirestoreMap()` functions duplicate `id`/`userId`/`testId`/
 * `status`/`submittedAt`/`gradedByInstructorId`/`gradingTimestamp` **inside** the nested `data`
 * sub-map as well as at the document's top level — and `PsychTestMapper.parseXxxSubmission` reads
 * exclusively from the nested copy, never the top-level one. This port reproduces that exact
 * shape (`SubmissionDocDto<XxxDataDto>` for writes/queries, decoding `.data` for the domain model)
 * rather than "fixing" the duplication, since changing it would break compatibility with documents
 * already written by the Android app.
 *
 * TAT alone uses the newer atomic `finalizeTATAnalysisResult` (writes to `psych_results` first,
 * then marks the submission COMPLETED with result metadata) — WAT/SRT/SDT still use the older
 * two-step `updateXxxOLQResult`, exactly matching the asymmetry already present in the Android
 * originals (see the domain `SubmissionRepository` interface, which only declares
 * `finalizeTATAnalysisResult` for TAT).
 */
class GitLivePsychTestSubmissionRepository internal constructor(
    private val store: GitLiveOlqResultStore = GitLiveOlqResultStore(),
    private val watDelegate: GitLiveWATSubmissionDelegate = GitLiveWATSubmissionDelegate(store),
    private val srtDelegate: GitLiveSRTSubmissionDelegate = GitLiveSRTSubmissionDelegate(store),
    private val sdtDelegate: GitLiveSDTSubmissionDelegate = GitLiveSDTSubmissionDelegate(store)
) {

    private val submissionsCollection get() = store.submissionsCollection
    private val psychResultsCollection get() = store.psychResultsCollection

    // ===========================
    // TAT
    // ===========================

    suspend fun submitTAT(submission: TATSubmission, batchId: String?): Result<String> {
      if (!isUsableDocumentId(submission.id)) return blankDocumentIdFailure("submission.id")
      return try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.TAT.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            gradedByInstructorId = submission.gradedByInstructorId,
            gradingTimestamp = submission.gradingTimestamp,
            batchId = batchId,
            data = TATDataDto(
                id = submission.id,
                userId = submission.userId,
                testId = submission.testId,
                stories = submission.stories.map { it.toDto() },
                questions = submission.questions.map { it.toDto() },
                totalTimeTakenMinutes = submission.totalTimeTakenMinutes,
                submittedAt = submission.submittedAt,
                status = submission.status.name,
                analysisStatus = AnalysisStatus.PENDING_ANALYSIS.name,
                instructorScore = submission.instructorScore?.toDto(),
                gradedByInstructorId = submission.gradedByInstructorId,
                gradingTimestamp = submission.gradingTimestamp
            )
        )
        submissionsCollection.document(submission.id).set(doc, merge = true)
        Result.success(submission.id)
      } catch (e: Exception) {
        Result.failure(Exception("Failed to submit TAT: ${e.message}", e))
      }
    }

    suspend fun getTATSubmission(submissionId: String): Result<TATSubmission?> {
        if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
        return try {
            val snapshot = submissionsCollection.document(submissionId).get()
            if (!snapshot.exists) Result.success(null)
            else Result.success(snapshot.data(SubmissionDocDto.serializer(TATDataDto.serializer())).data.toDomain())
        } catch (e: Exception) {
            Result.failure(Exception("Failed to fetch TAT submission: ${e.message}", e))
        }
    }

    suspend fun getLatestTATSubmission(userId: String): Result<TATSubmission?> = try {
        val snapshot = submissionsCollection
            .where { PSYCH_FIELD_USER_ID equalTo userId }
            .where { PSYCH_FIELD_TEST_TYPE equalTo TestType.TAT.name }
            .orderBy(PSYCH_FIELD_SUBMITTED_AT, Direction.DESCENDING)
            .limit(1)
            .get()
        val doc = snapshot.documents.firstOrNull()
        if (doc == null) {
            Result.success(null)
        } else {
            Result.success(doc.data(SubmissionDocDto.serializer(TATDataDto.serializer())).data.toDomain())
        }
    } catch (e: Exception) {
        Result.failure(Exception("Failed to fetch latest TAT submission: ${e.message}", e))
    }

    suspend fun updateTATAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> {
        if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
        return try {
            submissionsCollection.document(submissionId).update("$PSYCH_FIELD_DATA.analysisStatus" to status.name)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Failed to update TAT analysis status: ${e.message}", e))
        }
    }

    /**
     * Atomically finalizes TAT analysis: persist to `psych_results` first, then mark COMPLETED
     * with result metadata — same ordering guarantee as the Android original (see the domain
     * interface's doc comment on `finalizeTATAnalysisResult`).
     */
    suspend fun finalizeTATAnalysisResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> {
      if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
      return try {
        val submissionDoc = submissionsCollection.document(submissionId).get()
        val userId = submissionDoc.data(SubmissionDocDto.serializer(TATDataDto.serializer())).userId
        if (userId.isEmpty()) {
            Result.failure(Exception("Cannot find userId for submission: $submissionId"))
        } else {
            psychResultsCollection.document(submissionId).set(olqResult.toDto(userId = userId), merge = true)

            submissionsCollection.document(submissionId).update(
                "$PSYCH_FIELD_DATA.analysisStatus" to SubmissionConstants.ANALYSIS_STATUS_COMPLETED,
                "$PSYCH_FIELD_DATA.resultUpdatedAt" to Clock.System.now().toEpochMilliseconds(),
                "$PSYCH_FIELD_DATA.hasOlqResult" to true,
                "$PSYCH_FIELD_DATA.resultSource" to "psych_results"
            )
            Result.success(Unit)
        }
      } catch (e: Exception) {
        Result.failure(Exception("Failed to finalize TAT analysis result: ${e.message}", e))
      }
    }

    suspend fun getTATResult(submissionId: String): Result<OLQAnalysisResult?> = store.getOlqResult(submissionId)

    private val tatRegressionFilters = mutableMapOf<String, OLQRegressionFilter>()

    /**
     * A regression-filtered snapshot is skipped (via `transform`, not mapped to `null`) — matches
     * the Android original, which returns from its `addSnapshotListener` callback without a
     * `trySend` in that case; emitting `null` here would incorrectly flip a shown result to
     * "Submission not found" for a merely-stale cache replay.
     */
    fun observeTATSubmission(submissionId: String): Flow<TATSubmission?> {
        if (!isUsableDocumentId(submissionId)) return kotlinx.coroutines.flow.flowOf(null)
        return submissionsCollection.document(submissionId).snapshots
            .transform { snapshot ->
                if (!snapshot.exists) {
                    emit(null)
                    return@transform
                }
                val dto = snapshot.data(SubmissionDocDto.serializer(TATDataDto.serializer()))
                val regressionFilters = tatRegressionFilters.getOrPut(submissionId) { OLQRegressionFilter() }
                if (regressionFilters.shouldFilterSnapshot(dto.data.analysisStatus, dto.data.olqResult != null, snapshot.metadata)) {
                    return@transform
                }
                emit(dto.data.toDomain())
            }
    }

    // ===========================
    // WAT (delegated)
    // ===========================

    suspend fun submitWAT(submission: WATSubmission, batchId: String?): Result<String> = watDelegate.submitWAT(submission, batchId)
    suspend fun getWATSubmission(submissionId: String): Result<WATSubmission?> = watDelegate.getWATSubmission(submissionId)
    suspend fun getLatestWATSubmission(userId: String): Result<WATSubmission?> = watDelegate.getLatestWATSubmission(userId)
    suspend fun updateWATAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> = watDelegate.updateWATAnalysisStatus(submissionId, status)
    suspend fun updateWATOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> = watDelegate.updateWATOLQResult(submissionId, olqResult)
    suspend fun getWATResult(submissionId: String): Result<OLQAnalysisResult?> = watDelegate.getWATResult(submissionId)
    fun observeWATSubmission(submissionId: String): Flow<WATSubmission?> = watDelegate.observeWATSubmission(submissionId)

    // ===========================
    // SRT (delegated)
    // ===========================

    suspend fun submitSRT(submission: SRTSubmission, batchId: String?): Result<String> = srtDelegate.submitSRT(submission, batchId)
    suspend fun getSRTSubmission(submissionId: String): Result<SRTSubmission?> = srtDelegate.getSRTSubmission(submissionId)
    suspend fun getLatestSRTSubmission(userId: String): Result<SRTSubmission?> = srtDelegate.getLatestSRTSubmission(userId)
    suspend fun updateSRTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> = srtDelegate.updateSRTAnalysisStatus(submissionId, status)
    suspend fun updateSRTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> = srtDelegate.updateSRTOLQResult(submissionId, olqResult)
    suspend fun getSRTResult(submissionId: String): Result<OLQAnalysisResult?> = srtDelegate.getSRTResult(submissionId)
    fun observeSRTSubmission(submissionId: String): Flow<SRTSubmission?> = srtDelegate.observeSRTSubmission(submissionId)

    // ===========================
    // SDT (delegated)
    // ===========================

    suspend fun submitSDT(submission: SDTSubmission, batchId: String?): Result<String> = sdtDelegate.submitSDT(submission, batchId)
    suspend fun getSDTSubmission(submissionId: String): Result<SDTSubmission?> = sdtDelegate.getSDTSubmission(submissionId)
    suspend fun getLatestSDTSubmission(userId: String): Result<SDTSubmission?> = sdtDelegate.getLatestSDTSubmission(userId)
    suspend fun updateSDTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> = sdtDelegate.updateSDTAnalysisStatus(submissionId, status)
    suspend fun updateSDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> = sdtDelegate.updateSDTOLQResult(submissionId, olqResult)
    suspend fun getSDTResult(submissionId: String): Result<OLQAnalysisResult?> = sdtDelegate.getSDTResult(submissionId)
    fun observeSDTSubmission(submissionId: String): Flow<SDTSubmission?> = sdtDelegate.observeSDTSubmission(submissionId)
}

// ===========================
// TAT DTOs
// ===========================

@Serializable
internal data class TATDataDto(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val stories: List<TATStoryDto> = emptyList(),
    val questions: List<TATQuestionDto> = emptyList(),
    val totalTimeTakenMinutes: Int = 0,
    val submittedAt: Long = 0L,
    val status: String = "",
    val instructorScore: TATInstructorScoreDto? = null,
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null,
    val analysisStatus: String? = null,
    val olqResult: OLQAnalysisResultDto? = null
)

@Serializable
internal data class TATStoryDto(
    val questionId: String = "",
    val story: String = "",
    val charactersCount: Int = 0,
    val viewingTimeTakenSeconds: Int = 0,
    val writingTimeTakenSeconds: Int = 0,
    val submittedAt: Long = 0L
)

@Serializable
internal data class TATQuestionDto(
    val id: String = "",
    val imageUrl: String = "",
    val cardPosition: Int = 0,
    val imageContextJson: String = "{}",
    val genderTag: String = "MIXED",
    val viewingTimeSeconds: Int = 30,
    val writingTimeMinutes: Int = 4,
    val minCharacters: Int = 150,
    val maxCharacters: Int = 1500
)

@Serializable
internal data class TATInstructorScoreDto(
    val overallScore: Float = 0f,
    val thematicPerceptionScore: Float = 0f,
    val imaginationScore: Float = 0f,
    val characterDepictionScore: Float = 0f,
    val emotionalToneScore: Float = 0f,
    val narrativeStructureScore: Float = 0f,
    val feedback: String = "",
    val storyWiseComments: Map<String, String> = emptyMap(),
    val gradedByInstructorId: String = "",
    val gradedByInstructorName: String = "",
    val gradedAt: Long = 0L,
    val agreedWithAI: Boolean = false
)

internal fun TATStoryResponse.toDto() = TATStoryDto(questionId, story, charactersCount, viewingTimeTakenSeconds, writingTimeTakenSeconds, submittedAt)
internal fun TATStoryDto.toDomain() = TATStoryResponse(questionId, story, charactersCount, viewingTimeTakenSeconds, writingTimeTakenSeconds, submittedAt)

internal fun TATQuestion.toDto() = TATQuestionDto(
    id = id,
    imageUrl = imageUrl,
    cardPosition = cardPosition,
    imageContextJson = imageContextJson,
    genderTag = genderTag,
    viewingTimeSeconds = viewingTimeSeconds,
    writingTimeMinutes = writingTimeMinutes,
    minCharacters = minCharacters,
    maxCharacters = maxCharacters
)

internal fun TATQuestionDto.toDomain() = TATQuestion(
    id = id,
    imageUrl = imageUrl,
    cardPosition = cardPosition,
    imageContextJson = imageContextJson,
    genderTag = genderTag,
    viewingTimeSeconds = viewingTimeSeconds,
    writingTimeMinutes = writingTimeMinutes,
    minCharacters = minCharacters,
    maxCharacters = maxCharacters
)

internal fun TATInstructorScore.toDto() = TATInstructorScoreDto(
    overallScore, thematicPerceptionScore, imaginationScore, characterDepictionScore,
    emotionalToneScore, narrativeStructureScore, feedback, storyWiseComments,
    gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

internal fun TATInstructorScoreDto.toDomain() = TATInstructorScore(
    overallScore, thematicPerceptionScore, imaginationScore, characterDepictionScore,
    emotionalToneScore, narrativeStructureScore, feedback, storyWiseComments,
    gradedByInstructorId, gradedByInstructorName, gradedAt, agreedWithAI
)

internal fun TATDataDto.toDomain(): TATSubmission = TATSubmission(
    id = id,
    userId = userId,
    testId = testId,
    stories = stories.map { it.toDomain() },
    questions = questions.map { it.toDomain() },
    totalTimeTakenMinutes = totalTimeTakenMinutes,
    submittedAt = submittedAt,
    status = runCatching { SubmissionStatus.valueOf(status) }.getOrDefault(SubmissionStatus.SUBMITTED_PENDING_REVIEW),
    instructorScore = instructorScore?.toDomain(),
    gradedByInstructorId = gradedByInstructorId,
    gradingTimestamp = gradingTimestamp,
    analysisStatus = analysisStatus?.let { runCatching { AnalysisStatus.valueOf(it) }.getOrDefault(AnalysisStatus.PENDING_ANALYSIS) } ?: AnalysisStatus.PENDING_ANALYSIS,
    olqResult = olqResult?.toDomain()
)
