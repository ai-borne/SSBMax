package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.gto.GTOSubmission
import com.ssbmax.shared.domain.model.gto.GTOSubmissionStatus
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.OLQScore
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.Query
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * GTO submission read/write cluster (`getSubmission`/`observeSubmission`/`updateSubmissionStatus`/
 * `updateSubmissionOLQScores`/`getUserSubmissions`/`getPendingSubmissions`), split out of the
 * former single `GitLiveGTORepository` god-class (300-line-file limit) — see
 * [GitLiveGTORepository]'s class doc for the nested-vs-legacy `data` field merge and the
 * "PGT/HGT/GOR/IO/CT are unreachable from mapToSubmission" dead-code finding this port carries
 * forward. Pure structural split — no behavior change from the original merged class.
 */
internal class GitLiveGTOSubmissionDelegate(private val collections: GitLiveGTOCollections) {

    private val submissionsCollection get() = collections.submissions
    private val resultsCollection get() = collections.results

    suspend fun getSubmission(submissionId: String): Result<GTOSubmission> {
        if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
        return try {
            val doc = submissionsCollection.document(submissionId).get()
            if (!doc.exists) {
                Result.failure(Exception("Submission not found: $submissionId"))
            } else {
                Result.success(doc.data(GTOSubmissionDocDto.serializer()).toDomain())
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun observeSubmission(submissionId: String): Flow<GTOSubmission?> {
        if (!isUsableDocumentId(submissionId)) return kotlinx.coroutines.flow.flowOf(null)
        return submissionsCollection.document(submissionId).snapshots
            .map { snap ->
                if (snap.exists) {
                    runCatching { snap.data(GTOSubmissionDocDto.serializer()).toDomain() }.getOrNull()
                } else {
                    null
                }
            }
    }

    suspend fun updateSubmissionStatus(
        submissionId: String,
        status: GTOSubmissionStatus
    ): Result<Unit> {
        if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
        return try {
            submissionsCollection.document(submissionId).update(GTO_FIELD_STATUS to status.name)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateSubmissionOLQScores(
        submissionId: String,
        olqScores: Map<OLQ, OLQScore>
    ): Result<Unit> {
      if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
      return try {
        val submissionDoc = submissionsCollection.document(submissionId).get()
        if (!submissionDoc.exists) {
            Result.failure(Exception("Submission not found: $submissionId"))
        } else {
            val submissionDto = submissionDoc.data(GTOSubmissionDocDto.serializer())
            val testType = runCatching { GTOTestType.valueOf(submissionDto.testType) }
                .getOrElse { parseGtoSubmissionTestType(submissionDto.testType) ?: GTOTestType.GROUP_DISCUSSION }
            val overallScore = olqScores.values.map { it.score }.average().toFloat()
            val aiConfidence = olqScores.values.map { it.confidence }.average().toInt()

            val resultDto = GTOResultDto(
                submissionId = submissionId,
                userId = submissionDto.userId,
                testType = testType.name,
                olqScores = olqScores.entries.associate { (olq, score) -> olq.name to score.toDto() },
                overallScore = overallScore,
                overallRating = calculateGtoRating(overallScore),
                aiConfidence = aiConfidence,
                analyzedAt = Clock.System.now().toEpochMilliseconds()
            )

            val batch = Firebase.firestore.batch()
            batch.set(resultsCollection.document(submissionId), resultDto)
            batch.update(submissionsCollection.document(submissionId), GTO_FIELD_STATUS to GTOSubmissionStatus.COMPLETED.name)
            batch.commit()

            Result.success(Unit)
        }
      } catch (e: Exception) {
        Result.failure(e)
      }
    }

    suspend fun getUserSubmissions(
        userId: String,
        testType: GTOTestType?
    ): Result<List<GTOSubmission>> = try {
        var query: Query = submissionsCollection.where { GTO_FIELD_USER_ID equalTo userId }
        if (testType != null) {
            query = query.where { GTO_FIELD_TEST_TYPE equalTo gtoTestTypeToTestType(testType).name }
        }
        query = query.orderBy(GTO_FIELD_SUBMITTED_AT, Direction.DESCENDING)

        val snapshot = query.get()
        val submissions = snapshot.documents.mapNotNull { doc ->
            runCatching { doc.data(GTOSubmissionDocDto.serializer()).toDomain() }.getOrNull()
        }

        Result.success(submissions)
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getPendingSubmissions(limit: Int): Result<List<GTOSubmission>> = try {
        val snapshot = submissionsCollection
            .where { GTO_FIELD_STATUS equalTo GTOSubmissionStatus.PENDING_ANALYSIS.name }
            .orderBy(GTO_FIELD_SUBMITTED_AT, Direction.ASCENDING)
            .limit(limit)
            .get()

        val submissions = snapshot.documents.mapNotNull { doc ->
            runCatching { doc.data(GTOSubmissionDocDto.serializer()).toDomain() }.getOrNull()
        }

        Result.success(submissions)
    } catch (e: Exception) {
        Result.failure(e)
    }
}

/**
 * Robustness fix carried over from the Android original: if OLQ scores are present but status
 * still says PENDING_ANALYSIS/ANALYZING, infer COMPLETED so the UI doesn't get stuck.
 */
internal fun inferCompletedGtoStatus(status: GTOSubmissionStatus, hasScores: Boolean): GTOSubmissionStatus =
    if (hasScores && (status == GTOSubmissionStatus.PENDING_ANALYSIS || status == GTOSubmissionStatus.ANALYZING)) {
        GTOSubmissionStatus.COMPLETED
    } else {
        status
    }

/**
 * Only recognizes the three test types the Android original's `mapToSubmission` could ever reach
 * (see [GitLiveGTORepository]'s class doc: PGT/HGT/GOR/IO/CT were dead code there, since this same
 * parse threw first).
 */
internal fun parseGtoSubmissionTestType(raw: String): GTOTestType? = when (raw) {
    "GTO_GD", "GROUP_DISCUSSION" -> GTOTestType.GROUP_DISCUSSION
    "GTO_LECTURETTE", "LECTURETTE" -> GTOTestType.LECTURETTE
    "GTO_GPE", "GROUP_PLANNING_EXERCISE" -> GTOTestType.GROUP_PLANNING_EXERCISE
    else -> null
}

internal fun GTOSubmissionDocDto.toDomain(): GTOSubmission {
    val parsedTestType = parseGtoSubmissionTestType(testType)
        ?: throw IllegalArgumentException("Unknown or unsupported GTO submission test type: $testType")

    val status = runCatching { GTOSubmissionStatus.valueOf(status) }.getOrDefault(GTOSubmissionStatus.PENDING_ANALYSIS)
    val parsedScores = olqScores.mapNotNull { (key, dto) ->
        runCatching { OLQ.valueOf(key) }.getOrNull()?.let { it to dto.toDomain() }
    }.toMap()
    val finalStatus = inferCompletedGtoStatus(status, parsedScores.isNotEmpty())

    val hasNestedData = data != null
    val fields = data ?: GTOSubmissionFieldsDto()
    fun <T> pick(nestedVal: T?, rootVal: T?, default: T): T =
        if (hasNestedData) nestedVal ?: default else rootVal ?: default

    return when (parsedTestType) {
        GTOTestType.GROUP_DISCUSSION -> GTOSubmission.GDSubmission(
            id = id,
            userId = userId,
            testId = testId,
            topic = pick(fields.topic, topic, ""),
            response = pick(fields.response, response, ""),
            charCount = pick(fields.charCount, charCount, 0),
            submittedAt = submittedAt,
            timeSpent = pick(fields.timeSpent, timeSpent, 0),
            status = finalStatus,
            olqScores = parsedScores
        )

        GTOTestType.GROUP_PLANNING_EXERCISE -> GTOSubmission.GPESubmission(
            id = id,
            userId = userId,
            testId = testId,
            imageUrl = pick(fields.imageUrl, imageUrl, ""),
            scenario = pick(fields.scenario, scenario, ""),
            solution = if (hasNestedData) fields.solution else solution,
            plan = pick(fields.plan, plan, ""),
            characterCount = pick(fields.characterCount, characterCount, 0),
            submittedAt = submittedAt,
            timeSpent = pick(fields.timeSpent, timeSpent, 0),
            status = finalStatus,
            olqScores = parsedScores
        )

        GTOTestType.LECTURETTE -> GTOSubmission.LecturetteSubmission(
            id = id,
            userId = userId,
            testId = testId,
            topicChoices = pick(fields.topicChoices, topicChoices, emptyList()),
            selectedTopic = pick(fields.selectedTopic, selectedTopic, ""),
            speechTranscript = pick(fields.speechTranscript, speechTranscript, ""),
            charCount = pick(fields.charCount, charCount, 0),
            submittedAt = submittedAt,
            timeSpent = pick(fields.timeSpent, timeSpent, 0),
            status = finalStatus,
            olqScores = parsedScores
        )

        else -> error("Unreachable: parseGtoSubmissionTestType never returns $parsedTestType")
    }
}

/** Mirrors the nested `data` object the Android original writes/reads for GD/GPE/Lecturette fields. */
@Serializable
internal data class GTOSubmissionFieldsDto(
    val topic: String? = null,
    val response: String? = null,
    val charCount: Int? = null,
    val imageUrl: String? = null,
    val scenario: String? = null,
    val solution: String? = null,
    val plan: String? = null,
    val characterCount: Int? = null,
    val topicChoices: List<String>? = null,
    val selectedTopic: String? = null,
    val speechTranscript: String? = null,
    val timeSpent: Int? = null
)

/**
 * Submission document shape. Carries both the nested `data` object (current write format) and the
 * flattened root-level fields (legacy format, pre-dating the nested `data` convention) — the
 * Android original reads whichever is present, preferring nested when it exists; see
 * [GTOSubmissionDocDto.toDomain].
 */
@Serializable
internal data class GTOSubmissionDocDto(
    val id: String = "",
    val userId: String = "",
    val testId: String = "",
    val testType: String = "",
    val submittedAt: Long = 0L,
    val timeSpent: Int = 0,
    val status: String = "PENDING_ANALYSIS",
    val olqScores: Map<String, OLQScoreDto> = emptyMap(),
    val data: GTOSubmissionFieldsDto? = null,
    val topic: String? = null,
    val response: String? = null,
    val charCount: Int? = null,
    val imageUrl: String? = null,
    val scenario: String? = null,
    val solution: String? = null,
    val plan: String? = null,
    val characterCount: Int? = null,
    val topicChoices: List<String>? = null,
    val selectedTopic: String? = null,
    val speechTranscript: String? = null
)
