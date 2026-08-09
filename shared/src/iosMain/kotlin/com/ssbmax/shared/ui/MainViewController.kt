package com.ssbmax.shared.ui

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.uikit.OnFocusBehavior
import androidx.compose.ui.window.ComposeUIViewController
import com.ssbmax.shared.platform.auth.GoogleSignInLauncher
import com.ssbmax.shared.platform.auth.IosGoogleSignInLauncher
import com.ssbmax.shared.platform.permissions.NotificationPermissionController
import com.ssbmax.shared.ui.auth.LocalGoogleSignInLauncher
import com.ssbmax.shared.ui.permissions.LocalNotificationPermissionController
import org.koin.compose.koinInject

/**
 * iOS entry point. Koin must already be started before this renders --
 * `AppDelegate.swift`'s `application(_:didFinishLaunchingWithOptions:)` does
 * it, which it must anyway for `BGTaskScheduler` registration and APNs token
 * hand-off (both Koin-dependent).
 *
 * This Composable used to also call `ensureKoinStarted()` itself as a Phase 5
 * defensive fallback. Move 2 (iOS CocoaPods->SPM convergence) removed that
 * call: the bootstrap now lives in `:data-firebase` because the graph needs
 * `firebaseDataModule`, which this module sits below and cannot see. A
 * fallback that cannot assemble a complete graph is worse than none -- if Koin
 * is unstarted, [koinInject] below fails loudly and immediately instead of
 * silently building a half-wired container.
 *
 * Phase 5: renders the real nav graph + chrome (drawer/bottom nav) via
 * [SSBMaxRoot] instead of the Phase 0 single-screen demo it replaced — the
 * first real multi-screen, chrome-wrapped flow exercised on iOS.
 *
 * Phase 2: [SSBMaxRoot] also closes iOS's total theming gap — this
 * Composable previously wrapped everything in a bare `MaterialTheme { }`
 * with no branded colors/typography and no reaction to the user's theme
 * preference at all. [SSBMaxRoot] now owns theme collection/application, so
 * this function's only remaining direct responsibilities are Koin bootstrap
 * and the two platform CompositionLocals below.
 *
 * [googleSignInLauncher] is provided directly here rather than via Koin,
 * matching the Android side's `MainActivity`-constructed,
 * CompositionLocal-provided pattern; iOS has no equivalent
 * `ActivityResultLauncher` lifecycle constraint. It defaults to
 * [IosGoogleSignInLauncher] (a STUB — see its class doc) so this Composable
 * still compiles/renders standalone, but `ContentView.swift` always passes
 * a real `GIDSignIn`-backed implementation (see
 * `RealIosGoogleSignInLauncher.swift`) since Swift, not Kotlin, owns the
 * `GoogleSignIn-iOS` SPM dependency and the presenting `UIViewController`
 * `GIDSignIn.sharedInstance.signIn(withPresenting:)` needs.
 *
 * [NotificationPermissionController], unlike the Google Sign-In launcher, IS
 * a plain Koin single on iOS (`PlatformModule.ios.kt` -- `UNUserNotificationCenter`
 * has no `ActivityResultLauncher`-style registration constraint), so it's
 * resolved via [koinInject] here rather than threaded through as a
 * parameter. Missing this provider entirely (rather than the Google
 * Sign-In stub's intentional throw) was a real gap: `StudentHomeScreen`/
 * `StartInterviewScreen` read [LocalNotificationPermissionController]
 * unconditionally, so any screen touching notification permissions crashed
 * on iOS with "No NotificationPermissionController provided" the moment it
 * composed -- discovered via a real launch crash reaching `StudentHomeScreen`.
 *
 * `onFocusBehavior = OnFocusBehavior.DoNothing`: the CMP-iOS default
 * (`FocusableAboveKeyboard`) has the platform itself shift/resize the whole
 * root view above the keyboard on text-field focus. Screens that already
 * call `Modifier.imePadding()` (e.g. `PPDTWritingPhase`) then get shifted
 * twice -- once by the platform, once by Compose -- which crops the top app
 * bar off-screen. Turning this off makes iOS behave like Android, where
 * `imePadding()` is the only inset-avoidance mechanism.
 */
fun MainViewController(
    googleSignInLauncher: GoogleSignInLauncher = IosGoogleSignInLauncher()
) = ComposeUIViewController(configure = { onFocusBehavior = OnFocusBehavior.DoNothing }) {
    val notificationPermissionController = koinInject<NotificationPermissionController>()
    CompositionLocalProvider(
        LocalGoogleSignInLauncher provides googleSignInLauncher,
        LocalNotificationPermissionController provides notificationPermissionController
    ) {
        SSBMaxRoot()
    }
}
