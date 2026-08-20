package com.ssbmax.shared.ui.home.student

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.Phase1Progress
import com.ssbmax.shared.domain.model.Phase2Progress
import com.ssbmax.shared.domain.model.TestProgress
import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.usecase.dashboard.ProcessedDashboardData
import com.ssbmax.shared.platform.permissions.NotificationPermissionController
import com.ssbmax.shared.presentation.home.student.StudentHomeUiState
import com.ssbmax.shared.presentation.home.student.StudentHomeViewModel
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import com.ssbmax.shared.ui.permissions.LocalNotificationPermissionController
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.koin.compose.KoinApplication
import org.koin.dsl.module
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Port of the pre-KMP-convergence `app/src/androidTest/.../ui/home/student/StudentHomeScreenTest.kt`
 * (Phase 6a of the KMP-convergence plan) onto the shared [StudentHomeScreen] --
 * the production student home screen since Phase 5's cutover, and one of the
 * two verticals (auth, home) the plan calls out as priority to port.
 *
 * Lives in `androidUnitTest`, not `commonTest` -- same Robolectric-needing
 * precedent as [LoginScreenUiTest]/[com.ssbmax.shared.ui.theme.SSBMaxThemeUiTest].
 * Uses the same `KoinApplication` composable + [ensureComposeResourcesContextInitialized]
 * + tall `@Config` window pattern that test established (see its class doc
 * for why each piece is there).
 *
 * Real structural drift from the pre-cutover test this replaces: the old
 * `error` field this screen no longer renders anywhere (verified by reading
 * [StudentHomeScreen] -- only `dashboardError` drives the visible error
 * banner now); the ported error-state assertion targets `dashboardError`
 * instead of blindly recompiling the old field name.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1200dp")
class StudentHomeScreenUiTest {

    private lateinit var mockViewModel: StudentHomeViewModel
    private lateinit var uiStateFlow: MutableStateFlow<StudentHomeUiState>
    private val fakePermissionController = object : NotificationPermissionController {
        override suspend fun isGranted(): Boolean = true
        override suspend fun request(): Boolean = true
    }

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
        mockViewModel = mockk(relaxed = true)
        uiStateFlow = MutableStateFlow(StudentHomeUiState(userName = "Test User", isLoading = false))
        every { mockViewModel.uiState } returns uiStateFlow
    }

    @Test
    fun homeScreen_displaysUserName() = runComposeUiTest {
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        onNodeWithText("Test User", substring = true).assertIsDisplayed()
    }

    @Test
    fun homeScreen_displaysPhaseProgressRibbons() = runComposeUiTest {
        uiStateFlow.value = uiStateFlow.value.copy(
            phase1Progress = Phase1Progress(
                oirProgress = TestProgress(TestType.OIR, TestStatus.COMPLETED),
                ppdtProgress = TestProgress(TestType.PPDT, TestStatus.IN_PROGRESS)
            )
        )
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        // "PHASE 1" renders twice on this screen -- PhaseProgressRibbon's own
        // Phase1Card AND OLQDashboardCard's Phase1Section share the same
        // `dashboard_phase_1`/`phase_1_label` string value -- so match the
        // ribbon's occurrence (first in the LazyColumn) rather than a plain
        // onNodeWithText, which requires exactly one match.
        onAllNodesWithText("PHASE 1", substring = true).onFirst().assertIsDisplayed()
    }

    @Test
    fun homeScreen_olqDashboardCard_isVisibleWhenDashboardIsNullAndLoading() = runComposeUiTest {
        uiStateFlow.value = StudentHomeUiState(userName = "Test User", dashboard = null, isDashboardLoading = true)
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        // OLQDashboardCard is always rendered -- same card whether data has
        // arrived yet or not (regression coverage: EmptyDashboardState/"Start
        // First Test" CTA must never appear, see the two tests below). "PHASE
        // 1" matches twice (see homeScreen_displaysPhaseProgressRibbons's
        // comment), so assert via onAllNodesWithText, not onNodeWithText.
        onAllNodesWithText("PHASE 1", substring = true).onFirst().assertExists()
        onNodeWithText("Psychology", substring = true).assertExists()
        onNodeWithText("GTO", substring = true).assertExists()
        // "Interview" also matches twice -- Phase2Card's IO row alongside
        // OLQDashboardCard's InterviewSection -- same reasoning as "PHASE 1".
        onAllNodesWithText("Interview", substring = true).onFirst().assertExists()
    }

    @Test
    fun homeScreen_olqDashboardCard_isVisibleWhenDashboardIsPopulated() = runComposeUiTest {
        uiStateFlow.value = StudentHomeUiState(
            userName = "Test User",
            dashboard = ProcessedDashboardData.empty(),
            isDashboardLoading = false
        )
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        onAllNodesWithText("PHASE 1", substring = true).onFirst().assertExists()
        onNodeWithText("Psychology", substring = true).assertExists()
        onNodeWithText("GTO", substring = true).assertExists()
        // "Interview" also matches twice -- Phase2Card's IO row alongside
        // OLQDashboardCard's InterviewSection -- same reasoning as "PHASE 1".
        onAllNodesWithText("Interview", substring = true).onFirst().assertExists()
    }

    // REGRESSION: EmptyDashboardState ("Start First Test" CTA) must never
    // appear -- OLQDashboardCard is always rendered instead, in every
    // combination of null/populated dashboard and loading/not-loading. Split
    // into one `runComposeUiTest` per state (rather than looping `setContent`
    // inside a single test) since `setContent` may only be called once per
    // Compose test host.
    @Test
    fun homeScreen_emptyDashboardState_isNeverShown_nullAndLoading() = runComposeUiTest {
        uiStateFlow.value = StudentHomeUiState(dashboard = null, isDashboardLoading = true)
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        onNodeWithText("Start First Test", substring = true).assertDoesNotExist()
    }

    @Test
    fun homeScreen_emptyDashboardState_isNeverShown_nullAndNotLoading() = runComposeUiTest {
        uiStateFlow.value = StudentHomeUiState(dashboard = null, isDashboardLoading = false)
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        onNodeWithText("Start First Test", substring = true).assertDoesNotExist()
    }

    @Test
    fun homeScreen_emptyDashboardState_isNeverShown_populatedAndNotLoading() = runComposeUiTest {
        uiStateFlow.value = StudentHomeUiState(dashboard = ProcessedDashboardData.empty(), isDashboardLoading = false)
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        onNodeWithText("Start First Test", substring = true).assertDoesNotExist()
    }

    @Test
    fun homeScreen_linearProgressIndicator_shownOnlyWhenDashboardLoading() = runComposeUiTest {
        uiStateFlow.value = StudentHomeUiState(dashboard = null, isDashboardLoading = true)
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        onNodeWithTag("dashboard_loading_indicator").assertExists()

        uiStateFlow.value = StudentHomeUiState(dashboard = ProcessedDashboardData.empty(), isDashboardLoading = false)
        waitForIdle()

        onNodeWithTag("dashboard_loading_indicator").assertDoesNotExist()
    }

    @Test
    fun homeScreen_dashboardError_displaysErrorBanner() = runComposeUiTest {
        // Adapted from the pre-cutover test's `error` field, which this
        // screen no longer renders at all -- only `dashboardError` drives the
        // visible banner (verified by reading StudentHomeScreen.kt).
        uiStateFlow.value = uiStateFlow.value.copy(dashboardError = "Failed to load progress")
        setContent { withTestDependencies { StudentHomeScreenUnderTest() } }

        // The error banner is far enough down the LazyColumn that it isn't
        // even composed within the default viewport -- performScrollTo() on
        // the (not-yet-existing) target node can't help; scroll the
        // LazyColumn itself to the node by content, same as
        // performScrollToNode's documented use for lazy layouts.
        onNode(hasScrollAction())
            .performScrollToNode(hasText("Failed to load progress", substring = true))
        onNodeWithText("Failed to load progress", substring = true).assertIsDisplayed()
    }

    // REGRESSION (root cause of the reported bug): this screen's own
    // onTopicClick used to hand-build "ppdt?selectedTab=2" as a single string
    // via a since-deleted `buildTopicRoute` helper and funnel it through a
    // (String) -> Unit callback -- SSBMaxDestinations.TopicScreen only ever
    // set that whole string as `topicId`, and TopicViewModel.getTestsForTopic
    // matches `topicId.uppercase()` via an exact `when`, so the mangled id
    // matched nothing and the Overview/Study Material/Tests tabs all rendered
    // empty. The side drawer (DrawerContent.kt) never had this bug -- it
    // always called onNavigateToTopic("ppdt") directly. These tests pin the
    // callback contract at its origin (this screen) so a future edit can't
    // silently reintroduce string-templating here.
    @Test
    fun homeScreen_topicClick_oir_passesCleanTopicIdAndTestsTabSelected() = runComposeUiTest {
        var capturedTopicId: String? = null
        var capturedSelectedTab: Int? = null
        uiStateFlow.value = uiStateFlow.value.copy(
            phase1Progress = Phase1Progress(
                oirProgress = TestProgress(TestType.OIR, TestStatus.NOT_ATTEMPTED),
                ppdtProgress = TestProgress(TestType.PPDT, TestStatus.NOT_ATTEMPTED)
            )
        )
        setContent {
            withTestDependencies {
                StudentHomeScreenUnderTest(
                    onNavigateToTopic = { topicId, selectedTab ->
                        capturedTopicId = topicId
                        capturedSelectedTab = selectedTab
                    }
                )
            }
        }

        onNodeWithText("OIR Test", substring = false).performClick()
        waitForIdle()

        assertEquals("oir", capturedTopicId)
        assertEquals(2, capturedSelectedTab)
    }

    @Test
    fun homeScreen_topicClick_ppdt_passesCleanTopicIdNotMangledQueryString() = runComposeUiTest {
        var capturedTopicId: String? = null
        var capturedSelectedTab: Int? = null
        uiStateFlow.value = uiStateFlow.value.copy(
            phase1Progress = Phase1Progress(
                oirProgress = TestProgress(TestType.OIR, TestStatus.NOT_ATTEMPTED),
                ppdtProgress = TestProgress(TestType.PPDT, TestStatus.COMPLETED)
            )
        )
        setContent {
            withTestDependencies {
                StudentHomeScreenUnderTest(
                    onNavigateToTopic = { topicId, selectedTab ->
                        capturedTopicId = topicId
                        capturedSelectedTab = selectedTab
                    }
                )
            }
        }

        // "PPDT" also renders in OLQDashboardCard's Phase1Section chip -- the
        // ribbon's TestProgressItem renders first in the LazyColumn (same
        // precedent as "PHASE 1"/"Interview" elsewhere in this file), so
        // onFirst() targets the ribbon's row.
        onAllNodesWithText("PPDT", substring = false).onFirst().performClick()
        waitForIdle()

        assertEquals("ppdt", capturedTopicId)
        assertFalse(capturedTopicId.orEmpty().contains("?"))
        assertEquals(2, capturedSelectedTab)
    }

    @Test
    fun homeScreen_topicClick_phase2Topics_passCleanTopicIds() = runComposeUiTest {
        val captured = mutableListOf<Pair<String, Int>>()
        uiStateFlow.value = uiStateFlow.value.copy(
            phase2Progress = Phase2Progress(
                psychologyProgress = TestProgress(TestType.TAT, TestStatus.NOT_ATTEMPTED),
                gtoProgress = TestProgress(TestType.GTO_GD, TestStatus.NOT_ATTEMPTED),
                interviewProgress = TestProgress(TestType.IO, TestStatus.NOT_ATTEMPTED)
            )
        )
        setContent {
            withTestDependencies {
                StudentHomeScreenUnderTest(
                    onNavigateToTopic = { topicId, selectedTab -> captured += topicId to selectedTab }
                )
            }
        }

        onNodeWithText("Psychology Tests", substring = false).performClick()
        waitForIdle()
        onNodeWithText("GTO Tasks", substring = false).performClick()
        waitForIdle()
        // "Interview" also renders in OLQDashboardCard's InterviewSection --
        // same onFirst() reasoning as the "PPDT" test above.
        onAllNodesWithText("Interview", substring = true).onFirst().performClick()
        waitForIdle()

        assertEquals(
            listOf("psychology" to 2, "gto" to 2, "interview" to 2),
            captured
        )
    }

    @Composable
    private fun StudentHomeScreenUnderTest(
        onNavigateToTopic: (String, Int) -> Unit = { _, _ -> }
    ) {
        StudentHomeScreen(
            onNavigateToTopic = onNavigateToTopic,
            onNavigateToPhaseDetail = {},
            onNavigateToStudy = {},
            onNavigateToResult = { _, _ -> },
            onOpenDrawer = {}
        )
    }

    @Composable
    private fun withTestDependencies(content: @Composable () -> Unit) {
        KoinApplication(application = { modules(module { single { mockViewModel } }) }) {
            CompositionLocalProvider(LocalNotificationPermissionController provides fakePermissionController) {
                // SSBMaxTheme (not a bare MaterialTheme) so LocalDesignTokens is
                // provided -- StudentHomeSections reads it (Phase 7,
                // docs/plans/CrossPlatform_SSOT), same requirement production
                // rendering already satisfies via the app's root theme wrapper.
                com.ssbmax.shared.ui.theme.SSBMaxTheme {
                    content()
                }
            }
        }
    }
}
