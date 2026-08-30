package com.ssbmax.shared.di

import com.ssbmax.shared.db.DatabaseDriverFactory
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.platform.audio.WhiteNoisePlayer
import com.ssbmax.shared.platform.billing.BillingClient
import com.ssbmax.shared.platform.billing.StoreKitBillingClient
import com.ssbmax.shared.platform.permissions.IosNotificationPermissionController
import com.ssbmax.shared.platform.permissions.NotificationPermissionController
import com.ssbmax.shared.platform.settings.AppThemeSettings
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.platform.settings.ReadStateSettings
import com.ssbmax.shared.platform.settings.SettingsFactory
import com.ssbmax.shared.platform.tts.IosTTSService
import com.ssbmax.shared.platform.tts.TTSService
import com.ssbmax.shared.platform.util.IosDomainLogger
import com.ssbmax.shared.platform.worker.BGTaskSchedulerBackgroundTaskScheduler
import com.ssbmax.shared.platform.worker.BackgroundTaskScheduler
import org.koin.dsl.module

actual val platformModule = module {
    single { DatabaseDriverFactory() }
    single { SettingsFactory().create() }
    single { AppThemeSettings(get()) }
    single { DeveloperSettings(get()) }
    single { ReadStateSettings(get()) }
    single<TTSService> { IosTTSService() }
    single { WhiteNoisePlayer() }
    // Unlike Android's AndroidNotificationPermissionController, iOS's
    // UNUserNotificationCenter has no Activity-registration lifecycle
    // constraint, so it can be a plain Application-scoped Koin single.
    single<NotificationPermissionController> { IosNotificationPermissionController() }
    single<BackgroundTaskScheduler> { BGTaskSchedulerBackgroundTaskScheduler(get(), get(), get()) }
    single<BillingClient> { StoreKitBillingClient() }
    // Phase 7a: real observability seam -- closes "iOS has zero logging"
    // (this plan's opening complaint for iOS).
    single<DomainLogger> { IosDomainLogger() }
    // CrashReporter/AnalyticsTracker are NOT bound here: Kotlin cannot
    // construct them, Swift supplies them at launch. See
    // [iosObservabilityModule], which ensureKoinStarted() loads alongside
    // sharedModule.
}
