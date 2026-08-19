import org.jetbrains.compose.ExperimentalComposeLibrary
import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// SSOT target of the KMP-convergence plan: `shared` is where business logic,
// data, and UI converge. `core:data` was fully dissolved into this module
// (Phase 9f); `app`'s UI/ViewModel/navigation layers dissolved into it earlier
// (Phase 5/6a) -- `app` itself persists by design as Android platform glue
// (MainActivity, notifications, WorkManager workers), not an ongoing
// dissolution target. See the plan's phase list for history.
plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.library)
    alias(libs.plugins.compose.multiplatform)
    alias(libs.plugins.compose.compiler.kmp)
    alias(libs.plugins.sqldelight)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    // expect/actual classes (DatabaseDriverFactory, SettingsFactory, WhiteNoisePlayer)
    // are Beta as of Kotlin 2.2.20 -- this repo relies on them deliberately for
    // platform-specific singletons, so silence the per-declaration warning rather
    // than restructure around it.
    compilerOptions {
        freeCompilerArgs.add("-Xexpect-actual-classes")
    }

    androidTarget {
        @OptIn(ExperimentalKotlinGradlePluginApi::class)
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_21)
        }
    }

    // Apple Silicon dev machine (uname -m == arm64) -> simulator target is
    // iosSimulatorArm64. iosArm64 (device) is also declared since it's zero
    // extra cost to configure and keeps the target list "real" rather than
    // simulator-only, but only the simulator target was actually exercised
    // in this spike (no physical device available).
    // No `binaries.framework { }` here: Move 2 (iOS CocoaPods->SPM convergence)
    // moved `SharedKit` up to `:data-firebase`, which `api`-exports this module.
    // The framework has to be produced by the topmost module so the shipped app
    // carries the Firebase-backed repository implementations AND this module's
    // UI/ViewModels; a framework built here would link an app whose Koin graph
    // has no repository bindings at all.
    // RevenueCat's purchases-kmp klibs (kn-core Cinterop-RevenueCat*) record a
    // linkerOpts `-L` pointing at the BUILD MACHINE's Xcode --
    // `/Applications/Xcode-16.4.app/.../usr/lib/swift/iphonesimulator/` -- which
    // does not exist here, so `ld` silently drops the search path and then fails
    // the Kotlin/Native test executable with `Undefined symbols: _swift_FORCE_LOAD
    // _$_swiftCompatibility56 / ...Concurrency / _swift_getFunctionTypeMetadata
    // GlobalActorBackDeploy`. Those are Swift back-deployment shims force-loaded by
    // RevenueCat's bundled Swift objects. Re-add the same search path resolved from
    // THIS machine's active toolchain (`xcode-select -p`) so the libs are found.
    // This is an upstream packaging bug, independent of the Kotlin version -- it
    // only surfaced now because nothing had ever linked the iOS test binary.
    // NOT a CocoaPods reintroduction: the Swift objects themselves ship inside the
    // klib, only the platform Swift runtime shims need locating.
    val swiftRuntimeSearchPath: (String) -> String = { sdk ->
        val developerDir = providers.exec {
            commandLine("xcode-select", "-p")
        }.standardOutput.asText.get().trim()
        "-L$developerDir/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/$sdk"
    }

    iosArm64 {
        binaries.all { linkerOpts(swiftRuntimeSearchPath("iphoneos")) }
    }
    iosSimulatorArm64 {
        binaries.all { linkerOpts(swiftRuntimeSearchPath("iphonesimulator")) }
    }

    applyDefaultHierarchyTemplate()

    // Kotlin 2.3.20 (see gradle/libs.versions.toml for why)
    // ships kotlin.time.Clock/Instant as @ExperimentalTime -- kotlinx-datetime 0.7.1's
    // kotlinx.datetime.Clock/Instant are now deprecated typealiases for those stdlib
    // types, so every pre-existing `Clock.System.now()` / `Instant.fromEpochMilliseconds()`
    // call site across shared/commonMain needs this opt-in (some surfaced as "needs
    // opt-in", others cascaded into a misleading "unresolved reference" -- same cause,
    // fixed for real by importing kotlin.time.Clock/Instant directly instead of the
    // deprecated kotlinx.datetime typealiases, which weren't propagating the opt-in
    // correctly across Kotlin/Native metadata compilation).
    // ExperimentalForeignApi: iosMain's raw Objective-C interop (NSError in
    // BGTaskSchedulerBackgroundTaskScheduler/StoreKitBillingClient, AVFoundation
    // in WhiteNoisePlayer/IosTTSService, ...) started needing this opt-in under
    // 2.2.20's stricter checking -- it wasn't annotated before and evidently
    // wasn't enforced. Blanket module opt-in instead of annotating individual
    // files.
    sourceSets.all {
        languageSettings.optIn("kotlin.time.ExperimentalTime")
        languageSettings.optIn("kotlinx.cinterop.ExperimentalForeignApi")
    }

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
            // Phase 5 (dev subscription override plan): DeveloperSection.kt is this
            // codebase's first real @Preview -- every prior Composable's violation is
            // grandfathered in shared/detekt-baseline.xml instead. See the version
            // catalog entry's own comment for why this needs a direct GAV declaration
            // rather than the (deprecated on this Compose Multiplatform version)
            // `compose.components.uiToolingPreview` accessor.
            implementation(libs.compose.ui.tooling.preview)
            // Phase 3c (#12): commonMain `BackHandler` -- see the version
            // catalog entry's own comment for why this needs a direct
            // declaration.
            implementation(libs.compose.ui.backhandler)
            // Phase 5: Login/RoleSelection need Icons.AutoMirrored.Filled.Login /
            // Icons.Default.{School,Groups}, which aren't in the small default
            // icon set bundled with compose.material3 -- this is the JetBrains
            // Compose Multiplatform-published extended icon pack (not the
            // Android-only androidx-compose-material-icons-extended catalog
            // alias `app` uses, which has no common variant).
            implementation(compose.materialIconsExtended)

            // Phase 5 (UI): navigation + image loading, both real KMP artifacts
            // (versions verified against maven-central metadata before adding).
            implementation(libs.navigation.compose.kmp)
            implementation(libs.coil3.compose)
            implementation(libs.coil3.network.ktor3)
            implementation(libs.androidx.lifecycle.runtime.compose.kmp)
            implementation(libs.androidx.lifecycle.viewmodel.compose.kmp)

            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.datetime)
            implementation(libs.kotlinx.serialization.json)

            implementation(libs.koin.core)
            implementation(libs.koin.compose)
            implementation(libs.koin.compose.viewmodel)

            // NO Firebase here, deliberately -- Move 2 of the iOS CocoaPods->SPM
            // convergence moved every GitLive-backed implementation to
            // `:data-firebase`. Keeping this module's klib graph Firebase-free is
            // what lets its Kotlin/Native test binaries link without CocoaPods,
            // which is why the `cocoapods {}` block and its ~90 lines of Xcode
            // workarounds are gone from this file. Do not add a Firebase
            // dependency back here.

            implementation(libs.sqldelight.runtime)
            implementation(libs.sqldelight.coroutines)

            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.json)

            implementation(libs.multiplatform.settings)
            implementation(libs.multiplatform.settings.coroutines)

            // Phase 4 (RevenueCat integration): replaces hand-rolled Play/StoreKit
            // reconciliation. Pure-Kotlin KMP artifact -- no CocoaPods/SPM wiring
            // needed on iOS, same as ktor-darwin/coil3 above.
            implementation(libs.purchases.kmp.core)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.kotlinx.coroutines.test)
            implementation(libs.ktor.client.mock)
            implementation(libs.koin.test)
            // Turbine is pure Kotlin/coroutines (JVM+JS+Native) -- unlike MockK it has
            // a real KMP artifact, so Phase 1's ViewModel characterization tests run
            // it here to cover iOS too, not just androidUnitTest below.
            implementation(libs.turbine)
            // Compose Multiplatform's own commonTest UI-test artifact (real KMP target,
            // unlike androidx.compose.ui:ui-test-junit4 which is Android-only) -- declared
            // here so it's available to every target's runComposeUiTest, including iOS's
            // Native test harness later. Phase 2's own SSBMaxThemeUiTest currently lives in
            // androidUnitTest only (needs Robolectric, see that source set below); full
            // cross-platform UI-test porting is Phase 6a's larger undertaking.
            @OptIn(ExperimentalComposeLibrary::class)
            implementation(compose.uiTest)
        }
        // Phase 1 domain move: the 6 MockK-dependent unit tests from core:domain's
        // JVM-only test source set land here (androidUnitTest), not commonTest --
        // MockK has no KMP/native equivalent, so they stay JUnit4 + MockK on the
        // Android target only.
        val androidUnitTest by getting {
            dependencies {
                implementation(libs.junit)
                implementation(libs.mockk)
                implementation(libs.kotlinx.coroutines.test)
                // Phase 2: JVM SQLDelight driver to actually exercise CachedOirResult
                // reads/writes against a real in-memory SQLite DB in unit tests --
                // closes the Phase 0 exit report's "SQLDelight unexercised at
                // runtime" gap without needing an emulator/simulator.
                implementation(libs.sqldelight.sqlite.driver)
                // Phase 2: `androidx.compose.ui.test.runComposeUiTest`'s Android host-side
                // implementation reads `android.os.Build.FINGERPRINT`, which is null without
                // Robolectric's shadow classes -- same dependency `app` already uses for its
                // own Robolectric-backed unit tests. `@RunWith(RobolectricTestRunner::class)`
                // is JUnit4-only (no Kotlin/Native equivalent), so the one CMP UI test this
                // phase adds (SSBMaxThemeUiTest) lives in this androidUnitTest source set,
                // not commonTest -- porting the rest of the suite to run on iOS too is
                // Phase 6a's larger undertaking.
                implementation(libs.robolectric)
            }
        }
        androidMain.dependencies {
            implementation(libs.koin.android)
            implementation(libs.sqldelight.android.driver)
            implementation(libs.ktor.client.android)
            implementation(libs.androidx.work.runtime.ktx)
            implementation(libs.billing.ktx)
            // Phase 5: legacy GoogleSignInClient, matching the pre-KMP
            // FirebaseAuthService flow -- see AndroidGoogleSignInLauncher.
            implementation(libs.play.services.auth)
            // GitLive's Android artifacts declare com.google.firebase:* deps
            // without version pins (expects the consumer to apply Firebase's
            // BOM) -- confirmed via a real build failure ("Could not find
            // com.google.firebase:firebase-auth-ktx:") before this was added.
            implementation(project.dependencies.platform(libs.firebase.bom))
            // Phase 7a: AndroidCrashReporter/AndroidAnalyticsTracker actuals.
            implementation(libs.firebase.crashlytics)
            implementation(libs.firebase.analytics)
        }
        iosMain.dependencies {
            implementation(libs.sqldelight.native.driver)
            implementation(libs.ktor.client.darwin)
        }
    }
}

dependencies {
    lintChecks(project(":lint"))
}

android {
    namespace = "com.ssbmax.shared"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        // Phase 8 (Cross-Platform SSOT plan): read by currentAppVersion()'s
        // Android actual for the remote-kill-switch version gate. Must be
        // bumped alongside app/build.gradle.kts's `versionName` and iOS's
        // Info.plist `CFBundleShortVersionString` at release time -- there is
        // no single build-time SSOT across Gradle and Xcode, so this is a
        // release-checklist item, not a contract value (only the *minimum
        // supported* version is a contracts/ value; see routes.yaml).
        buildConfigField("String", "APP_VERSION_NAME", "\"1.0.0\"")
    }

    // Robolectric-only launcher Activity for SSBMaxThemeUiTest's
    // runComposeUiTest -- see shared/src/androidUnitTest/AndroidManifest.xml's
    // own doc comment. Merged only into the JVM unit test manifest.
    // includeAndroidResources is required for AGP to actually merge/honor a
    // per-test-sourceSet manifest for a library module's unit tests --
    // confirmed empirically: no processDebugUnitTestManifest task exists,
    // and the override is silently ignored, without it.
    testOptions.unitTests.isIncludeAndroidResources = true
    sourceSets.getByName("test") {
        manifest.srcFile("src/androidUnitTest/AndroidManifest.xml")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    // Phase 1 (dev subscription override plan): needed so androidMain's
    // `isDebugBuild()` actual can read the generated BuildConfig.DEBUG --
    // this module previously had no BuildConfig class at all.
    buildFeatures {
        buildConfig = true
    }

    lint {
        // NonNullableMutableLiveDataDetector (bundled in AGP's androidx-lifecycle
        // lint checks) crashes with IncompatibleClassChangeError on this module's
        // Compose Multiplatform-generated ActualResourceCollectors.kt -- a lint
        // tooling/UAST version mismatch, not a real violation. Workaround is the
        // one lint's own crash message suggests.
        disable += "NullSafeMutableLiveData"
    }
}

sqldelight {
    databases {
        create("SharedDatabase") {
            packageName.set("com.ssbmax.shared.db")
        }
    }
}

// Layers config/detekt/detekt-shared.yml (the "ssbmax" custom rule set
// activation) on top of the repo-wide config -- see that file's own doc for
// why it can't just live in config/detekt/detekt.yml directly.
detekt {
    config.setFrom(rootProject.files("config/detekt/detekt.yml", "config/detekt/detekt-shared.yml"))
}
