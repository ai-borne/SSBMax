package com.ssbmax.shared.data.service

import com.ssbmax.shared.domain.service.EvaluationFunctionsClient
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.functions.functions
import kotlinx.serialization.Serializable

@Serializable
private data class EvaluateSubmissionRequest(val submissionId: String)

/**
 * [EvaluationFunctionsClient] backed by the `evaluate*` Cloud Functions
 * (`functions/src/evaluation/{type}Evaluate.js`). Same GitLive `httpsCallable` pattern
 * as [com.ssbmax.shared.data.ai.GeminiProxyClient]/[GitLiveOIREvaluationClient] -- the
 * signed-in user's Firebase Auth ID token is attached automatically, so the function's
 * own ownership check (`submissions/{id}.userId === uid`) is what actually authorizes
 * the call, not anything this class does.
 *
 * Only `submissionId` is ever sent -- the function fetches and evaluates that
 * submission itself, so there is no result payload to parse back here; the caller's
 * existing Firestore submission listener observes the write reactively once the
 * function completes.
 */
class GitLiveEvaluationFunctionsClient : EvaluationFunctionsClient {

    override suspend fun evaluateWAT(submissionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("evaluateWAT").invoke(EvaluateSubmissionRequest(submissionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
