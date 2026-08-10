package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.gto.GTOSubmission
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed port of the Android `GTOSubmissionRepository` (GD/GPE/Lecturette
 * submission writes only — this is distinct from `GitLiveGTORepository`, which handles GTO test
 * content, progress, and results reads, matching the same class split as the Android originals).
 *
 * Same "submissions" collection and document shape as the Android original, including the
 * pre-existing quirk (not fixed here) that the top-level `status` field is written from
 * [GTOSubmission]'s own `GTOSubmissionStatus` enum rather than the [com.ssbmax.shared.domain.model.SubmissionStatus]
 * enum every other test type in this same collection uses — same inconsistency as the Android
 * original, ported faithfully rather than silently normalized.
 */
class GitLiveGTOSubmissionRepository {

    private val submissionsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)

    suspend fun submitGPE(submission: GTOSubmission.GPESubmission, batchId: String?): Result<String> = try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.GTO_GPE.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            batchId = batchId,
            data = GPESubmissionDataDto(
                imageUrl = submission.imageUrl,
                scenario = submission.scenario,
                solution = submission.solution,
                plan = submission.plan,
                characterCount = submission.characterCount,
                timeSpent = submission.timeSpent,
                olqScores = submission.olqScores.entries.associate { (olq, score) -> olq.name to score.toDto() }
            )
        )
        submissionsCollection.document(submission.id).set(doc, merge = true)
        Result.success(submission.id)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to submit GPE: ${e.message}", e))
    }

    suspend fun submitGD(submission: GTOSubmission.GDSubmission, batchId: String?): Result<String> = try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.GTO_GD.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            batchId = batchId,
            data = GDSubmissionDataDto(
                topic = submission.topic,
                response = submission.response,
                charCount = submission.charCount,
                timeSpent = submission.timeSpent,
                olqScores = submission.olqScores.entries.associate { (olq, score) -> olq.name to score.toDto() }
            )
        )
        submissionsCollection.document(submission.id).set(doc, merge = true)
        Result.success(submission.id)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to submit GD: ${e.message}", e))
    }

    suspend fun submitLecturette(submission: GTOSubmission.LecturetteSubmission, batchId: String?): Result<String> = try {
        val doc = SubmissionDocDto(
            id = submission.id,
            userId = submission.userId,
            testId = submission.testId,
            testType = TestType.GTO_LECTURETTE.name,
            status = submission.status.name,
            submittedAt = submission.submittedAt,
            batchId = batchId,
            data = LecturetteSubmissionDataDto(
                topicChoices = submission.topicChoices,
                selectedTopic = submission.selectedTopic,
                speechTranscript = submission.speechTranscript,
                charCount = submission.charCount,
                timeSpent = submission.timeSpent,
                olqScores = submission.olqScores.entries.associate { (olq, score) -> olq.name to score.toDto() }
            )
        )
        submissionsCollection.document(submission.id).set(doc, merge = true)
        Result.success(submission.id)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to submit Lecturette: ${e.message}", e))
    }

}

@Serializable
internal data class GPESubmissionDataDto(
    val imageUrl: String = "",
    val scenario: String = "",
    val solution: String? = null,
    val plan: String = "",
    val characterCount: Int = 0,
    val timeSpent: Int = 0,
    val olqScores: Map<String, OLQScoreDto> = emptyMap()
)

@Serializable
internal data class GDSubmissionDataDto(
    val topic: String = "",
    val response: String = "",
    val charCount: Int = 0,
    val timeSpent: Int = 0,
    val olqScores: Map<String, OLQScoreDto> = emptyMap()
)

@Serializable
internal data class LecturetteSubmissionDataDto(
    val topicChoices: List<String> = emptyList(),
    val selectedTopic: String = "",
    val speechTranscript: String = "",
    val charCount: Int = 0,
    val timeSpent: Int = 0,
    val olqScores: Map<String, OLQScoreDto> = emptyMap()
)
