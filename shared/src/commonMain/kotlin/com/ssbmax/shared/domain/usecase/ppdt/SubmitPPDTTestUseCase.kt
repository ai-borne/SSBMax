@file:OptIn(ExperimentalUuidApi::class)
package com.ssbmax.shared.domain.usecase.ppdt

import kotlin.time.Clock

import com.ssbmax.shared.domain.model.PPDTSubmission
import com.ssbmax.shared.domain.model.PPDTTestSession
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.usecase.subscription.GetSubscriptionTierUseCase
import kotlinx.coroutines.flow.first
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

data class SubmitPPDTTestResult(
    val submissionId: String,
    val submission: PPDTSubmission,
    val subscriptionType: SubscriptionTier
)

/**
 * Builds the PPDTSubmission, persists it to Firestore, and records subscription usage.
 * WorkManager enqueuing and difficulty tracking remain in the ViewModel (Android/data concerns).
 */
class SubmitPPDTTestUseCase constructor(
    private val submissionRepository: SubmissionRepository,
    private val userProfileRepository: UserProfileRepository,
    private val getSubscriptionTier: GetSubscriptionTierUseCase,
    private val usageRecorder: TestUsageRecorder,
    private val testSessionRepository: TestSessionRepository
) {

    suspend operator fun invoke(session: PPDTTestSession): Result<SubmitPPDTTestResult> = runCatching {
        val profileResult = userProfileRepository.getUserProfile(session.userId).first()
        val userProfile = profileResult.getOrNull()
        val subscriptionType = getSubscriptionTier(session.userId).getOrDefault(SubscriptionTier.FREE)

        val submissionId = Uuid.random().toString()
        val submission = PPDTSubmission(
            submissionId = submissionId,
            questionId = session.questionId,
            userId = session.userId,
            userName = userProfile?.fullName ?: "Test User",
            userEmail = "",
            batchId = null,
            story = session.story,
            charactersCount = session.story.length,
            viewingTimeTakenSeconds = 30,
            writingTimeTakenMinutes = 4,
            submittedAt = Clock.System.now().toEpochMilliseconds(),
            status = SubmissionStatus.SUBMITTED_PENDING_REVIEW,
            instructorReview = null,
            analysisStatus = AnalysisStatus.PENDING_ANALYSIS,
            olqResult = null
        )

        submissionRepository.submitPPDT(submission, null).getOrThrow()
        usageRecorder.recordTestUsage(TestType.PPDT, session.userId, submissionId)
        testSessionRepository.completeTestSession(session.sessionId).getOrThrow()

        SubmitPPDTTestResult(submissionId, submission, subscriptionType)
    }
}
