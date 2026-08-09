package com.ssbmax.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.rememberNavController

/**
 * commonMain NavHost — Phase 5's first real multi-screen Compose
 * Multiplatform navigation graph, using `org.jetbrains.androidx.navigation`
 * (same `androidx.navigation`/`androidx.navigation.compose` package as the
 * Android-only artifact `app` still uses for its own graph — see this
 * phase's exit report for why the two coexist rather than one replacing the
 * other yet).
 *
 * Structure is the commonMain-portable equivalent of the Android-only
 * `app/.../navigation/{NavGraph,AuthNavGraph,Student/InstructorNavGraph}.kt`
 * set. This note described a much narrower graph (Splash/Login/Home/OIR/PPDT
 * only) in early Phase 5 sessions -- stale as of this file's current state,
 * corrected here: 55 of the 61 live Compose screens are now registered
 * across the per-vertical `*Graph.kt` files this composable assembles below
 * (the 6 not registered -- `FAQScreen`, `GradingDetailScreen`,
 * `MemoryLeakTestScreen`, `MockPaymentScreen`, `PaymentSuccessScreen`,
 * `app/ui/upgrade/UpgradeScreen` -- are confirmed dead code in the Android
 * original, zero real nav-graph callers, correctly not ported). Every
 * sub-navigation callback that still targets a destination with no ported
 * screen (a handful of true leaves: FAQ, achievements, institute detail,
 * notification deep-link, the bottom-nav "Tests" tab's per-test-type
 * routing) routes to the single [SSBMaxDestinations.NotYetPorted]
 * destination with the intended screen's display name, rather than
 * navigating to a route this graph never registered (which would crash Nav
 * Compose's destination lookup) or being silently dropped — the graph is
 * honestly navigable end-to-end today without pretending unported work is
 * done.
 *
 * OIR/PPDT/TAT/WAT/SRT/SDT/PIQ/GTO "start a new test" reachability, corrected
 * (this note was stale in earlier sessions and is fixed here, not just
 * re-copied forward): `StudentHomeScreen`'s `onNavigateToPhaseDetail` DOES
 * navigate to the real, ported `Phase1DetailScreen`/`Phase2DetailScreen`
 * (registered in [StudyContentGraph]), whose own `onNavigateToTopic`
 * navigates to the real, ported `TopicScreen`, whose own `onNavigateToTest`
 * maps a `testId` string prefix to a real registered test route for OIR,
 * PPDT, TAT, WAT, SRT, SD, PIQ, and all three GTO sub-tests (GD/Lecturette/
 * GPE) plus Interview (`io` prefix) -- see `TopicScreen`'s own registration
 * in [StudyContentGraph] for the exact prefix table. So Student Home ->
 * Phase1/2Detail -> Topic -> a specific test IS a real, working "start a new
 * test" path for every one of those test types today, not just a
 * placeholder. The *other* path to a test-taking screen -- the bottom nav
 * bar's "Tests" tab (`StudentTestsScreen`) -- does NOT yet do this mapping:
 * its own `onNavigateToTest` always routes to `NotYetPorted` regardless of
 * which test card was tapped (see its own registration in
 * [SubmissionsResultsGraph]), matching a simplification already present in
 * the Android original's own nav graph (`StudentTestsScreen.onNavigateToTest`
 * isn't wired to anything in `SharedNavGraph.kt` either), not a new gap
 * introduced by this port. Every test type's own result screen
 * (`OIRTestResultScreen` excepted, which has a real "Take Another Test" callback)
 * still has no "Take Another Test" callback of its own, matching the Android originals
 * exactly -- from a result screen, the only way back to a new test is via
 * Student Home -> Phase1/2Detail -> Topic again, not a missing feature of
 * this port. (Async AI analysis of submissions is NOT a gap, correcting a
 * stale claim this comment used to make: PPDT/TAT/WAT/SRT/SD/GTO/Interview
 * submissions are analyzed on both platforms —
 * [com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger] is bound to
 * `WorkManagerSubmissionAnalysisTrigger` on Android and
 * [com.ssbmax.shared.analysis.KtorSubmissionAnalysisTrigger] on iOS, the
 * latter dispatching to real per-test-type orchestrators under
 * `com.ssbmax.shared.analysis`. The one genuinely open sub-gap is that the
 * iOS path sends no completion push; result screens surface the result via
 * their reactive `analysisStatus` observation instead.) (Note the
 * SDT enum/route naming mismatch, reconciled here not introduced by this
 * port: the domain model calls this test type `SD`, `SSBMaxDestinations`
 * calls the routes `SDTest`/`SDSubmissionResult`, but the actual code
 * package/screens are `sdt`/`SDT*`, matching the Android original's own
 * naming.)
 *
 * Used directly by both platforms' entry points since the KMP-convergence
 * plan's Phase 5 cutover: iOS's [com.ssbmax.shared.ui.MainViewController]
 * (which has no other nav graph) and Android's `MainActivity` (via
 * [com.ssbmax.shared.ui.SSBMaxRoot], replacing the old Android-only
 * `SSBMaxApp`/`NavGraph.kt` graph as the reachable production graph). The old
 * `app`-only graph's source files are unreached but not yet deleted — that's
 * Phase 6a's job.
 *
 * Nav chrome (drawer): this `NavHost` itself stays chrome-agnostic (exactly
 * the composable destination graph, as before) -- the persistent drawer
 * wrapping it lives one level up, in
 * [com.ssbmax.shared.ui.components.SSBMaxAppScaffold], which owns the
 * `NavHostController` passed to this composable and threads a real
 * [onOpenDrawer] callback down into the two home screens' `onOpenDrawer`
 * parameter (previously both routed to the honest [NotYetPortedScreen]
 * placeholder -- now they open the real drawer). See [MainViewController]
 * for how the two compose together on iOS; on Android, [SSBMaxRoot] wraps
 * this same `SSBMaxAppScaffold`/`SSBMaxNavHost` pair as the production graph.
 *
 * Split into per-vertical `*Graph.kt` `NavGraphBuilder` extensions (this
 * session) to bring this file back under the repo's 300-line Quality Limit
 * — pure structural move, zero behavior change. See each file's own doc
 * comment for the destinations it registers.
 */
@Composable
fun SSBMaxNavHost(
    navController: NavHostController = rememberNavController(),
    startDestination: Any = SSBMaxDestinations.Splash,
    onOpenDrawer: () -> Unit = {}
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        authGraph(navController)
        homeGraph(navController, onOpenDrawer)
        psychTestsGraph(navController)
        writtenTestsGraph(navController)
        gtoGraph(navController)
        interviewGraph(navController)
        instructorVerticalGraph(navController)
        profileSettingsGraph(navController)
        submissionsResultsGraph(navController)
        studyContentGraph(navController)
    }
}
