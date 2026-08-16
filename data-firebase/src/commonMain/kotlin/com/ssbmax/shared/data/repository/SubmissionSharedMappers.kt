package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import dev.gitlive.firebase.firestore.SnapshotMetadata
import kotlinx.serialization.Serializable

/**
 * Shared submission-cluster constants, mirroring the Android SubmissionConstants object
 * (core:data/remote/SubmissionMappers.kt). `internal` so it's shared across this package's
 * GitLive*SubmissionRepository classes without being exposed outside `shared`.
 */
internal object SubmissionConstants {
    const val ANALYSIS_STATUS_COMPLETED = "COMPLETED"
    const val ANALYSIS_STATUS_PENDING = "PENDING_ANALYSIS"
    const val ANALYSIS_STATUS_ANALYZING = "ANALYZING"
    const val FIELD_DATA = "data"
}

/**
 * `true` when [id] is safe to pass into a GitLive `.document(id)` call. GitLive's Firestore SDK
 * throws an uncatchable native `FIRInvalidArgumentException` on iOS for `.document("")` -- it
 * crashes the app instead of failing the surrounding `Result`, so every `GitLive*Repository`/
 * `*Delegate`/`*Store` method that takes an id param must check this *before* calling `.document`,
 * not rely on a caller having already filtered it out (that was tried once, in
 * `GetOLQDashboardUseCase`, and only covered the two call sites it happened to touch).
 */
internal fun isUsableDocumentId(id: String): Boolean = id.isNotBlank()

/** Standard `Result.failure` for a blank id, matching every file's own message-wrapping style. */
internal fun <T> blankDocumentIdFailure(paramName: String): Result<T> =
    Result.failure(IllegalArgumentException("$paramName must not be blank"))

/**
 * Wire format for [OLQAnalysisResult], shared by every OLQ-scored test type (TAT/WAT/SRT/SDT/PPDT/GTO).
 * Mirrors the Android OLQMapper.toFirestoreMap()/parseSharedOLQResult() pair.
 *
 * `userId` is populated only when writing to `psych_results`/`ppdt_results` (required by Firestore
 * security rules there, same as the Android original) — it's not part of the domain [OLQAnalysisResult].
 *
 * **`overallScore`'s default is `5f`, deliberately not `0f`, matching the Android original for
 * TAT/WAT/SRT/SDT specifically:** the Android original is internally inconsistent between test
 * types — `PsychTestMapper.parseOLQResult` (TAT/WAT/SRT/SDT's actual code path) delegates to
 * `OLQResultMapper.parseSharedOLQResult`, which defaults to `5f`, while `SubmissionMappers.parseOLQResult`
 * (PPDT's separate code path, via `PPDTSubmissionMappers`) defaults to `0f`. A single shared DTO
 * can't reproduce both; `5f` was chosen because it's what 4 of the 5 OLQ-scored test types actually
 * used. Named here rather than silently resolved either way — a missing/malformed `overallScore`
 * field is an edge case with no real production reports either direction, not a claim that `5f` is
 * objectively more correct than `0f`.
 */
@Serializable
internal data class OLQAnalysisResultDto(
    val submissionId: String = "",
    val testType: String = "",
    val olqScores: Map<String, OLQScoreDto> = emptyMap(),
    val overallScore: Float = 5f,
    val overallRating: String = "",
    val strengths: List<String> = emptyList(),
    val weaknesses: List<String> = emptyList(),
    val recommendations: List<String> = emptyList(),
    val analyzedAt: Long = 0L,
    val aiConfidence: Int = 0,
    val validStoriesCount: Int = 0,
    val failedStoriesCount: Int = 0,
    val usedPartialAssessment: Boolean = false,
    val userId: String? = null
)

internal fun OLQAnalysisResult.toDto(userId: String? = null): OLQAnalysisResultDto = OLQAnalysisResultDto(
    submissionId = submissionId,
    testType = testType.name,
    olqScores = olqScores.entries.associate { (olq, score) -> olq.name to score.toDto() },
    overallScore = overallScore,
    overallRating = overallRating,
    strengths = strengths,
    weaknesses = weaknesses,
    recommendations = recommendations,
    analyzedAt = analyzedAt,
    aiConfidence = aiConfidence,
    validStoriesCount = validStoriesCount,
    failedStoriesCount = failedStoriesCount,
    usedPartialAssessment = usedPartialAssessment,
    userId = userId
)

/**
 * Returns null (not throws) for an unparseable/missing test type, same defensive behavior as
 * the Android `parseSharedOLQResult`.
 */
internal fun OLQAnalysisResultDto.toDomain(): OLQAnalysisResult? {
    val parsedTestType = runCatching { TestType.valueOf(testType) }.getOrNull() ?: return null
    val parsedScores = olqScores.mapNotNull { (key, dto) ->
        runCatching { OLQ.valueOf(key) }.getOrNull()?.let { it to dto.toDomain() }
    }.toMap()
    return OLQAnalysisResult(
        submissionId = submissionId,
        testType = parsedTestType,
        olqScores = parsedScores,
        overallScore = overallScore,
        overallRating = overallRating,
        strengths = strengths,
        weaknesses = weaknesses,
        recommendations = recommendations,
        analyzedAt = analyzedAt,
        aiConfidence = aiConfidence,
        validStoriesCount = validStoriesCount,
        failedStoriesCount = failedStoriesCount,
        usedPartialAssessment = usedPartialAssessment
    )
}

/**
 * Common "submissions" collection document envelope shared by every test type in this cluster
 * (TAT/WAT/SRT/SDT/PPDT/GTO all write this same outer shape, only `data`'s inner type differs).
 * Generic so each `GitLive*SubmissionRepository` can plug in its own typed `data` payload instead
 * of duplicating this envelope per test type.
 */
@Serializable
internal data class SubmissionDocDto<T>(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val testType: String = "",
    val status: String = "",
    val submittedAt: Long = 0L,
    val gradedByInstructorId: String? = null,
    val gradingTimestamp: Long? = null,
    val batchId: String? = null,
    val data: T
)

/**
 * OLQ regression protection, ported from the Android OLQRegressionFilter (SubmissionMappers.kt).
 * Prevents a stale Firestore cache snapshot (delivered after reconnect) from overwriting a
 * submission's completed OLQ-analysis state on the observed [Flow] with older PENDING data.
 */
internal class OLQRegressionFilter {
    private var hasSeenCompleteAnalysis = false

    fun shouldFilterSnapshot(
        analysisStatus: String?,
        hasOlqResult: Boolean,
        metadata: SnapshotMetadata
    ): Boolean {
        val isComplete = analysisStatus == SubmissionConstants.ANALYSIS_STATUS_COMPLETED && hasOlqResult
        if (isComplete) {
            hasSeenCompleteAnalysis = true
        }
        val isFromCacheOnly = metadata.isFromCache && !metadata.hasPendingWrites
        return hasSeenCompleteAnalysis && !isComplete && isFromCacheOnly
    }
}
