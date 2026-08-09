package com.ssbmax.shared.domain.usecase.oir

import kotlin.time.Clock

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
 *  2. Persist the submission using the durable session ID as its idempotency key.
 *  3. Record test usage with that same key so retries are deduplicated.
 *  4. Mark the test session as ended in Firestore.
 *  5. Invalidate the OLQ dashboard cache only after durable persistence succeeds.
 *
 * Returns `Result<String>` — the submission ID on success.
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

            // Step 2: Persist submission — use session ID as the document ID so the
            // result screen can load it without an extra Firestore lookup
            val submission = OIRSubmission(
                id          = session.sessionId,
                userId      = session.userId,
                testId      = session.testId,
                testResult  = result,
                submittedAt = Clock.System.now().toEpochMilliseconds(),
                status      = SubmissionStatus.SUBMITTED_PENDING_REVIEW
            )
            submissionRepository.submitOIR(submission, null).getOrThrow()

            // Step 3: Charge only after the result is durable. The stable submission ID makes
            // a retry safe for implementations that persist usage idempotency records.
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
