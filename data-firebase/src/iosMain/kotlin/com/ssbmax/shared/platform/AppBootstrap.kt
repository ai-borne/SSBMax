package com.ssbmax.shared.platform

import com.ssbmax.shared.di.iosObservabilityModule
import com.ssbmax.shared.domain.util.AnalyticsTracker
import com.ssbmax.shared.domain.util.CrashReporter
import com.ssbmax.shared.platform.util.UninstalledAnalyticsTracker
import com.ssbmax.shared.platform.util.UninstalledCrashReporter
import org.koin.core.Koin
import org.koin.core.context.startKoin

private var koinInstance: Koin? = null

/**
 * Idempotent Koin bootstrap for iOS.
 *
 * Phase 6: called from `iosApp/iosApp/AppDelegate.swift`'s
 * `application(_:didFinishLaunchingWithOptions:)`, i.e. real app-launch
 * lifecycle, so Koin is ready before `BGTaskScheduler` registration and
 * APNs device-token hand-off (both of which need Koin-provided
 * repositories, see [com.ssbmax.shared.platform.notifications]) run.
 *
 * [com.ssbmax.shared.ui.MainViewController] also calls this (kept as a
 * defensive fallback from Phase 5, when this app had no `AppDelegate` yet)
 * -- guarded so calling it twice is a no-op, not a crash.
 *
 * [crashReporter]/[analyticsTracker] are supplied by Swift, which owns the
 * Firebase SPM dependency they wrap -- see [iosObservabilityModule] for the
 * full reasoning. Kotlin's defaults are loud no-ops, not real
 * implementations, so the fallback call site above (and iOS test binaries)
 * still start a complete graph without silently pretending reports were
 * delivered. Kotlin/Native does not export default arguments to Swift, so
 * `AppDelegate.swift` must pass both explicitly -- which is the point.
 */
fun ensureKoinStarted(
    crashReporter: CrashReporter = UninstalledCrashReporter(),
    analyticsTracker: AnalyticsTracker = UninstalledAnalyticsTracker()
) {
    if (koinInstance != null) return
    koinInstance = startKoin {
        modules(
            com.ssbmax.shared.di.sharedModule,
            // Move 2: `sharedModule` alone is an INCOMPLETE graph -- it declares
            // the repository interfaces but no longer binds them, so that
            // `:shared` carries no Firebase and its Kotlin/Native test binaries
            // link without CocoaPods. `firebaseDataModule` (this module) supplies
            // the GitLive-backed implementations. This bootstrap lives here, not
            // in `:shared`, precisely because it must name both.
            com.ssbmax.shared.di.firebaseDataModule,
            iosObservabilityModule(crashReporter, analyticsTracker)
        )
    }.koin
}

/**
 * The started [Koin] instance. Callers must call [ensureKoinStarted] first
 * (both real bridge entry points -- [com.ssbmax.shared.platform.notifications.onFcmTokenReceived]
 * and [com.ssbmax.shared.platform.worker.registerAndScheduleBackgroundTasks]
 * -- already do this themselves before calling this getter).
 */
fun sharedKoin(): Koin =
    koinInstance ?: error("ensureKoinStarted() must be called before sharedKoin()")
