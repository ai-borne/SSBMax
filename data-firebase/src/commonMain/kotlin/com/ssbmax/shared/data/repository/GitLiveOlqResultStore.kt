package com.ssbmax.shared.data.repository

import com.ssbmax.shared.contracts.SsbContracts
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.CollectionReference
import dev.gitlive.firebase.firestore.firestore

internal const val PSYCH_FIELD_USER_ID = "userId"
internal const val PSYCH_FIELD_TEST_TYPE = "testType"
internal const val PSYCH_FIELD_SUBMITTED_AT = "submittedAt"
internal const val PSYCH_FIELD_DATA = "data"

/**
 * Shared Firestore collection handles + the OLQ-result read/write helpers common to every psych
 * test type (TAT/WAT/SRT/SDT). Extracted out of the former single
 * `GitLivePsychTestSubmissionRepository` god-class (300-line-file limit) so
 * [GitLivePsychTestSubmissionRepository] and its per-test-type delegates
 * ([GitLiveWATSubmissionDelegate], [GitLiveSRTSubmissionDelegate], [GitLiveSDTSubmissionDelegate])
 * share one Firestore connection and one copy of this logic instead of duplicating it four times.
 * Pure structural split — no behavior change from the original merged class.
 */
internal class GitLiveOlqResultStore {
    val submissionsCollection: CollectionReference = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)
    val psychResultsCollection: CollectionReference = Firebase.firestore.collection(SsbContracts.FirestorePaths.PSYCH_RESULTS)

    /** WAT/SRT/SDT's older two-step OLQ write (unlike TAT's atomic `finalizeTATAnalysisResult`). */
    suspend fun updateOlqResultTwoStep(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> {
      if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
      return try {
        val submissionDoc = submissionsCollection.document(submissionId).get()
        // userId is read generically from the top-level envelope, common to every test type's data shape.
        val userId = submissionDoc.get<String?>(PSYCH_FIELD_USER_ID)
        if (userId == null) {
            Result.failure(Exception("Cannot find userId for submission: $submissionId"))
        } else {
            psychResultsCollection.document(submissionId).set(olqResult.toDto(userId = userId), merge = true)
            submissionsCollection.document(submissionId)
                .update("$PSYCH_FIELD_DATA.analysisStatus" to SubmissionConstants.ANALYSIS_STATUS_COMPLETED)
            Result.success(Unit)
        }
      } catch (e: Exception) {
        Result.failure(Exception("Failed to update OLQ result: ${e.message}", e))
      }
    }

    suspend fun getOlqResult(submissionId: String): Result<OLQAnalysisResult?> {
      if (!isUsableDocumentId(submissionId)) return blankDocumentIdFailure("submissionId")
      return try {
        val resultDoc = psychResultsCollection.document(submissionId).get()
        if (resultDoc.exists) {
            Result.success(resultDoc.data(OLQAnalysisResultDto.serializer()).toDomain())
        } else {
            // Fallback: legacy/transitional documents that only ever wrote to submissions.data.olqResult.
            // Best-effort — dotted nested-field decode isn't proven against GitLive, so failures here
            // fall through to "no result" rather than failing the whole call.
            val olqDto = runCatching {
                submissionsCollection.document(submissionId).get()
                    .get<OLQAnalysisResultDto?>("$PSYCH_FIELD_DATA.olqResult")
            }.getOrNull()
            Result.success(olqDto?.toDomain())
        }
      } catch (e: Exception) {
        Result.failure(Exception("Failed to get OLQ result: ${e.message}", e))
      }
    }
}
