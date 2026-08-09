package com.ssbmax.architecture

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Phase 5 contracts for Android platform glue and user-visible notifications. */
class AndroidPlatformUiQualityContractTest {
    private val projectRoot = locateProjectRoot()
    private val appSource = read("app/src/main/kotlin/com/ssbmax/MainActivity.kt")
    private val notificationSource = read("app/src/main/kotlin/com/ssbmax/notifications/NotificationHelper.kt")
    private val fcmSource = read("app/src/main/kotlin/com/ssbmax/notifications/SSBMaxFirebaseMessagingService.kt")
    private val gtoSource = read("app/src/main/kotlin/com/ssbmax/notifications/GtoNotificationHelper.kt")
    private val strings = read("app/src/main/res/values/strings.xml")

    @Test
    fun `android entry point provides platform bridges to shared root`() {
        assertTrue(appSource.contains("SSBMaxRoot()"))
        assertTrue(appSource.contains("LocalNotificationPermissionController provides"))
        assertTrue(appSource.contains("LocalGoogleSignInLauncher provides"))
        assertTrue(appSource.contains("deepLinkGateway.submit(intent.getStringExtra(\"deepLink\"))"))
    }

    @Test
    fun `platform launchers register before shared content is composed`() {
        val contentIndex = appSource.indexOf("        setContent {")
        assertTrue(appSource.indexOf("registerForActivityResult(") < contentIndex)
        assertTrue(appSource.indexOf("AndroidNotificationPermissionController(this") < contentIndex)
        assertTrue(appSource.indexOf("AndroidGoogleSignInLauncher(this") < contentIndex)
    }

    @Test
    fun `android notification copy is localized`() {
        assertFalse(notificationSource.contains("Your GTO test has been analyzed"))
        assertFalse(notificationSource.contains("Results Ready\""))
        assertFalse(fcmSource.contains("View Results"))
        assertFalse(fcmSource.contains("View Invitation"))
        assertTrue(strings.contains("notification_gto_results_body"))
        assertTrue(strings.contains("notification_action_view_results"))
        assertTrue(strings.contains("notification_action_view_invitation"))
    }

    @Test
    fun `notification diagnostics never log payload content or identifiers`() {
        assertFalse(fcmSource.contains("Message received from:"))
        assertFalse(fcmSource.contains("Message data payload:"))
        assertFalse(fcmSource.contains("Message notification:"))
        assertFalse(fcmSource.contains("Handling data payload - Type:"))
        assertFalse(notificationSource.contains("sessionId: \$sessionId"))
        assertFalse(notificationSource.contains("submissionId: \$submissionId"))
    }

    @Test
    fun `platform error and fallback text is resource backed`() {
        assertTrue(strings.contains("notification_default_title"))
        assertTrue(strings.contains("notification_channel_description"))
        assertTrue(notificationSource.contains("notification_interview_channel_description"))
        assertTrue(strings.contains("notification_gto_results_body"))
        assertTrue(gtoSource.contains("notification_gto_results_title"))
        assertTrue(fcmSource.contains("notification_default_title"))
    }

    private fun read(relativePath: String): String {
        val file = File(projectRoot, relativePath)
        assertTrue("Required source file is missing: $relativePath", file.exists())
        return file.readText()
    }

    private fun locateProjectRoot(): File {
        var directory = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (!File(directory, "settings.gradle.kts").exists()) {
            directory = directory.parentFile ?: return directory
        }
        return directory
    }
}
