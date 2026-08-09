package com.ssbmax.navigation

import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hasRoute
import kotlinx.serialization.Serializable
import org.jetbrains.compose.resources.StringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.drawer_all_tests
import ssbmax.shared.generated.resources.drawer_analytics_dashboard
import ssbmax.shared.generated.resources.drawer_batch_management
import ssbmax.shared.generated.resources.drawer_my_batches
import ssbmax.shared.generated.resources.drawer_my_students
import ssbmax.shared.generated.resources.drawer_pending_grading
import ssbmax.shared.generated.resources.drawer_phase1_description
import ssbmax.shared.generated.resources.drawer_phase1_title
import ssbmax.shared.generated.resources.drawer_phase2_description
import ssbmax.shared.generated.resources.drawer_phase2_title
import ssbmax.shared.generated.resources.drawer_study_materials
import ssbmax.shared.generated.resources.nav_analytics
import ssbmax.shared.generated.resources.nav_grading
import ssbmax.shared.generated.resources.nav_home
import ssbmax.shared.generated.resources.nav_profile
import ssbmax.shared.generated.resources.nav_results
import ssbmax.shared.generated.resources.nav_students
import ssbmax.shared.generated.resources.nav_study
import ssbmax.shared.generated.resources.nav_tests

/**
 * Type-safe navigation destinations for SSBMax app (KMP-convergence Phase
 * 3d). Each destination is a real `@Serializable` object/class registered
 * via `composable<T>()` and navigated to via `navController.navigate(T)` --
 * `shared`'s own graph (`SSBMaxNavHost` + its `*Graph.kt` files) never reads
 * a route string for these anymore, closing the `?selectedTab=`-shaped class
 * of defect (Phase 3a, row #2) at compile time instead of catching it in a
 * nav test.
 *
 * `app`'s own graph (`app/navigation/{NavGraph,Auth,Student,Instructor,Shared}NavGraph.kt`) is Android-only,
 * string-routed (`androidx.navigation.compose.composable(route: String)`), and
 * unreached since Phase 5 swapped `MainActivity` onto this module's
 * `SSBMaxRoot`/`SSBMaxNavHost` -- it is wholesale deleted in Phase 6a;
 * converting it to type-safe routes too would have duplicated work this plan
 * already scheduled for deletion (Rule 2).
 * Each destination that takes arguments therefore keeps a `companion object`
 * exposing the *old* string-pattern `route` (e.g. `"test/oir/{testId}"`, used
 * by `app`'s `composable(route = ..., arguments = ...)` registrations) and
 * `createRoute(...)` (used by `app`'s `navController.navigate(...)` calls) --
 * unchanged in shape from this file's pre-Phase-3d version, so `app` needed
 * zero edits for this phase. Argument-less destinations keep a plain instance
 * `route: String` for the same reason (`app` reads it as `X.route`, a `data
 * object` member access). Delete both compatibility shims together with
 * `app/navigation/{NavGraph,Auth,Student,Instructor,Shared}NavGraph.kt` in Phase 6a.
 *
 * This file exceeds the repo's 300-line Quality Limit (Rule 3's own exemption
 * precedent: prompt corpora/test sources over that limit aren't split where
 * doing so "harms readability and helps nothing" -- same reasoning applies
 * here). Splitting it would mean either (a) converting every destination to
 * a top-level class, losing the `SSBMaxDestinations.X` qualified-access style
 * used at ~150 call sites for no behavioral gain, or (b) is structurally
 * impossible while these stay nested (Kotlin sealed-subclass same-file
 * relaxation only applies to top-level subclasses). The size is entirely the
 * Phase 6a-removable compatibility shim above; do not split before then.
 */
sealed class SSBMaxDestinations {
    // Authentication Flow
    @Serializable
    data object Splash : SSBMaxDestinations() { const val route = "splash" }
    @Serializable
    data object Login : SSBMaxDestinations() { const val route = "login" }
    @Serializable
    data object RoleSelection : SSBMaxDestinations() { const val route = "role_selection" }

    // Student Flow
    @Serializable
    data object StudentHome : SSBMaxDestinations() { const val route = "student/home" }
    @Serializable
    data object StudentTests : SSBMaxDestinations() { const val route = "student/tests" }
    @Serializable
    data object StudentSubmissions : SSBMaxDestinations() { const val route = "student/submissions" }
    @Serializable
    data object StudentStudy : SSBMaxDestinations() { const val route = "student/study" }
    @Serializable
    data object StudentProfile : SSBMaxDestinations() { const val route = "student/profile" }

    // Instructor Flow
    @Serializable
    data object InstructorHome : SSBMaxDestinations() { const val route = "instructor/home" }
    @Serializable
    data object InstructorStudents : SSBMaxDestinations() { const val route = "instructor/students" }
    @Serializable
    data object InstructorGrading : SSBMaxDestinations() { const val route = "instructor/grading" }
    @Serializable
    data object InstructorAnalytics : SSBMaxDestinations() { const val route = "instructor/analytics" }

    // Phase Screens
    @Serializable
    data object Phase1Detail : SSBMaxDestinations() { const val route = "phase1/detail" }
    @Serializable
    data object Phase2Detail : SSBMaxDestinations() { const val route = "phase2/detail" }

    // Test Screens - Phase 1
    @Serializable
    data class OIRTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/oir/{testId}"
            fun createRoute(testId: String) = "test/oir/$testId"
        }
    }
    @Serializable
    data class OIRTestResult(val sessionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/oir/result/{sessionId}"
            fun createRoute(sessionId: String) = "test/oir/result/$sessionId"
        }
    }
    @Serializable
    data class OIRAnswerReview(val sessionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/oir/review/{sessionId}"
            fun createRoute(sessionId: String) = "test/oir/review/$sessionId"
        }
    }
    @Serializable
    data class PPDTTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/ppdt/{testId}"
            fun createRoute(testId: String) = "test/ppdt/$testId"
        }
    }
    @Serializable
    data class PPDTSubmissionResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/ppdt/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/ppdt/result/$submissionId"
        }
    }

    // Test Screens - Phase 2 Psychology Tests
    @Serializable
    data class TATTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/tat/{testId}"
            fun createRoute(testId: String) = "test/tat/$testId"
        }
    }
    @Serializable
    data class TATSubmissionResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/tat/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/tat/result/$submissionId"
        }
    }
    @Serializable
    data class WATTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/wat/{testId}"
            fun createRoute(testId: String) = "test/wat/$testId"
        }
    }
    @Serializable
    data class WATSubmissionResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/wat/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/wat/result/$submissionId"
        }
    }
    @Serializable
    data class SRTTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/srt/{testId}"
            fun createRoute(testId: String) = "test/srt/$testId"
        }
    }
    @Serializable
    data class SRTSubmissionResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/srt/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/srt/result/$submissionId"
        }
    }

    // SD (Self Description) Test
    @Serializable
    data class SDTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/sd/{testId}"
            fun createRoute(testId: String) = "test/sd/$testId"
        }
    }
    @Serializable
    data class SDSubmissionResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/sd/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/sd/result/$submissionId"
        }
    }

    // PIQ (Personal Information Questionnaire) Test
    @Serializable
    data class PIQSubmissionResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/piq/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/piq/result/$submissionId"
        }
    }

    // PIQ Test Route
    @Serializable
    data class PIQTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/piq/{testId}"
            fun createRoute(testId: String) = "test/piq/$testId"
        }
    }

    // Test Screens - Phase 2 GTO Tests (8 individual tests)
    @Serializable
    data class GTOTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/gto/{testId}"
            fun createRoute(testId: String) = "test/gto/$testId"
        }
    }

    // GTO - Group Discussion (IMPLEMENTED)
    @Serializable
    data class GTOGDTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/gto/gd/{testId}"
            fun createRoute(testId: String) = "test/gto/gd/$testId"
        }
    }
    @Serializable
    data class GTOGDResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/gto/gd/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/gto/gd/result/$submissionId"
        }
    }

    // GTO - Lecturette (IMPLEMENTED)
    @Serializable
    data class GTOLecturetteTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/gto/lecturette/{testId}"
            fun createRoute(testId: String) = "test/gto/lecturette/$testId"
        }
    }
    @Serializable
    data class GTOLecturetteResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/gto/lecturette/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/gto/lecturette/result/$submissionId"
        }
    }

    // GTO - Group Planning Exercise (IMPLEMENTED)
    @Serializable
    data class GTOGPETest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/gto/gpe/{testId}"
            fun createRoute(testId: String) = "test/gto/gpe/$testId"
        }
    }
    @Serializable
    data class GTOGPEResult(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/gto/gpe/result/{submissionId}"
            fun createRoute(submissionId: String) = "test/gto/gpe/result/$submissionId"
        }
    }

    // NOTE: Remaining 5 GTO test destinations will be added when their screens are implemented:
    // - GTOPGTTest/Result (Progressive Group Task)
    // - GTOHGTTest/Result (Half Group Task)
    // - GTOGORTest/Result (Group Obstacle Race)
    // - GTOIOTest/Result (Individual Obstacles)
    // - GTOCTTest/Result (Command Task)
    //
    // Add destinations here ONLY when corresponding composable routes are registered in SharedNavGraph

    // Interview Test (IO - Interviewing Officer)
    @Serializable
    data class IOTest(val testId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "test/io/{testId}"
            fun createRoute(testId: String) = "test/io/$testId"
        }
    }

    // Interview Screens - Stage 4 (Personal Interview)
    // Unified interview with TTS support (mutable)
    @Serializable
    data object StartInterview : SSBMaxDestinations() { const val route = "interview/start" }
    @Serializable
    data class VoiceInterviewSession(val sessionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "interview/voice/{sessionId}"
            fun createRoute(sessionId: String) = "interview/voice/$sessionId"
        }
    }
    @Serializable
    data class InterviewResult(val resultId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "interview/result/{resultId}"
            fun createRoute(resultId: String) = "interview/result/$resultId"
        }
    }

    // Study Materials
    @Serializable
    data object StudyMaterialsList : SSBMaxDestinations() { const val route = "study/materials" }
    @Serializable
    data class StudyMaterialDetail(val categoryId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "study/material/{categoryId}"
            fun createRoute(categoryId: String) = "study/material/$categoryId"
        }
    }

    // Topic Screens (Phase > Topic with tabs). `selectedTab` (KMP-convergence
    // Phase 3a, row #2) defaults to the Overview tab; the legacy `route`/
    // `createRoute` companion below intentionally does NOT expose it -- no
    // `app`-side caller ever passed one (see this file's class doc).
    @Serializable
    data class TopicScreen(val topicId: String, val selectedTab: Int = 0) : SSBMaxDestinations() {
        companion object {
            const val route = "topic/{topicId}"
            fun createRoute(topicId: String) = "topic/$topicId"
        }
    }

    // Premium/Subscription
    @Serializable
    data object UpgradeScreen : SSBMaxDestinations() { const val route = "premium/upgrade" }

    // Notifications
    @Serializable
    data object NotificationCenter : SSBMaxDestinations() { const val route = "notifications/center" }

    // Settings
    @Serializable
    data object Settings : SSBMaxDestinations() { const val route = "settings" }
    @Serializable
    data object SubscriptionManagement : SSBMaxDestinations() { const val route = "settings/subscription" }

    // Analytics (Student Performance Dashboard)
    @Serializable
    data object Analytics : SSBMaxDestinations() { const val route = "analytics" }

    // Historic Results (cross-test-type results list, last 6 months)
    @Serializable
    data object HistoricResults : SSBMaxDestinations() { const val route = "results/historic" }

    // User Profile. `isOnboarding` used to be a bolt-on query-string helper
    // (`createOnboardingRoute()`) never parsed by any route registration
    // (see the pre-Phase-3d history of this file); it is now a real
    // constructor argument the destination can actually read.
    @Serializable
    data class UserProfile(val isOnboarding: Boolean = false) : SSBMaxDestinations() {
        companion object {
            const val route = "user/profile"
            fun createOnboardingRoute() = "$route?isOnboarding=true"
        }
    }

    // Marketplace
    @Serializable
    data object Marketplace : SSBMaxDestinations() { const val route = "marketplace" }

    // SSB Overview
    @Serializable
    data object SSBOverview : SSBMaxDestinations() { const val route = "ssb/overview" }

    // FAQ
    @Serializable
    data object FAQ : SSBMaxDestinations() { const val route = "faq" }

    // Upgrade & Payment
    @Serializable
    data object Upgrade : SSBMaxDestinations() { const val route = "upgrade" }
    @Serializable
    data object Payment : SSBMaxDestinations() { const val route = "payment" }
    @Serializable
    data object PaymentSuccess : SSBMaxDestinations() { const val route = "payment/success" }

    // Batch Management
    @Serializable
    data object JoinBatch : SSBMaxDestinations() { const val route = "batch/join" }
    @Serializable
    data object CreateBatch : SSBMaxDestinations() { const val route = "batch/create" }
    @Serializable
    data class BatchDetail(val batchId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "batch/{batchId}"
            fun createRoute(batchId: String) = "batch/$batchId"
        }
    }

    // Student Details (for instructors)
    @Serializable
    data class StudentDetail(val studentId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "instructor/student/{studentId}"
            fun createRoute(studentId: String) = "instructor/student/$studentId"
        }
    }

    // Test Grading (for instructors)
    @Serializable
    data class InstructorGradingDetail(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "instructor/grading/{submissionId}"
            fun createRoute(submissionId: String) = "instructor/grading/$submissionId"
        }
    }

    // Submission Detail (for students - view their own submission)
    @Serializable
    data class SubmissionDetail(val submissionId: String) : SSBMaxDestinations() {
        companion object {
            const val route = "submission/{submissionId}"
            fun createRoute(submissionId: String) = "submission/$submissionId"
        }
    }

    // Dev-facing catch-all for any destination the commonMain nav graph must route to
    // but whose real screen hasn't been ported into `shared/commonMain/ui` yet (Phase 5
    // continuation). Every ported home screen's sub-navigation callbacks that target an
    // unported destination (topic detail, phase detail, result screens, notifications,
    // marketplace, analytics, grading, batches, etc.) route here with the intended
    // destination's display name, rather than navigating to a route this NavHost never
    // registered (which would crash) or being silently dropped.
    @Serializable
    data class NotYetPorted(val screen: String = "Screen") : SSBMaxDestinations()
}

/**
 * Navigation drawer items for quick access.
 *
 * `titleRes`/`descriptionRes` are [StringResource] handles, not resolved
 * strings — render with `stringResource(item.titleRes)` from a `@Composable`
 * call site (e.g. [com.ssbmax.shared.ui.components.drawer.DrawerContent]).
 * Previously plain hardcoded `String`/`String?` (a pre-existing lint-rule
 * violation flagged when this file was first moved into `shared` in an
 * earlier Phase 5 session, before any real UI wired these items) — fixed
 * here, the first session that actually renders them.
 */
sealed class DrawerItem(
    val route: String,
    val titleRes: StringResource,
    val descriptionRes: StringResource? = null
) {
    // Student Drawer Items
    data object Phase1Tests : DrawerItem("drawer/phase1", Res.string.drawer_phase1_title, Res.string.drawer_phase1_description)
    data object Phase2Tests : DrawerItem("drawer/phase2", Res.string.drawer_phase2_title, Res.string.drawer_phase2_description)
    data object AllTests : DrawerItem("drawer/all_tests", Res.string.drawer_all_tests)
    data object StudyMaterials : DrawerItem("drawer/study", Res.string.drawer_study_materials)
    data object MyBatches : DrawerItem("drawer/batches", Res.string.drawer_my_batches)

    // Instructor Drawer Items
    data object PendingGrading : DrawerItem("drawer/pending", Res.string.drawer_pending_grading)
    data object MyStudents : DrawerItem("drawer/students", Res.string.drawer_my_students)
    data object BatchManagement : DrawerItem("drawer/batch_mgmt", Res.string.drawer_batch_management)
    data object Analytics : DrawerItem("drawer/analytics", Res.string.drawer_analytics_dashboard)
}

/**
 * Screens that render full-bleed without the shared navigation drawer
 * ([com.ssbmax.shared.ui.components.SSBMaxAppScaffold]'s auth-route
 * exclusion) and that a cold-start deep link must wait to pass before
 * navigating ([com.ssbmax.shared.ui.DeepLinkEffect]'s auth deferral) --
 * one definition shared by both rather than two hand-kept lists agreeing by
 * convention (KMP-convergence Phase 4).
 */
fun NavDestination?.isAuthScreen(): Boolean = this != null &&
    (hasRoute<SSBMaxDestinations.Splash>() ||
        hasRoute<SSBMaxDestinations.Login>() ||
        hasRoute<SSBMaxDestinations.RoleSelection>())
