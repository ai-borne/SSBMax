package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.repository.OIREvaluationClient
import com.ssbmax.shared.domain.repository.OIREvaluationResult
import com.ssbmax.shared.domain.repository.OIRSubmittedAnswer
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.functions.functions
import kotlinx.serialization.Serializable

@Serializable
private data class OIRAnswerWire(
    val selectedOptionId: String? = null,
    val selectedOptionIds: List<String> = emptyList(),
)

@Serializable
private data class EvaluateOIRRequest(
    val batches: Map<String, Map<String, OIRAnswerWire>>,
)

@Serializable
private data class OIRQuestionResultWire(
    val questionId: String,
    val isCorrect: Boolean,
)

@Serializable
private data class EvaluateOIRResponse(
    val score: Int,
    val total: Int,
    val percentage: Int,
    val oirRating: Int,
    val results: List<OIRQuestionResultWire> = emptyList(),
)

/**
 * [OIREvaluationClient] backed by the `evaluateOIRAnswers` Cloud Function
 * (`functions/src/oirScoring.js`'s multi-batch path). Same GitLive
 * `httpsCallable` pattern as [GeminiProxyClient]/[GitLiveTestUsageRecorder] --
 * the signed-in user's Firebase Auth ID token is attached automatically.
 */
class GitLiveOIREvaluationClient : OIREvaluationClient {

    override suspend fun evaluateAnswers(
        answersByBatch: Map<String, Map<String, OIRSubmittedAnswer>>
    ): Result<OIREvaluationResult> = try {
        val request = EvaluateOIRRequest(
            batches = answersByBatch.mapValues { (_, answers) ->
                answers.mapValues { (_, answer) ->
                    OIRAnswerWire(
                        selectedOptionId = answer.selectedOptionId,
                        selectedOptionIds = answer.selectedOptionIds.toList()
                    )
                }
            }
        )
        val result = Firebase.functions.httpsCallable("evaluateOIRAnswers").invoke(request)
        val response = result.data<EvaluateOIRResponse>()
        Result.success(
            OIREvaluationResult(
                score = response.score,
                total = response.total,
                percentage = response.percentage,
                oirRating = response.oirRating,
                correctnessByQuestionId = response.results.associate { it.questionId to it.isCorrect }
            )
        )
    } catch (e: Exception) {
        Result.failure(e)
    }
}
