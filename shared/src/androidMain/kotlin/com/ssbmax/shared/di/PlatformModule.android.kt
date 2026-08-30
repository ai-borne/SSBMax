package com.ssbmax.shared.di

import com.ssbmax.shared.db.DatabaseDriverFactory
import com.ssbmax.shared.domain.util.AnalyticsTracker
import com.ssbmax.shared.domain.util.CrashReporter
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.platform.audio.WhiteNoisePlayer
import com.ssbmax.shared.platform.billing.BillingClient
import com.ssbmax.shared.platform.billing.PlayBillingClient
import com.ssbmax.shared.platform.settings.AppThemeSettings
import com.ssbmax.shared.platform.settings.DeveloperSettings
import com.ssbmax.shared.platform.settings.ReadStateSettings
import com.ssbmax.shared.platform.settings.SettingsFactory
import com.ssbmax.shared.platform.tts.AndroidTTSService
import com.ssbmax.shared.platform.tts.TTSService
import com.ssbmax.shared.platform.util.AndroidAnalyticsTracker
import com.ssbmax.shared.platform.util.AndroidCrashReporter
import com.ssbmax.shared.platform.util.AndroidDomainLogger
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

actual val platformModule = module {
    single { DatabaseDriverFactory(androidContext()) }
    single { SettingsFactory(androidContext()).create() }
    single { AppThemeSettings(get()) }
    single { DeveloperSettings(get()) }
    single { ReadStateSettings(get()) }
    single<TTSService> { AndroidTTSService(androidContext()) }
    single { WhiteNoisePlayer() }
    single<BillingClient> { PlayBillingClient(androidContext()) }
    // Phase 7a: real observability seams -- the one place DomainLogger/
    // CrashReporter/AnalyticsTracker are bound for Android (no more
    // NoOpLogger default requiring a `core:data`-side override).
    single<DomainLogger> { AndroidDomainLogger() }
    single<CrashReporter> { AndroidCrashReporter() }
    single<AnalyticsTracker> { AndroidAnalyticsTracker() }
}
