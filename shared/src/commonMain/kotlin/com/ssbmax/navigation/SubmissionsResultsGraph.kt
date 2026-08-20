package com.ssbmax.navigation

import androidx.navigation.compose.composable
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.toRoute
import com.ssbmax.shared.domain.model.TestPhase
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.ui.analytics.AnalyticsScreen
import com.ssbmax.shared.ui.marketplace.MarketplaceScreen
import com.ssbmax.shared.ui.placeholder.NotYetPortedScreen
import com.ssbmax.shared.ui.results.HistoricResultsScreen
import com.ssbmax.shared.ui.studenttests.StudentTestsScreen
import com.ssbmax.shared.ui.submissions.SubmissionDetailScreen
import com.ssbmax.shared.ui.submissions.SubmissionsListScreen

fun NavGraphBuilder.submissionsResultsGraph(navController: NavHostController) {
    // Join Batch (KMP-convergence Phase 3a, row #11) -- `batch/join` was
    // unregistered in both the Android and shared graphs, yet the shared drawer
    // (`SSBMaxAppScaffold.kt`) navigates to it -- a crash
    // on both platforms today. No `JoinBatchScreen` exists yet on either
    // platform (this is a real feature gap, not a KMP-port regression), so
    // this registers the honest placeholder rather than inventing new scope.
    composable<SSBMaxDestinations.JoinBatch> {
        NotYetPortedScreen("Join Batch")
    }

    // Marketplace -- coaching-institute directory, mock data only (no backend
    // on either platform). onInstituteClick routes to the honest placeholder --
    // there is no ported institute-detail screen yet (the Android original's
    // own `onInstituteClick` callback is also just a `// TODO: Navigate to
    // institute detail` no-op).
    composable<SSBMaxDestinations.Marketplace> {
        MarketplaceScreen(
            onNavigateBack = { navController.navigateUp() },
            onInstituteClick = { instituteId ->
                navController.navigate(SSBMaxDestinations.NotYetPorted("InstituteDetail($instituteId)"))
            }
        )
    }

    // Results/Submissions/Grading/Analytics vertical. HistoricResults'
    // `onResultClick` mirrors HomeGraph's `onNavigateToResult` switch: OIR/
    // PPDT/TAT/WAT/SRT/SD/IO are the test-type result screens ported into
    // commonMain/ui so far -- every other test type still routes to the
    // honest placeholder. Reachable from `StudentProfileScreen`'s "history"
    // tile (wired in ProfileSettingsGraph).
    composable<SSBMaxDestinations.HistoricResults> {
        val notYetPorted: (String) -> Unit = { screen ->
            navController.navigate(SSBMaxDestinations.NotYetPorted(screen))
        }
        HistoricResultsScreen(
            onNavigateBack = { navController.navigateUp() },
            onResultClick = { submissionId, testType ->
                val destination = historicResultRoute(testType, submissionId)
                if (destination != null) navController.navigate(destination) else notYetPorted("TestResultScreen")
            }
        )
    }

    // Submissions list, reachable from `StudentHomeScreen`'s
    // `onNavigateToSubmissions` (wired in HomeGraph). `onNavigateToTests` now
    // routes to the real "All Tests" overview screen.
    composable<SSBMaxDestinations.StudentSubmissions> {
        SubmissionsListScreen(
            onSubmissionClick = { submissionId ->
                navController.navigate(SSBMaxDestinations.SubmissionDetail(submissionId))
            },
            onNavigateBack = { navController.navigateUp() },
            onNavigateToTests = {
                navController.navigate(SSBMaxDestinations.StudentTests)
            }
        )
    }

    // Student "All Tests" overview, reachable from SubmissionsListScreen's
    // onNavigateToTests (wired above). onNavigateToPhase
    // routes to the real Phase1Detail/Phase2Detail screens; onNavigateToTest
    // routes to concrete test destinations.
    composable<SSBMaxDestinations.StudentTests> {
        StudentTestsScreen(
            onNavigateToPhase = { phase ->
                val destination = if (phase == TestPhase.PHASE_1) {
                    SSBMaxDestinations.Phase1Detail
                } else {
                    SSBMaxDestinations.Phase2Detail
                }
                navController.navigate(destination)
            },
            onNavigateToTest = { testType ->
                navController.navigate(studentTestRoute(testType))
            }
        )
    }

    // Submission detail (student's own view of a single submission),
    // reachable from `SubmissionsListScreen` above.
    composable<SSBMaxDestinations.SubmissionDetail> { backStackEntry ->
        val submissionId = backStackEntry.toRoute<SSBMaxDestinations.SubmissionDetail>().submissionId
        SubmissionDetailScreen(
            submissionId = submissionId,
            onNavigateHome = {
                navController.navigate(SSBMaxDestinations.StudentHome) {
                    popUpTo<SSBMaxDestinations.StudentHome> { inclusive = true }
                }
            }
        )
    }

    // Student performance analytics dashboard, reachable from
    // `StudentHomeScreen`'s `onNavigateToAnalytics` (wired in HomeGraph).
    composable<SSBMaxDestinations.Analytics> {
        AnalyticsScreen(
            onNavigateBack = { navController.navigateUp() }
        )
    }
}

internal fun historicResultRoute(testType: TestType, submissionId: String): SSBMaxDestinations? = when (testType) {
    TestType.OIR -> SSBMaxDestinations.OIRTestResult(submissionId)
    TestType.PPDT -> SSBMaxDestinations.PPDTSubmissionResult(submissionId)
    TestType.TAT -> SSBMaxDestinations.TATSubmissionResult(submissionId)
    TestType.WAT -> SSBMaxDestinations.WATSubmissionResult(submissionId)
    TestType.SRT -> SSBMaxDestinations.SRTSubmissionResult(submissionId)
    TestType.SD -> SSBMaxDestinations.SDSubmissionResult(submissionId)
    TestType.IO -> SSBMaxDestinations.InterviewResult(submissionId)
    else -> null
}

internal fun studentTestRoute(testType: TestType): SSBMaxDestinations = when (testType) {
    TestType.OIR -> SSBMaxDestinations.OIRTest("oir_standard")
    TestType.PPDT -> SSBMaxDestinations.PPDTTest("ppdt_standard")
    TestType.TAT -> SSBMaxDestinations.TATTest("tat_standard")
    TestType.WAT -> SSBMaxDestinations.WATTest("wat_standard")
    TestType.SRT -> SSBMaxDestinations.SRTTest("srt_standard")
    TestType.SD -> SSBMaxDestinations.SDTest("sd_standard")
    TestType.PIQ -> SSBMaxDestinations.PIQTest("piq_standard")
    TestType.GTO_GD -> SSBMaxDestinations.GTOGDTest("gto_gd_standard")
    TestType.GTO_LECTURETTE -> SSBMaxDestinations.GTOLecturetteTest("gto_lecturette_standard")
    TestType.GTO_GPE -> SSBMaxDestinations.GTOGPETest("gto_gpe_standard")
    TestType.IO -> SSBMaxDestinations.StartInterview
    else -> SSBMaxDestinations.NotYetPorted("Test($testType)")
}
