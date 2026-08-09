package com.ssbmax.navigation

import androidx.navigation.NavController
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TestType

/**
 * KMP port of `app/.../ui/tests/common/TestResultHandler.kt` -- SSOT for
 * post-submission routing (KMP-convergence plan, Phase 3b). OIR/PPDT/TAT/WAT/
 * PIQ/GTO_GD/GTO_LECTURETTE/GTO_GPE always land on their result screen
 * immediately (AI-graded, or -- for PIQ -- not graded at all). Every other
 * type (SRT/SD today) is subscription-gated: PREMIUM gets the immediate
 * result, FREE/PRO wait for manual assessor review on [SubmissionDetail].
 * Debug `Log.d` tracing from the Android original dropped -- it was
 * development scaffolding, not production logging.
 */
object TestResultHandler {

    private val DIRECT_RESULT_TEST_TYPES = setOf(
        TestType.OIR,
        TestType.PPDT,
        TestType.TAT,
        TestType.WAT,
        TestType.PIQ,
        TestType.GTO_GD,
        TestType.GTO_LECTURETTE,
        TestType.GTO_GPE
    )

    /**
     * Handle test submission navigation based on subscription tier.
     * @param submissionId The ID of the submitted test
     * @param subscriptionTier User's subscription tier (FREE, PRO, PREMIUM)
     * @param testType The type of test that was submitted
     * @param navController Navigation controller for routing
     */
    fun handleTestSubmission(
        submissionId: String,
        subscriptionTier: SubscriptionTier,
        testType: TestType,
        navController: NavController
    ) {
        if (testType in DIRECT_RESULT_TEST_TYPES) {
            navigateToResult(submissionId, testType, navController)
            return
        }

        when (subscriptionTier) {
            SubscriptionTier.PREMIUM -> navigateToResult(submissionId, testType, navController)
            SubscriptionTier.PRO,
            SubscriptionTier.FREE -> navigateToPendingReview(submissionId, navController)
        }
    }

    private fun navigateToResult(
        submissionId: String,
        testType: TestType,
        navController: NavController
    ) {
        val destination = when (testType) {
            TestType.OIR -> SSBMaxDestinations.OIRTestResult(submissionId)
            TestType.TAT -> SSBMaxDestinations.TATSubmissionResult(submissionId)
            TestType.WAT -> SSBMaxDestinations.WATSubmissionResult(submissionId)
            TestType.SRT -> SSBMaxDestinations.SRTSubmissionResult(submissionId)
            TestType.PPDT -> SSBMaxDestinations.PPDTSubmissionResult(submissionId)
            TestType.PIQ -> SSBMaxDestinations.PIQSubmissionResult(submissionId)
            TestType.SD -> SSBMaxDestinations.SDSubmissionResult(submissionId)
            TestType.GTO_GD -> SSBMaxDestinations.GTOGDResult(submissionId)
            TestType.GTO_LECTURETTE -> SSBMaxDestinations.GTOLecturetteResult(submissionId)
            TestType.GTO_GPE -> SSBMaxDestinations.GTOGPEResult(submissionId)
            else -> SSBMaxDestinations.SubmissionDetail(submissionId)
        }

        navController.navigate(destination) {
            popUpTo<SSBMaxDestinations.StudentHome> { saveState = false }
        }
    }

    private fun navigateToPendingReview(
        submissionId: String,
        navController: NavController
    ) {
        navController.navigate(SSBMaxDestinations.SubmissionDetail(submissionId)) {
            popUpTo<SSBMaxDestinations.StudentHome> { saveState = false }
        }
    }
}
