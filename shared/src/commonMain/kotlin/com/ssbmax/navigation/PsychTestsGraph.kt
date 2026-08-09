package com.ssbmax.navigation

import androidx.navigation.compose.composable
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.toRoute
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.ui.oir.OIRAnswerReviewScreen
import com.ssbmax.shared.ui.oir.OIRTestResultScreen
import com.ssbmax.shared.ui.oir.OIRTestScreen
import com.ssbmax.shared.ui.ppdt.PPDTSubmissionResultScreen
import com.ssbmax.shared.ui.ppdt.PPDTTestScreen
import com.ssbmax.shared.ui.tat.TATSubmissionResultScreen
import com.ssbmax.shared.ui.tat.TATTestScreen
import com.ssbmax.shared.ui.wat.WATSubmissionResultScreen
import com.ssbmax.shared.ui.wat.WATTestScreen

fun NavGraphBuilder.psychTestsGraph(navController: NavHostController) {
    composable<SSBMaxDestinations.OIRTest> { backStackEntry ->
        val testId = backStackEntry.toRoute<SSBMaxDestinations.OIRTest>().testId
        OIRTestScreen(
            onTestComplete = { submissionId, subscriptionType ->
                TestResultHandler.handleTestSubmission(
                    submissionId = submissionId,
                    subscriptionTier = subscriptionType,
                    testType = TestType.OIR,
                    navController = navController
                )
            },
            onNavigateBack = { navController.navigateUp() }
        )
    }

    composable<SSBMaxDestinations.OIRTestResult> { backStackEntry ->
        val submissionId = backStackEntry.toRoute<SSBMaxDestinations.OIRTestResult>().sessionId
        OIRTestResultScreen(
            submissionId = submissionId,
            onNavigateHome = {
                navController.navigate(SSBMaxDestinations.StudentHome) {
                    popUpTo<SSBMaxDestinations.StudentHome> { inclusive = true }
                }
            },
            onTakeAnotherTest = {
                navController.navigate(SSBMaxDestinations.OIRTest("oir_standard")) {
                    popUpTo<SSBMaxDestinations.OIRTestResult> { inclusive = true }
                }
            },
            onReviewAnswers = {
                navController.navigate(SSBMaxDestinations.OIRAnswerReview(submissionId))
            }
        )
    }

    composable<SSBMaxDestinations.OIRAnswerReview> { backStackEntry ->
        val submissionId = backStackEntry.toRoute<SSBMaxDestinations.OIRAnswerReview>().sessionId
        OIRAnswerReviewScreen(
            submissionId = submissionId,
            onNavigateBack = { navController.navigateUp() }
        )
    }

    composable<SSBMaxDestinations.PPDTTest> { backStackEntry ->
        val testId = backStackEntry.toRoute<SSBMaxDestinations.PPDTTest>().testId
        PPDTTestScreen(
            testId = testId,
            onTestComplete = { submissionId, subscriptionType ->
                TestResultHandler.handleTestSubmission(
                    submissionId = submissionId,
                    subscriptionTier = subscriptionType,
                    testType = TestType.PPDT,
                    navController = navController
                )
            },
            onNavigateBack = { navController.navigateUp() }
        )
    }

    // PPDT reachability gap, named explicitly (same shape as the OIR gap
    // documented above): the Android original's `PPDTSubmissionResultScreen`
    // has no "retake test" callback either (only `onNavigateHome`), so unlike
    // OIR's result screen, there is genuinely no in-graph path back to
    // `PPDTTest` today -- it's reachable only via `StudentHomeScreen`'s
    // "view past PPDT result" tile landing on `PPDTSubmissionResult`, which
    // itself has no forward link to `PPDTTest`. The route is still registered
    // here (not omitted) so a future direct-navigation caller or deep link has
    // somewhere real to land, consistent with this graph's own "no crash on
    // unregistered destination" principle.
    composable<SSBMaxDestinations.PPDTSubmissionResult> { backStackEntry ->
        val submissionId = backStackEntry.toRoute<SSBMaxDestinations.PPDTSubmissionResult>().submissionId
        PPDTSubmissionResultScreen(
            submissionId = submissionId,
            onNavigateHome = {
                navController.navigate(SSBMaxDestinations.StudentHome) {
                    popUpTo<SSBMaxDestinations.StudentHome> { inclusive = true }
                }
            }
        )
    }

    composable<SSBMaxDestinations.TATTest> { backStackEntry ->
        val testId = backStackEntry.toRoute<SSBMaxDestinations.TATTest>().testId
        TATTestScreen(
            testId = testId,
            onTestComplete = { submissionId, subscriptionType ->
                TestResultHandler.handleTestSubmission(
                    submissionId = submissionId,
                    subscriptionTier = subscriptionType,
                    testType = TestType.TAT,
                    navController = navController
                )
            },
            onNavigateBack = { navController.navigateUp() }
        )
    }

    // TAT reachability gap, named explicitly (same shape as the PPDT gap
    // documented above): the Android original's `TATSubmissionResultScreen`
    // has no "retake test" callback either (only `onNavigateHome`), so there is
    // genuinely no in-graph path back to `TATTest` today -- it's reachable only
    // via `StudentHomeScreen`'s "view past TAT result" tile landing on
    // `TATSubmissionResult`, which itself has no forward link to `TATTest`. The
    // route is still registered here (not omitted) so a future direct-navigation
    // caller or deep link has somewhere real to land, consistent with this
    // graph's own "no crash on unregistered destination" principle.
    composable<SSBMaxDestinations.TATSubmissionResult> { backStackEntry ->
        val submissionId = backStackEntry.toRoute<SSBMaxDestinations.TATSubmissionResult>().submissionId
        TATSubmissionResultScreen(
            submissionId = submissionId,
            onNavigateHome = {
                navController.navigate(SSBMaxDestinations.StudentHome) {
                    popUpTo<SSBMaxDestinations.StudentHome> { inclusive = true }
                }
            }
        )
    }

    composable<SSBMaxDestinations.WATTest> { backStackEntry ->
        val testId = backStackEntry.toRoute<SSBMaxDestinations.WATTest>().testId
        WATTestScreen(
            testId = testId,
            onTestComplete = { submissionId, subscriptionType ->
                TestResultHandler.handleTestSubmission(
                    submissionId = submissionId,
                    subscriptionTier = subscriptionType,
                    testType = TestType.WAT,
                    navController = navController
                )
            },
            onNavigateBack = { navController.navigateUp() }
        )
    }

    // WAT reachability gap, named explicitly (same shape as the TAT gap
    // documented above): the Android original's `WATSubmissionResultScreen`
    // has no "retake test" callback either (only `onNavigateHome`), so there is
    // genuinely no in-graph path back to `WATTest` today -- it's reachable only
    // via `StudentHomeScreen`'s "view past WAT result" tile landing on
    // `WATSubmissionResult`, which itself has no forward link to `WATTest`. The
    // route is still registered here (not omitted) so a future direct-navigation
    // caller or deep link has somewhere real to land, consistent with this
    // graph's own "no crash on unregistered destination" principle.
    composable<SSBMaxDestinations.WATSubmissionResult> { backStackEntry ->
        val submissionId = backStackEntry.toRoute<SSBMaxDestinations.WATSubmissionResult>().submissionId
        WATSubmissionResultScreen(
            submissionId = submissionId,
            onNavigateHome = {
                navController.navigate(SSBMaxDestinations.StudentHome) {
                    popUpTo<SSBMaxDestinations.StudentHome> { inclusive = true }
                }
            }
        )
    }
}
