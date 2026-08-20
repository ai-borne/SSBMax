package com.ssbmax

import android.app.Application
import android.util.Log
import com.ssbmax.di.appModules
import com.ssbmax.shared.platform.worker.BackgroundTaskScheduler
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin
import org.koin.java.KoinJavaComponent.get

private const val TAG = "SSBMaxApplication"

/**
 * SSBMax Application class
 * Koin entry point for dependency injection.
 *
 * Responsibilities:
 * - Start Koin with all app/:shared modules (`core:data` deleted in the
 *   KMP-convergence plan's Phase 9f)
 * - Initialize WorkManager for background jobs (default WorkManager worker
 *   factory now that workers resolve their own dependencies via
 *   `KoinComponent`/`inject()` instead of Hilt's assisted-injection worker
 *   factory — no custom `android.app.Configuration` provider override
 *   needed, so default WorkManager initialization is used again)
 * - Schedule periodic question cache cleanup + submission archival via the
 *   shared BackgroundTaskScheduler (Phase 4 platform shim) instead of
 *   calling WorkManager directly — same underlying WorkManager behavior on
 *   Android, but now behind the interface iOS's BGTaskScheduler actual also
 *   implements.
 * The old `BYPASS_SUBSCRIPTION_LIMITS`/`BYPASS_INTERVIEW_PREREQUISITES`
 * `BuildConfig` fields (Android-only, and the latter never actually wired)
 * were retired by the dev-subscription-override plan's Phase 6: the debug UI's
 * `SubscriptionOverride.FORCE_PREMIUM` (Settings -> Developer section, both
 * platforms) replaces the former, and `DeveloperSettings.bypassInterviewPrerequisites`
 * replaces the latter.
 */
class SSBMaxApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚀 SSBMax Application starting...")

        startKoin {
            androidLogger()
            androidContext(this@SSBMaxApplication)
            modules(appModules)
        }

        val scheduler = get<BackgroundTaskScheduler>(BackgroundTaskScheduler::class.java)
        scheduler.scheduleQuestionCacheCleanup()

        Log.d(TAG, "✅ SSBMax Application initialized")
    }
}

