import org.gradle.testing.jacoco.tasks.JacocoReport
import org.gradle.testing.jacoco.tasks.JacocoCoverageVerification
import java.math.BigDecimal
import com.android.build.api.dsl.ApplicationExtension

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.google.services)
    alias(libs.plugins.firebase.crashlytics)
    alias(libs.plugins.ksp)
}

// Temporarily disable mock google-services.json generation for local development
// Uncomment the block below if you need CI builds without Firebase config

/*
tasks.register("createMockGoogleServices") {
    doLast {
        if (!file("google-services.json").exists()) {
            println("⚠️ google-services.json not found - creating mock for CI build")
            val mockGoogleServices = """
            {
              "project_info": {
                "project_number": "123456789",
                "project_id": "mock-project-id",
                "storage_bucket": "mock-project-id.appspot.com"
              },
              "client": [
                {
                  "client_info": {
                    "mobilesdk_app_id": "1:123456789:android:mockappid",
                    "android_client_info": {
                      "package_name": "com.ssbmax"
                    }
                  },
                  "oauth_client": [],
                  "api_key": [
                    {
                      "current_key": "mock_api_key_for_ci"
                    }
                  ],
                  "services": {
                    "appinvite_service": {
                      "other_platform_oauth_client": []
                    }
                  }
                }
              ],
              "configuration_version": "1"
            }
            """.trimIndent()

            file("google-services.json").writeText(mockGoogleServices)
            println("✅ Created mock google-services.json for CI build with package name 'com.ssbmax'")
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn("createMockGoogleServices")
}
*/

extensions.getByType<ApplicationExtension>().apply {
    namespace = "com.ssbmax"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ssbmax"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        vectorDrawables {
            useSupportLibrary = true
        }

        // Room schema export (KMP-convergence Phase 9f: SSBDatabase moved here
        // from the deleted core:data module)
        ksp {
            arg("room.schemaLocation", "$projectDir/schemas")
        }

    }

    buildTypes {
        debug {
            isDebuggable = true
            // TODO: Enable after adding com.ssbmax.debug to Firebase Console
            // applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }

        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    kotlin {
        jvmToolchain(21)
        // Same ExperimentalTime opt-in as shared/build.gradle.kts: kotlin.time.Clock/
        // Instant are still @ExperimentalTime under Kotlin 2.2.20 (bumped for Xcode 26
        // SDK support), and app's own workers call into shared repository methods
        // whose signatures carry these types (e.g. InterviewAnalysisWorker ->
        // InterviewRepository.updateSession).
        compilerOptions {
            optIn.add("kotlin.time.ExperimentalTime")
        }
    }
    
    buildFeatures {
        compose = true
        buildConfig = true
    }
    
    lint {
        // Enforce string resources - fail build on hardcoded text
        error += "HardcodedText"
        lintConfig = file("lint.xml")

        // NonNullableMutableLiveDataDetector (bundled in AGP's androidx-lifecycle
        // lint checks) crashes with IncompatibleClassChangeError when analyzing
        // this module's dependency on :shared (a Compose Multiplatform module) --
        // a lint tooling/UAST version mismatch, not a real violation. Same crash
        // and same workaround as shared/build.gradle.kts (core/data/build.gradle.kts
        // used to carry the same disable before the module was deleted in the
        // KMP-convergence plan's Phase 9f).
        disable += "NullSafeMutableLiveData"

        // Lint baseline for systematic cleanup of warnings (Phase 1.5)
        baseline = file("lint-baseline.xml")

        // Fail build on any errors (enforce quality)
        abortOnError = true
        warningsAsErrors = false

        disable += setOf(
            "ModifierParameter",
            "ModifierDeclaration",
            "ModifierFactoryExtensionFunction",
            "ModifierFactoryReturnType",
            "ModifierFactoryUnreferencedReceiver",
            // NonNullableMutableLiveDataDetector (bundled in AGP's androidx-lifecycle
            // lint checks) crashes with IncompatibleClassChangeError once :shared's
            // Compose Multiplatform artifacts are on this module's classpath (Phase 0
            // KMP spike, debugImplementation(project(":shared"))) -- a lint/UAST
            // tooling version mismatch, not a real violation. Same workaround already
            // applied in shared/build.gradle.kts.
            "NullSafeMutableLiveData"
        )
    }
    
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "/META-INF/LICENSE.md"
            excludes += "/META-INF/LICENSE-notice.md"
        }
    }
    
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
            
            all {
                // Global timeout: 60 seconds per test to prevent hangs
                it.systemProperty("junit.jupiter.execution.timeout.default", "60s")
                
                // JUnit 4 timeout (for older tests)
                it.jvmArgs("-Djunit.timeout=60000")
                
                // Fail fast - stop on first failure
                it.failFast = true
                
                // Max heap size
                it.maxHeapSize = "2g"
            }
        }
    }
}


dependencies {
    // Core modules. `:data-firebase` (Move 2 of the iOS CocoaPods->SPM
    // convergence) supplies the Firebase-backed implementations of
    // `:shared`'s repository interfaces; it `api`-exposes `:shared`, so the
    // explicit `:shared` dependency below is redundant for compilation but
    // kept deliberately -- `app` uses `:shared`'s types directly and should
    // declare what it uses rather than rely on a transitive.
    implementation(project(":data-firebase"))
    implementation(project(":shared"))

    // Custom lint rules
    lintChecks(project(":lint"))

    // Room (KMP-convergence Phase 9f: SSBDatabase moved here from the
    // deleted core:data module — see app/src/.../data/local/SSBDatabase.kt)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    // Core Android
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)
    
    // Compose BOM
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation("androidx.compose.material:material:1.6.0") // For pull-to-refresh
    
    // Navigation
    implementation(libs.androidx.navigation.compose)
    
    // Coroutines
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.core)

    // kotlinx-datetime: moved domain models (InterviewSession, InterviewResult, etc.)
    // now use kotlinx.datetime.Instant instead of java.time.Instant (Phase 1 KMP move).
    // :shared only exposes it as `implementation`, not `api`, so app needs its own copy.
    implementation(libs.kotlinx.datetime)

    // Lifecycle
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    
    // Koin dependency injection (replaces Hilt as of Phase 3 of the KMP migration)
    implementation(libs.koin.core)
    implementation(libs.koin.android)
    implementation(libs.koin.compose)
    implementation(libs.koin.compose.viewmodel)

    // WorkManager (background jobs for question pre-generation).
    // Workers resolve their own dependencies via KoinComponent/inject() now
    // (see e.g. GTOAnalysisWorker), so no Hilt-work assisted-injection
    // compiler is needed — the default WorkerFactory works.
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Firebase
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.storage)
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.crashlytics)
    
    // Google Sign-In
    implementation(libs.play.services.auth)
    implementation(libs.kotlinx.coroutines.play.services)
    
    // Image Loading
    implementation(libs.coil.compose)


    // Google Play Billing
    implementation(libs.billing.ktx)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.koin.test)
    testImplementation(libs.koin.test.junit4)
    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("org.robolectric:robolectric:4.11.1")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    // WorkManager testing (for Phase 1 worker tests)
    testImplementation("androidx.work:work-testing:2.9.0")

    // Real org.json for JVM unit tests — Android's stub jar throws Stub! on JSONArray/JSONObject put()
    testImplementation("org.json:json:20260814")

    // Robolectric for Android unit tests
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core:1.5.0")

    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.mockk.android) // For mocking in UI tests
    androidTestImplementation(libs.androidx.navigation.testing) // For navigation testing

    // Debug
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    // Memory leak detection (debug builds only)
    debugImplementation(libs.leakcanary.android)
}

// Jacoco code coverage configuration
tasks.register<JacocoReport>("jacocoTestReport") {
    dependsOn("testDebugUnitTest")
    
    group = "Reporting"
    description = "Generate Jacoco coverage reports for Debug build"
    
    reports {
        xml.required.set(true)
        html.required.set(true)
        csv.required.set(false)
    }
    
    val debugTree = fileTree("${project.buildDir}/tmp/kotlin-classes/debug") {
        exclude(
            // Android generated
            "**/R.class",
            "**/R$*.class",
            "**/BuildConfig.*",
            "**/Manifest*.*",
            "**/*Test*.*",
            "android/**/*.*",

            // Hilt/Dagger generated
            "**/*_MembersInjector.class",
            "**/Dagger*Component*.*",
            "**/*Module_*Factory.class",
            "**/di/**",
            "**/*_Factory*.*",
            "**/*_Impl*.*",
            "**/HiltWrapper*.*",
            "**/*_Hilt*.*",

            // Navigation generated
            "**/*Navigation*.*",
            "**/*Destinations*.*",
            "**/*NavGraph*.*",

            // Application class
            "**/*Application*.*",

            // Theme/Design system (UI only, no logic)
            "**/ui/theme/**",
            "**/designsystem/**",

            // Lambda classes
            "**/Lambda$*.class",
            "**/Lambda.class",
            "**/*Lambda.class",
            "**/*Lambda*.class"
        )
    }
    
    val mainSrc = "${project.projectDir}/src/main/kotlin"
    
    sourceDirectories.setFrom(files(mainSrc))
    classDirectories.setFrom(files(debugTree))
    // Point at the exact AGP unit-test coverage file. Rooting a fileTree at the
    // whole buildDir made Gradle treat every other task's output (e.g.
    // packageDebugAssets) as an undeclared input, failing task validation.
    executionData.setFrom(
        layout.buildDirectory.file("outputs/unit_test_code_coverage/debugUnitTest/testDebugUnitTest.exec")
    )
}

tasks.register<JacocoCoverageVerification>("jacocoTestCoverageVerification") {
    dependsOn("testDebugUnitTest")
    group = "Verification"
    description = "Validate jacoco coverage for Debug unit tests"

    val debugTree = fileTree("${project.buildDir}/tmp/kotlin-classes/debug") {
        exclude(
            "**/R.class",
            "**/R$*.class",
            "**/BuildConfig.*",
            "**/Manifest*.*",
            "**/*Test*.*",
            "android/**/*.*",
            "**/*_MembersInjector.class",
            "**/Dagger*Component*.*",
            "**/*Module_*Factory.class",
            "**/di/**",
            "**/*_Factory*.*",
            "**/*_Impl*.*",
            "**/HiltWrapper*.*",
            "**/*_Hilt*.*",
            "**/*Navigation*.*",
            "**/*Destinations*.*",
            "**/*NavGraph*.*",
            "**/*Application*.*",
            "**/ui/theme/**",
            "**/designsystem/**",
            "**/Lambda$*.class",
            "**/Lambda.class",
            "**/*Lambda.class",
            "**/*Lambda*.class"
        )
    }

    val mainSrc = "${project.projectDir}/src/main/kotlin"

    classDirectories.setFrom(files(debugTree))
    sourceDirectories.setFrom(files(mainSrc))
    // Point at the exact AGP unit-test coverage file. Rooting a fileTree at the
    // whole buildDir made Gradle treat every other task's output (e.g.
    // packageDebugAssets) as an undeclared input, failing task validation.
    executionData.setFrom(
        layout.buildDirectory.file("outputs/unit_test_code_coverage/debugUnitTest/testDebugUnitTest.exec")
    )

    violationRules {
        rule {
            limit {
                counter = "LINE"
                value = "COVEREDRATIO"
                minimum = BigDecimal("0.03")
            }
            limit {
                counter = "BRANCH"
                value = "COVEREDRATIO"
                minimum = BigDecimal("0.01")
            }
        }
    }

    onlyIf { executionData.files.any { it.exists() } }
}

tasks.named("check") {
    // Coverage verification can be run explicitly in CI (not wired here to avoid extra task ordering)
}
