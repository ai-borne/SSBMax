package com.ssbmax.architecture

import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File

/**
 * Regression guard for the fix that closed this repo's Gemini API key
 * exposure: the key used to reach the client via `BuildConfig`/`Info.plist`
 * (extractable from any built APK/IPA), read by a now-deleted
 * `KtorGeminiClient`. Gemini is now called only from the
 * `geminiGenerateContent` Cloud Function proxy (`functions/src/geminiProxy.js`);
 * `GeminiProxyClient` (`data-firebase`) reaches it via an authenticated
 * `httpsCallable`, no key involved client-side at all.
 *
 * Source-level assertions, matching this package's existing precedent
 * ([WorkManagerHiltIntegrationTest]): the thing this guards against is a
 * *silent* regression (someone re-adding `GEMINI_API_KEY` to `BuildConfig` to
 * "fix" a broken AI call without realizing why it was removed) — nothing in
 * the compiler or Koin's `checkModules()` would catch that.
 */
class GeminiKeyNotInClientTest {

    private val projectRoot: File = File(System.getProperty("user.dir") ?: ".").parentFile ?: File(".")

    @Test
    fun `app build gradle does not define a GEMINI_API_KEY BuildConfig field`() {
        val source = File(projectRoot, "app/build.gradle.kts")
        assertFalse(
            "GEMINI_API_KEY must never be wired into BuildConfig again -- it ships the key inside " +
                "the APK, extractable from any build. Gemini calls go through geminiGenerateContent " +
                "(functions/src/geminiProxy.js) instead.",
            source.readText().contains("GEMINI_API_KEY")
        )
    }

    @Test
    fun `SSBMaxApplication does not read a Gemini key from BuildConfig`() {
        val source = File(projectRoot, "app/src/main/kotlin/com/ssbmax/SSBMaxApplication.kt")
        assertFalse(
            "SSBMaxApplication must not supply a Gemini API key to Koin -- GeminiProxyClient needs no key.",
            source.readText().contains("GEMINI_API_KEY")
        )
    }

    @Test
    fun `iOS AppBootstrap does not read a Gemini key from Info plist`() {
        val source = File(
            projectRoot,
            "data-firebase/src/iosMain/kotlin/com/ssbmax/shared/platform/AppBootstrap.kt"
        )
        assertFalse(
            "iOS's ensureKoinStarted must not read GeminiAPIKey from Info.plist -- same fix as Android.",
            source.readText().contains("GeminiAPIKey")
        )
    }
}
