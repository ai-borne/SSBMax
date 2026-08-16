@file:OptIn(ExperimentalUuidApi::class)
package com.ssbmax.shared.domain.usecase.oir

import kotlin.time.Clock
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

import com.ssbmax.shared.domain.model.*
import com.ssbmax.shared.domain.repository.OIREvaluationClient
import com.ssbmax.shared.domain.repository.OIRSubmittedAnswer
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase

/**
 * Orchestrates the full OIR test-submission pipeline in a single, testable use case.
 *
 * Steps (run in strict order — any failure short-circuits remaining steps):
 *  1. Get the server-authoritative per-question correctness verdict, then calculate the
 *     score from it. Phase 2 (Web SSB Test Flow Parity plan): scoring used to trust
 *     `OIRQuestion.correctAnswerId`, which travels to the client -- a modified client
 *     could forge its own score. Session questions are grouped by their source
 *     `batchId` (a session's questions are drawn from a local cache pool spanning many
 *     Firestore batches, not one whole batch) before calling `evaluateOIRAnswers`.
 *  2. Persist the submission under a freshly minted submission ID, distinct from the
 *     durable session ID — each attempt (including a retake of the same session) gets
 *     its own document, matching PPDT/TAT/WAT/SRT/SD.
 *  3. Record test usage against that submission ID so every attempt counts.
 *  4. Mark the test session as ended in Firestore.
 *  5. Invalidate the OLQ dashboard cache only after durable persistence succeeds.
 *
 * Returns `Result<OIRSubmissionOutcome>` — the freshly minted submission ID plus the
 * server-scored [OIRTestResult] on success, so callers (the OIR ViewModel) never need
 * their own [OIRTestScoreCalculator] dependency or a second, redundant scoring call.
 */
data class OIRSubmissionOutcome(
    val submissionId: String,
    val testResult: OIRTestResult,
)

class SubmitOIRTestUseCase constructor(
    private val evaluationClient: OIREvaluationClient,
    private val scoreCalculator: OIRTestScoreCalculator,
    private val usageRecorder: TestUsageRecorder,
    private val dashboardUseCase: GetOLQDashboardUseCase,
    private val submissionRepository: SubmissionRepository,
    private val testSessionRepository: TestSessionRepository,
    private val testContentRepository: TestContentRepository
) {

    suspend operator fun invoke(session: OIRTestSession): Result<OIRSubmissionOutcome> {
        return runCatching {
            // Step 1: Server-authoritative scoring
            val answersByBatch: Map<String, Map<String, OIRSubmittedAnswer>> = session.questions
                .groupBy { it.batchId }
                .mapValues { (_, questionsInBatch) ->
                    questionsInBatch.associate { question ->
                        val answer = session.answers[question.id]
                        question.id to OIRSubmittedAnswer(
                            selectedOptionId = answer?.selectedOptionId,
                            selectedOptionIds = answer?.selectedOptionIds ?: emptySet()
                        )
                    }
                }
            val evaluation = evaluationClient.evaluateAnswers(answersByBatch).getOrThrow()
            val result = scoreCalculator.calculate(session, evaluation.correctnessByQuestionId)

            // Step 2: Persist submission under a fresh, unique ID — each attempt (including a
            // retake of the same session) gets its own document, so a retake's result is never
            // silently dropped by an id collision with a prior attempt.
            val submission = OIRSubmission(
                id          = Uuid.random().toString(),
                userId      = session.userId,
                testId      = session.testId,
                testResult  = result,
                submittedAt = Clock.System.now().toEpochMilliseconds(),
                status      = SubmissionStatus.SUBMITTED_PENDING_REVIEW
            )
            submissionRepository.submitOIR(submission, null).getOrThrow()

            // Step 3: Charge only after the result is durable. The fresh, unique submission ID
            // means every attempt is counted — there is no cross-attempt id collision to dedupe.
            usageRecorder.recordTestUsage(TestType.OIR, session.userId, submission.id)

            // Step 4: Complete the durable test session
            testSessionRepository.completeTestSession(session.sessionId).getOrThrow()

            // Step 5: Refresh only after submission persistence and quota recording succeed.
            dashboardUseCase.invalidateCache(session.userId)

            // Step 6: Mark served questions as used (best-effort — never fails the submission)
            runCatching {
                testContentRepository.markOIRQuestionsUsed(session.questions.map { it.id })
            }

            // Return the submission ID and the server-scored result together
            OIRSubmissionOutcome(submissionId = submission.id, testResult = result)
        }
    }
}
