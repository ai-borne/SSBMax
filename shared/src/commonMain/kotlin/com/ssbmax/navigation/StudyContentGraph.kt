package com.ssbmax.navigation

import androidx.navigation.compose.composable
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.navDeepLink
import androidx.navigation.toRoute
import com.ssbmax.shared.ui.notifications.NotificationCenterScreen
import com.ssbmax.shared.ui.phase.Phase1DetailScreen
import com.ssbmax.shared.ui.phase.Phase2DetailScreen
import com.ssbmax.shared.ui.placeholder.NotYetPortedScreen
import com.ssbmax.shared.ui.ssboverview.SSBOverviewScreen
import com.ssbmax.shared.ui.study.StudyMaterialDetailScreen
import com.ssbmax.shared.ui.study.StudyMaterialsScreen
import com.ssbmax.shared.ui.topic.TopicScreen

fun NavGraphBuilder.studyContentGraph(navController: NavHostController) {
    // Study Materials vertical, reachable from StudentHomeScreen's
    // onNavigateToStudy (wired in HomeGraph). onNavigateToTopic routes to the
    // real Topic screen. onNavigateToSearch/onNavigateToBookmarks have no
    // ported destination -- both are bare no-op default parameters in the
    // Android original too.
    composable<SSBMaxDestinations.StudyMaterialsList> {
        StudyMaterialsScreen(
            onNavigateToTopic = { topicName ->
                navController.navigate(SSBMaxDestinations.TopicScreen(topicName))
            }
        )
    }

    // Student Study (KMP-convergence Phase 3a, row #9) -- the shared drawer
    // reaches the same `StudyMaterialsScreen` as Student Home's "Study" quick
    // action. Same no-op rationale for onNavigateToSearch/onNavigateToBookmarks.
    composable<SSBMaxDestinations.StudentStudy> {
        StudyMaterialsScreen(
            onNavigateToTopic = { topicId ->
                navController.navigate(SSBMaxDestinations.TopicScreen(topicId))
            }
        )
    }

    composable<SSBMaxDestinations.StudyMaterialDetail> { backStackEntry ->
        val categoryId = backStackEntry.toRoute<SSBMaxDestinations.StudyMaterialDetail>().categoryId
        StudyMaterialDetailScreen(
            categoryId = categoryId,
            onNavigateBack = { navController.navigateUp() },
            onNavigateToRelatedMaterial = { relatedId ->
                navController.navigate(SSBMaxDestinations.StudyMaterialDetail(relatedId))
            }
        )
    }

    // Topic -- 3-tab detail screen (Overview/Study Material/Tests) reachable
    // from StudentHomeScreen/Phase1Detail/Phase2Detail/StudyMaterialsScreen's
    // onNavigateToTopic (all wired). onNavigateToStudyMaterial routes to the
    // real StudyMaterialDetail screen. onNavigateToTest maps the testId
    // string (e.g. "oir_standard") back to the matching registered test route
    // where one exists; GTO's 5 not-yet-ported sub-tests (PGT/HGT/GOR/IO/CT)
    // and PPDT (no testId-keyed route registered under that exact prefix)
    // fall through to the honest placeholder. onNavigateToInterviewResult
    // routes to the real InterviewResult screen.
    //
    // `selectedTab` (KMP-convergence Phase 3a, row #2): mirrors the Android
    // original's own route registration (`SharedNavGraph.kt:576-590`).
    // `StudentHomeScreen`'s onTopicClick used to emit e.g. "OIR?selectedTab=2"
    // (Tests tab preselected) as a hand-built string; it is now a real
    // constructor argument with a type-checked default (0, Overview tab).
    composable<SSBMaxDestinations.TopicScreen> { backStackEntry ->
        val route = backStackEntry.toRoute<SSBMaxDestinations.TopicScreen>()
        TopicScreen(
            topicId = route.topicId,
            initialTab = route.selectedTab,
            onNavigateBack = { navController.navigateUp() },
            onNavigateToStudyMaterial = { materialId ->
                navController.navigate(SSBMaxDestinations.StudyMaterialDetail(materialId))
            },
            onNavigateToTest = { testId ->
                val destination = when {
                    testId.startsWith("oir") -> SSBMaxDestinations.OIRTest(testId)
                    testId.startsWith("ppdt") -> SSBMaxDestinations.PPDTTest(testId)
                    testId.startsWith("tat") -> SSBMaxDestinations.TATTest(testId)
                    testId.startsWith("wat") -> SSBMaxDestinations.WATTest(testId)
                    testId.startsWith("srt") -> SSBMaxDestinations.SRTTest(testId)
                    testId.startsWith("sd") -> SSBMaxDestinations.SDTest(testId)
                    testId.startsWith("piq") -> SSBMaxDestinations.PIQTest(testId)
                    testId.startsWith("gto_gd") -> SSBMaxDestinations.GTOGDTest(testId)
                    testId.startsWith("gto_lecturette") -> SSBMaxDestinations.GTOLecturetteTest(testId)
                    testId.startsWith("gto_gpe") -> SSBMaxDestinations.GTOGPETest(testId)
                    testId.startsWith("io") -> SSBMaxDestinations.StartInterview
                    else -> SSBMaxDestinations.NotYetPorted("Test($testId)")
                }
                navController.navigate(destination)
            },
            onNavigateToInterviewResult = { resultId ->
                navController.navigate(SSBMaxDestinations.InterviewResult(resultId))
            }
        )
    }

    // Notification Center, reachable from StudentHomeScreen's
    // onNavigateToNotifications (wired in HomeGraph).
    //
    // deepLinks: Cloud Functions' sendNotification.js sets a push notification's
    // actionUrl to the bare route (Routes.NOTIFICATIONS_CENTER = "notifications/center"),
    // which both platforms forward verbatim into DeepLinkGateway -- DeepLinkEffect then
    // builds "ssbmax://notifications/center" and calls navController.navigate(NavUri).
    // Without this registration that throws IllegalArgumentException (caught, logged,
    // silently dropped) since no NavDeepLink matched -- same shape as InterviewResult's
    // registration in InterviewGraph.kt. One registration, shared by Android and iOS,
    // since both feed the same DeepLinkGateway/DeepLinkEffect pipeline.
    composable<SSBMaxDestinations.NotificationCenter>(
        deepLinks = listOf(
            navDeepLink<SSBMaxDestinations.NotificationCenter>(
                basePath = DeepLinkParser.SCHEME + DeepLinkParser.ROUTE_NOTIFICATION_CENTER
            )
        )
    ) {
        NotificationCenterScreen(
            onNavigateBack = { navController.navigateUp() },
            onNotificationClick = { notification ->
                val destination = resolveNotificationResultDestination(notification)
                    ?: SSBMaxDestinations.NotYetPorted("NotificationDeepLink(${notification.actionUrl})")
                navController.navigate(destination)
            }
        )
    }

    // Phase 1/2 Detail -- reachable from StudentHomeScreen's
    // onNavigateToPhaseDetail (wired in HomeGraph). onNavigateToTopic routes
    // to the real Topic screen -- a student can finally reach an actual
    // test-taking screen from Student Home via Phase1/2Detail -> Topic ->
    // Tests tab -> onNavigateToTest, closing the OIR/PPDT/TAT/etc. "no path
    // to start a new test" gap documented in HomeGraph (Topic's own
    // onNavigateToTest still routes to the honest placeholder above, since
    // none of the individual test screens are wired from here by testId
    // string yet -- see Topic's own registration above for exactly which
    // test types ARE reachable that way).
    composable<SSBMaxDestinations.Phase1Detail> {
        Phase1DetailScreen(
            onNavigateBack = { navController.navigateUp() },
            onNavigateToTopic = { topicId ->
                navController.navigate(SSBMaxDestinations.TopicScreen(topicId))
            }
        )
    }

    composable<SSBMaxDestinations.Phase2Detail> {
        Phase2DetailScreen(
            onNavigateBack = { navController.navigateUp() },
            onNavigateToTopic = { topicId ->
                navController.navigate(SSBMaxDestinations.TopicScreen(topicId))
            }
        )
    }

    // SSB Overview -- static/educational content about the SSB selection
    // process. Reachable via the navigation drawer's "Overview of SSB"
    // item ([com.ssbmax.shared.ui.components.drawer.DrawerContent]'s
    // `onNavigateToSSBOverview`, wired in
    // [com.ssbmax.shared.ui.components.SSBMaxAppScaffold]) -- previously
    // registered but reachable only by direct navigation/deep link, since the
    // drawer wasn't ported yet.
    composable<SSBMaxDestinations.SSBOverview> {
        SSBOverviewScreen(
            onNavigateBack = { navController.navigateUp() }
        )
    }

    composable<SSBMaxDestinations.NotYetPorted> { backStackEntry ->
        val screen = backStackEntry.toRoute<SSBMaxDestinations.NotYetPorted>().screen
        NotYetPortedScreen(screen)
    }
}
