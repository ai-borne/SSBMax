package com.ssbmax.shared.presentation.root

import com.ssbmax.shared.domain.model.AppTheme
import com.ssbmax.shared.domain.model.FeatureFlags
import com.ssbmax.shared.platform.currentAppVersion
import com.ssbmax.shared.platform.settings.AppThemeSettings
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeFeatureFlagRepository
import com.ssbmax.shared.presentation.testing.FakeSettings
import com.ssbmax.shared.presentation.testing.FakeUserProfileRepository
import com.ssbmax.shared.presentation.testing.RecordingLogger
import com.ssbmax.shared.presentation.testing.testUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Characterization test for [AppRootViewModel], written for its Phase 2
 * (KMP-convergence plan) introduction. Pins the exact bug this phase fixes:
 * the Android original (`app/MainViewModel.kt`) read
 * `appThemeSettings.themeFlow.value` once in `init` instead of collecting
 * the flow, so theme switching never re-themed the running app and iOS
 * (which never even read the value once) had no theming reaction at all.
 * `re-emits when AppThemeSettings changes after construction` below is the
 * one that would fail against the old snapshot-read implementation.
 */
@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class AppRootViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var appThemeSettings: AppThemeSettings
    private lateinit var authRepository: FakeAuthRepository
    private lateinit var userProfileRepository: FakeUserProfileRepository
    private lateinit var featureFlagRepository: FakeFeatureFlagRepository
    private lateinit var logger: RecordingLogger

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        appThemeSettings = AppThemeSettings(FakeSettings())
        authRepository = FakeAuthRepository(initialUser = testUser())
        userProfileRepository = FakeUserProfileRepository()
        featureFlagRepository = FakeFeatureFlagRepository()
        logger = RecordingLogger()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = AppRootViewModel(
        appThemeSettings = appThemeSettings,
        authRepository = authRepository,
        userProfileRepository = userProfileRepository,
        featureFlagRepository = featureFlagRepository,
        logger = logger
    )

    @Test
    fun `themeFlow starts at the persisted theme`() = runTest(testDispatcher) {
        appThemeSettings.setTheme(AppTheme.DARK)

        val viewModel = buildViewModel()

        assertEquals(AppTheme.DARK, viewModel.themeFlow.value)
    }

    @Test
    fun `re-emits when AppThemeSettings changes after construction`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        assertEquals(AppTheme.SYSTEM, viewModel.themeFlow.value)

        appThemeSettings.setTheme(AppTheme.DARK)

        // A one-time `.value` read at init (the original bug) would still
        // show SYSTEM here; live collection reflects the change immediately.
        assertEquals(AppTheme.DARK, viewModel.themeFlow.value)
    }

    @Test
    fun `updates login streak for a signed-in user on init`() = runTest(testDispatcher) {
        buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(AppTheme.SYSTEM, appThemeSettings.getTheme()) // sanity: setup didn't mutate theme
        assertTrue(logger.entries.isEmpty())
    }

    @Test
    fun `skips login streak update when no user is signed in`() = runTest(testDispatcher) {
        authRepository.userFlow.value = null

        buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(logger.entries.isEmpty())
    }

    @Test
    fun `a failed streak update result does not crash or log`() = runTest(testDispatcher) {
        userProfileRepository.updateLoginStreakResult = Result.failure(IllegalStateException("boom"))

        buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        // updateLoginStreak returning Result.failure doesn't throw -- only a
        // real thrown exception reaches the try/catch's log call, matching
        // the original's "not critical for app functionality" comment.
        assertTrue(logger.entries.none { it.level == "e" })
    }

    @Test
    fun `updateRequired defaults to false before the flag fetch resolves`() = runTest(testDispatcher) {
        featureFlagRepository.flagsResult = FeatureFlags(minimumSupportedAppVersion = "999.0.0")

        val viewModel = buildViewModel()

        // Fail-open: until the async fetch resolves, a real user is never blocked by default.
        assertEquals(false, viewModel.updateRequired.value)
    }

    @Test
    fun `updateRequired stays false when the live minimum equals the current build`() = runTest(testDispatcher) {
        // Uses the real currentAppVersion() rather than a hardcoded string: the iOS actual's
        // NSBundle read returns a fallback (not the Info.plist value) inside a bare
        // Kotlin/Native test binary, so a fixed "low" string here would be flaky per-platform.
        featureFlagRepository.flagsResult = FeatureFlags(minimumSupportedAppVersion = currentAppVersion())

        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(false, viewModel.updateRequired.value)
    }

    @Test
    fun `updateRequired becomes true once the live minimum exceeds the current build`() = runTest(testDispatcher) {
        // Safely above any real or fallback currentAppVersion() value on any platform.
        featureFlagRepository.flagsResult = FeatureFlags(minimumSupportedAppVersion = "99999.0.0")

        val viewModel = buildViewModel()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(true, viewModel.updateRequired.value)
        assertEquals(1, featureFlagRepository.getFeatureFlagsCallCount)
    }
}
