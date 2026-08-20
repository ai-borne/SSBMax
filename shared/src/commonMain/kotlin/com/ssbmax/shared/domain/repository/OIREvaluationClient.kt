package com.ssbmax.shared.domain.repository

/**
 * Domain interface for server-authoritative OIR scoring.
 *
 * Phase 2 (Web SSB Test Flow Parity plan): `OIRTestScoreCalculator` used to
 * trust `OIRQuestion.correctAnswerId`/`correctAnswerIds`, which travel to the
 * client as part of the question payload -- a client could forge its own
 * score. This calls the `evaluateOIRAnswers` Cloud Function
 * (`functions/src/oirScoring.js`) instead, which independently re-fetches
 * each question's correct answer server-side and returns a verdict per
 * question id.
 *
 * `answersByBatch` is keyed by source `batchId` (see `OIRQuestion.batchId`)
 * because a KMP session's questions are drawn from a local cache pool
 * spanning many Firestore batches, not one whole batch -- the Cloud Function
 * fetches and scores each batch's subset independently, then aggregates.
 *
 * Implemented by [com.ssbmax.shared.data.repository.GitLiveOIREvaluationClient].
 */
interface OIREvaluationClient {
    suspend fun evaluateAnswers(
        answersByBatch: Map<String, Map<String, OIRSubmittedAnswer>>
    ): Result<OIREvaluationResult>
}

/** A single question's submitted answer, as sent to `evaluateOIRAnswers`. */
data class OIRSubmittedAnswer(
    val selectedOptionId: String? = null,
    val selectedOptionIds: Set<String> = emptySet(),
)

data class OIREvaluationResult(
    val score: Int,
    val total: Int,
    val percentage: Int,
    val oirRating: Int,
    /** Question id -> server-verified correctness. Authoritative; never client-derived. */
    val correctnessByQuestionId: Map<String, Boolean>,
)
