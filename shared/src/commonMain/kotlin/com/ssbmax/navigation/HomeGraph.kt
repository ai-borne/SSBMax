package com.ssbmax.navigation

import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.composable
import com.ssbmax.shared.domain.model.TestPhase
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.ui.home.instructor.InstructorHomeScreen
import com.ssbmax.shared.ui.home.student.StudentHomeScreen

fun NavGraphBuilder.homeGraph(navController: NavHostController, onOpenDrawer: () -> Unit) {
    composable<SSBMaxDestinations.StudentHome> {
        val notYetPorted: (String) -> Unit = { screen ->
            navController.navigate(SSBMaxDestinations.NotYetPorted(screen))
        }
        StudentHomeScreen(
            onNavigateToTopic = { topicId, selectedTab ->
                navController.navigate(SSBMaxDestinations.TopicScreen(topicId, selectedTab))
            },
            onNavigateToPhaseDetail = { phase ->
                // Phase1Detail/Phase2Detail are real ported screens (this session) --
                // Topic (their own onNavigateToTopic target) isn't ported yet, so the
                // "start a new test" path still ends at the honest placeholder one
                // level deeper than before, not at this callback.
                if (phase == TestPhase.PHASE_1) {
                    navController.navigate(SSBMaxDestinations.Phase1Detail)
                } else {
                    navController.navigate(SSBMaxDestinations.Phase2Detail)
                }
            },
            onNavigateToStudy = {
                navController.navigate(SSBMaxDestinations.StudyMaterialsList)
            },
            onNavigateToSubmissions = {
                navController.navigate(SSBMaxDestinations.StudentSubmissions)
            },
            onNavigateToTests = {
                navController.navigate(SSBMaxDestinations.StudentTests)
            },
            onNavigateToNotifications = {
                navController.navigate(SSBMaxDestinations.NotificationCenter)
            },
            onNavigateToMarketplace = {
                navController.navigate(SSBMaxDestinations.Marketplace)
            },
            onNavigateToAnalytics = {
                navController.navigate(SSBMaxDestinations.Analytics)
            },
            onNavigateToResult = { testType: TestType, sessionId: String ->
                val route = homeResultRoute(testType, sessionId)
                if (route != null) navController.navigate(route) else notYetPorted("TestResultScreen")
            },
            onOpenDrawer = onOpenDrawer
        )
    }

    // Instructor vertical (this session): Students/Grading/Analytics/CreateBatch/
    // BatchDetail/StudentDetail all now real ported screens -- matches the
    // Android original's `InstructorNavGraph.kt` wiring exactly.
    // `onOpenDrawer` now opens the real ported drawer (this session's nav-chrome
    // work, see [SSBMaxNavHost]'s own `onOpenDrawer` parameter and
    // [com.ssbmax.shared.ui.components.SSBMaxAppScaffold]).
    composable<SSBMaxDestinations.InstructorHome> {
        InstructorHomeScreen(
            onNavigateToStudent = { studentId ->
                navController.navigate(SSBMaxDestinations.StudentDetail(studentId))
            },
            onNavigateToGrading = {
                navController.navigate(SSBMaxDestinations.InstructorGrading)
            },
            onNavigateToBatchDetail = { batchId ->
                navController.navigate(SSBMaxDestinations.BatchDetail(batchId))
            },
            onNavigateToCreateBatch = {
                navController.navigate(SSBMaxDestinations.CreateBatch)
            },
            onOpenDrawer = onOpenDrawer
        )
    }
}

/**
 * Maps a completed test's [TestType] to its result screen's destination.
 *
 * KMP-convergence Phase 3a, row #1: PIQ/GTO_GD/GTO_LECTURETTE/GTO_GPE were
 * missing from this switch even though all four result destinations are
 * already registered (`WrittenTestsGraph`/`GTOGraph`) -- `StudentHomeScreen`'s
 * OLQ dashboard tiles for those test types silently fell through to the
 * honest placeholder instead. Extracted to a pure function (rather than
 * inline in the composable lambda) so this mapping is unit-testable without
 * standing up Compose/Koin. Returns `null` for test types with no ported
 * result screen yet.
 */
internal fun homeResultRoute(testType: TestType, sessionId: String): SSBMaxDestinations? = when (testType) {
    TestType.OIR -> SSBMaxDestinations.OIRTestResult(sessionId)
    TestType.PPDT -> SSBMaxDestinations.PPDTSubmissionResult(sessionId)
    TestType.TAT -> SSBMaxDestinations.TATSubmissionResult(sessionId)
    TestType.WAT -> SSBMaxDestinations.WATSubmissionResult(sessionId)
    TestType.SRT -> SSBMaxDestinations.SRTSubmissionResult(sessionId)
    TestType.SD -> SSBMaxDestinations.SDSubmissionResult(sessionId)
    TestType.PIQ -> SSBMaxDestinations.PIQSubmissionResult(sessionId)
    TestType.GTO_GD -> SSBMaxDestinations.GTOGDResult(sessionId)
    TestType.GTO_LECTURETTE -> SSBMaxDestinations.GTOLecturetteResult(sessionId)
    TestType.GTO_GPE -> SSBMaxDestinations.GTOGPEResult(sessionId)
    TestType.IO -> SSBMaxDestinations.InterviewResult(sessionId)
    else -> null
}
