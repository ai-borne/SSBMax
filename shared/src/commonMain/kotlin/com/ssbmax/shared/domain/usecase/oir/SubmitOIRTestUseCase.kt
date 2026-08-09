@file:OptIn(ExperimentalUuidApi::class)
package com.ssbmax.shared.domain.usecase.oir

import kotlin.time.Clock
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

import com.ssbmax.shared.domain.model.*
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase

/**
 * Orchestrates the full OIR test-submission pipeline in a single, testable use case.
 *
 * Steps (run in strict order — any failure short-circuits remaining steps):
 *  1. Calculate score from the completed session.
 *  2. Persist the submission under a freshly minted submission ID, distinct from the
 *     durable session ID — each attempt (including a retake of the same session) gets
 *     its own document, matching PPDT/TAT/WAT/SRT/SD.
 *  3. Record test usage against that submission ID so every attempt counts.
 *  4. Mark the test session as ended in Firestore.
 *  5. Invalidate the OLQ dashboard cache only after durable persistence succeeds.
 *
 * Returns `Result<String>` — the freshly minted submission ID on success.
 */
class SubmitOIRTestUseCase constructor(
    private val scoreCalculator: OIRTestScoreCalculator,
    private val usageRecorder: TestUsageRecorder,
    private val dashboardUseCase: GetOLQDashboardUseCase,
    private val submissionRepository: SubmissionRepository,
    private val testSessionRepository: TestSessionRepository,
    private val testContentRepository: TestContentRepository
) {

    suspend operator fun invoke(session: OIRTestSession): Result<String> {
        return runCatching {
            // Step 1: Calculate score
            val result = scoreCalculator.calculate(session)

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

            // Return the submission ID
            submission.id
        }
    }
}
