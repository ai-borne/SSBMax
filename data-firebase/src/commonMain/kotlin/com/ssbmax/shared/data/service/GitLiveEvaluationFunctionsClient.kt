package com.ssbmax.shared.data.service

import com.ssbmax.shared.data.repository.InterviewResultDto
import com.ssbmax.shared.data.repository.InterviewSessionDto
import com.ssbmax.shared.data.repository.toDomain
import com.ssbmax.shared.domain.model.interview.InterviewMode
import com.ssbmax.shared.domain.model.interview.InterviewResult
import com.ssbmax.shared.domain.model.interview.InterviewSession
import com.ssbmax.shared.domain.service.EvaluationFunctionsClient
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.functions.functions
import kotlinx.serialization.Serializable

@Serializable
private data class EvaluateSubmissionRequest(val submissionId: String)

@Serializable
private data class EvaluateInterviewResponseRequest(val responseId: String, val sessionId: String)

@Serializable
private data class CreateInterviewSessionRequest(
    val mode: String,
    val piqSnapshotId: String,
    val consentGiven: Boolean
)

@Serializable
private data class CreateInterviewSessionResponse(val session: InterviewSessionDto)

@Serializable
private data class CompleteInterviewSessionRequest(val sessionId: String)

@Serializable
private data class CompleteInterviewSessionResponse(val result: InterviewResultDto)

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

    override suspend fun evaluateSRT(submissionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("evaluateSRT").invoke(EvaluateSubmissionRequest(submissionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun evaluateSD(submissionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("evaluateSD").invoke(EvaluateSubmissionRequest(submissionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun evaluateInterviewResponse(responseId: String, sessionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("evaluateInterviewResponse")
            .invoke(EvaluateInterviewResponseRequest(responseId, sessionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun createInterviewSession(
        mode: InterviewMode,
        piqSnapshotId: String,
        consentGiven: Boolean
    ): Result<InterviewSession> = try {
        val request = CreateInterviewSessionRequest(mode = mode.name, piqSnapshotId = piqSnapshotId, consentGiven = consentGiven)
        val result = Firebase.functions.httpsCallable("createInterviewSession").invoke(request)
        Result.success(result.data<CreateInterviewSessionResponse>().session.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun completeInterviewSession(sessionId: String): Result<InterviewResult> = try {
        val result = Firebase.functions.httpsCallable("completeInterviewSession").invoke(CompleteInterviewSessionRequest(sessionId))
        Result.success(result.data<CompleteInterviewSessionResponse>().result.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun evaluateGTO(submissionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("evaluateGTO").invoke(EvaluateSubmissionRequest(submissionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun evaluatePPDT(submissionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("evaluatePPDT").invoke(EvaluateSubmissionRequest(submissionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun evaluateTAT(submissionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("evaluateTAT").invoke(EvaluateSubmissionRequest(submissionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    override suspend fun notifyGradingComplete(submissionId: String): Result<Unit> = try {
        Firebase.functions.httpsCallable("notifyGradingComplete").invoke(EvaluateSubmissionRequest(submissionId))
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
