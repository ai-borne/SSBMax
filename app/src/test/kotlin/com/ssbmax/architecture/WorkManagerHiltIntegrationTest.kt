package com.ssbmax.architecture

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

/**
 * Architecture tests to prevent WorkManager + Koin integration regressions.
 *
 * These tests verify that critical configuration is present in build files,
 * manifest, and worker sources, without needing to run the full Android app.
 *
 * Renamed in spirit (not file name, to keep git history/diff small) from
 * this suite's original Hilt-era assertions: KMP Phase 3 replaced Hilt with
 * Koin, so workers now resolve dependencies via `KoinComponent`/`by inject()`
 * instead of `@HiltWorker`/`@AssistedInject`, and `SSBMaxApplication` starts
 * a Koin graph directly in `onCreate()` instead of providing a
 * `HiltWorkerFactory` via `Configuration.Provider`. Default WorkManager
 * initialization is used again (previously disabled in the manifest only to
 * let Hilt's `WorkManagerInitializer` substitute a Hilt-aware factory).
 *
 * Run with: ./gradlew :app:testDebugUnitTest --tests "*.WorkManagerHiltIntegrationTest"
 */
class WorkManagerHiltIntegrationTest {

    private val projectRoot: File = File(System.getProperty("user.dir") ?: ".").parentFile ?: File(".")

    // All SSB test workers that require Koin injection
    private val requiredWorkers = listOf(
        "PPDTAnalysisWorker",
        "WATAnalysisWorker",
        "TATStoryAnalysisWorker",
        "TATSynthesisWorker",
        "SRTAnalysisWorker",
        "SDTAnalysisWorker",
        "GTOAnalysisWorker",
        "InterviewAnalysisWorker",
        "InterviewQuestionGenerationWorker",
        "QuestionCacheCleanupWorker"
    )

    @Test
    fun `AndroidManifest should not disable default WorkManager initialization`() {
        val manifestFile = File(projectRoot, "app/src/main/AndroidManifest.xml")
        assertTrue("AndroidManifest.xml not found", manifestFile.exists())

        val manifestContent = manifestFile.readText()

        // Workers resolve dependencies via KoinComponent/inject() now, so the
        // default WorkerFactory (built from the default WorkManagerInitializer)
        // works again — no reason to remove it as Hilt's setup once required.
        val disablesWorkManagerInitializer = manifestContent.contains("androidx.work.WorkManagerInitializer") &&
            manifestContent.contains("tools:node=\"remove\"")

        assertFalse(
            "AndroidManifest.xml should NOT disable default WorkManager initialization " +
                "(that was only needed for Hilt's HiltWorkerFactory substitution, removed in Phase 3)",
            disablesWorkManagerInitializer
        )
    }

    @Test
    fun `build gradle should not reference Hilt-work dependencies`() {
        val buildFile = File(projectRoot, "app/build.gradle.kts")
        assertTrue("app/build.gradle.kts not found", buildFile.exists())

        val buildContent = buildFile.readText()

        assertFalse(
            "app/build.gradle.kts should not depend on androidx.hilt:hilt-work " +
                "(workers resolve dependencies via Koin's KoinComponent/inject() now)",
            buildContent.contains("androidx.hilt:hilt-work")
        )
        assertFalse(
            "app/build.gradle.kts should not depend on androidx.hilt:hilt-compiler",
            buildContent.contains("androidx.hilt:hilt-compiler")
        )
        assertTrue(
            "app/build.gradle.kts must depend on Koin (implementation(libs.koin.android) or libs.koin.core)",
            buildContent.contains("libs.koin.android") || buildContent.contains("libs.koin.core")
        )
    }

    @Test
    fun `build gradle should not reference any Hilt or KAPT plugin`() {
        val buildFile = File(projectRoot, "app/build.gradle.kts")
        assertTrue("app/build.gradle.kts not found", buildFile.exists())

        val buildContent = buildFile.readText()

        assertFalse(
            "app/build.gradle.kts should not apply the Hilt plugin (removed in Phase 3 Hilt->Koin migration)",
            buildContent.contains("libs.plugins.hilt")
        )
        assertFalse(
            "app/build.gradle.kts should not apply the kapt plugin " +
                "(only existed for Hilt/Dagger annotation processing)",
            buildContent.contains("kotlin(\"kapt\")")
        )
    }

    @Test
    fun `SSBMaxApplication should start Koin, not provide a HiltWorkerFactory`() {
        val appFile = File(projectRoot, "app/src/main/kotlin/com/ssbmax/SSBMaxApplication.kt")
        assertTrue("SSBMaxApplication.kt not found", appFile.exists())

        val appContent = appFile.readText()

        assertTrue(
            "SSBMaxApplication must call startKoin { ... } in onCreate()",
            appContent.contains("startKoin")
        )
        assertFalse(
            "SSBMaxApplication should no longer implement Configuration.Provider " +
                "(that only existed to supply a HiltWorkerFactory)",
            appContent.contains("Configuration.Provider")
        )
        assertFalse(
            "SSBMaxApplication should no longer reference HiltWorkerFactory",
            appContent.contains("HiltWorkerFactory")
        )
    }

    @Test
    fun `all analysis workers should resolve dependencies via KoinComponent`() {
        val workersDir = File(projectRoot, "app/src/main/kotlin/com/ssbmax/workers")
        assertTrue("Workers directory not found", workersDir.exists())

        val analysisWorkers = workersDir.listFiles()
            ?.filter { it.name.endsWith("Worker.kt") }
            ?: emptyList()

        assertTrue("No workers found", analysisWorkers.isNotEmpty())

        val missingKoinComponent = mutableListOf<String>()
        val stillUsingHilt = mutableListOf<String>()

        for (worker in analysisWorkers) {
            val content = worker.readText()
            if (!content.contains("KoinComponent")) {
                missingKoinComponent.add(worker.name)
            }
            if (content.contains("@HiltWorker") || content.contains("@AssistedInject")) {
                stillUsingHilt.add(worker.name)
            }
        }

        if (missingKoinComponent.isNotEmpty()) {
            fail(
                """
                These workers don't implement KoinComponent:
                ${missingKoinComponent.joinToString("\n")}

                Without KoinComponent, `by inject()` dependencies won't resolve!
                """.trimIndent()
            )
        }

        if (stillUsingHilt.isNotEmpty()) {
            fail(
                """
                These workers still reference Hilt annotations (@HiltWorker/@AssistedInject),
                which should have been fully converted to Koin in Phase 3:
                ${stillUsingHilt.joinToString("\n")}
                """.trimIndent()
            )
        }
    }

    /**
     * Verify all required SSB test workers exist and are properly configured.
     */
    @Test
    fun `all required SSB workers must exist`() {
        val workersDir = File(projectRoot, "app/src/main/kotlin/com/ssbmax/workers")
        assertTrue("Workers directory not found", workersDir.exists())

        val existingWorkers = workersDir.listFiles()
            ?.map { it.nameWithoutExtension }
            ?.toSet() ?: emptySet()

        val missingWorkers = requiredWorkers.filter { it !in existingWorkers }

        if (missingWorkers.isNotEmpty()) {
            fail(
                """
                Required SSB workers are missing:
                ${missingWorkers.joinToString("\n") { "- $it.kt" }}

                These workers are essential for SSB test OLQ analysis.
                """.trimIndent()
            )
        }
    }
}
