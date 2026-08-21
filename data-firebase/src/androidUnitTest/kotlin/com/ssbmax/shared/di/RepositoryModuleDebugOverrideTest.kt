package com.ssbmax.shared.di

import com.ssbmax.shared.data.repository.DebugOverrideSubscriptionRepository
import com.ssbmax.shared.data.repository.DebugOverrideTestUsageRecorder
import com.ssbmax.shared.data.repository.FakeInMemorySettings
import com.ssbmax.shared.data.repository.GitLiveSubscriptionRepository
import com.ssbmax.shared.data.repository.GitLiveTestUsageRecorder
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.util.DomainLogger
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.platform.isDebugBuild
import com.ssbmax.shared.platform.settings.DeveloperSettings
import org.junit.Assert.assertTrue
import org.junit.Test
import org.koin.dsl.koinApplication
import org.koin.dsl.module

/**
 * Phase 4 (KMP-convergence plan): pins that [repositoryModule]'s `SubscriptionRepository`/
 * `TestUsageRecorder` bindings resolve to the debug-override decorator only when
 * [isDebugBuild] is true, and to the plain `GitLive*` implementation otherwise -- the fail-closed
 * invariant (Rule 5) that keeps the decorator unconstructed in release.
 *
 * Deliberately not folded into `app`'s `PlatformModuleCheckTest`: that test's `checkModules()`
 * eagerly constructs the *entire* `appModules` graph (heavy Firebase-static mocking, `app` module
 * only), and `app`'s unit tests only ever run under one variant at a time. This test instead does
 * a *targeted* `get()` -- Koin's `single { }` is lazy, so only the one binding under test (and its
 * declared deps) gets constructed, no mocking needed since `GitLiveTestUsageRecorder` takes no
 * constructor params and `GitLiveSubscriptionRepository`'s only param ([DomainLogger], added for
 * L2, Payment Ecosystem Hardening plan Phase 12) is satisfied by the trivial [NoOpLogger] below.
 * That lets it exploit a fact real for
 * `:data-firebase` specifically: AGP resolves `:shared` (the module `isDebugBuild()` reads
 * `BuildConfig.DEBUG` from) per variant, so `testDebugUnitTest` and `testReleaseUnitTest` -- both
 * already part of `check` -- exercise the true debug and release values of [isDebugBuild] for real,
 * without needing to fake it.
 */
class RepositoryModuleDebugOverrideTest {

    private val koin = koinApplication {
        modules(
            repositoryModule,
            module {
                single { DeveloperSettings(FakeInMemorySettings()) }
                single<DomainLogger> { NoOpLogger() }
            }
        )
    }.koin

    @Test
    fun `SubscriptionRepository binding matches isDebugBuild for this variant`() {
        val repository = koin.get<SubscriptionRepository>()

        if (isDebugBuild()) {
            assertTrue(
                "debug build must resolve the dev-override decorator",
                repository is DebugOverrideSubscriptionRepository
            )
        } else {
            assertTrue(
                "release build must resolve the plain GitLive repository, never the decorator",
                repository is GitLiveSubscriptionRepository
            )
        }
    }

    @Test
    fun `TestUsageRecorder binding matches isDebugBuild for this variant`() {
        val recorder = koin.get<TestUsageRecorder>()

        if (isDebugBuild()) {
            assertTrue(
                "debug build must resolve the dev-override decorator",
                recorder is DebugOverrideTestUsageRecorder
            )
        } else {
            assertTrue(
                "release build must resolve the plain GitLive recorder, never the decorator",
                recorder is GitLiveTestUsageRecorder
            )
        }
    }
}
