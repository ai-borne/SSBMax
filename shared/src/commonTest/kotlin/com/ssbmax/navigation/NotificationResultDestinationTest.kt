package com.ssbmax.navigation

import com.ssbmax.shared.domain.model.NotificationPriority
import com.ssbmax.shared.domain.model.NotificationType
import com.ssbmax.shared.domain.model.SSBMaxNotification
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Regression coverage for the bug reported live on-device (2026-08-17): tapping a graded-result
 * notification always routed to `SSBMaxDestinations.NotYetPorted`, for every test type, because
 * `sendNotification.js` wrote a self-referential `actionUrl` and the client had no dispatch logic
 * at all. Covers every test type `notifyEvaluationComplete` (functions/src/notifications/
 * sendNotification.js) can write a notification for, not just WAT (the type used to reproduce it).
 */
class NotificationResultDestinationTest {

    private fun notification(testType: String?, submissionId: String? = "sub123") = SSBMaxNotification(
        id = "notif1",
        userId = "user1",
        type = NotificationType.GRADING_COMPLETE,
        priority = NotificationPriority.NORMAL,
        title = "Your result is ready",
        message = "Your evaluation has been graded.",
        actionUrl = "notifications/center", // the undeployed-server-fix value; must be ignored
        actionData = buildMap {
            submissionId?.let { put("submissionId", it) }
            testType?.let { put("testType", it) }
        },
        isRead = false,
        createdAt = 0L
    )

    @Test
    fun `maps every result-bearing test type to its real destination`() {
        assertEquals(SSBMaxDestinations.OIRTestResult("sub123"), resolveNotificationResultDestination(notification("OIR")))
        assertEquals(SSBMaxDestinations.PPDTSubmissionResult("sub123"), resolveNotificationResultDestination(notification("PPDT")))
        assertEquals(SSBMaxDestinations.TATSubmissionResult("sub123"), resolveNotificationResultDestination(notification("TAT")))
        assertEquals(SSBMaxDestinations.WATSubmissionResult("sub123"), resolveNotificationResultDestination(notification("WAT")))
        assertEquals(SSBMaxDestinations.SRTSubmissionResult("sub123"), resolveNotificationResultDestination(notification("SRT")))
        assertEquals(SSBMaxDestinations.SDSubmissionResult("sub123"), resolveNotificationResultDestination(notification("SD")))
        assertEquals(SSBMaxDestinations.PIQSubmissionResult("sub123"), resolveNotificationResultDestination(notification("PIQ")))
        assertEquals(SSBMaxDestinations.GTOGDResult("sub123"), resolveNotificationResultDestination(notification("GTO_GD")))
        assertEquals(SSBMaxDestinations.GTOLecturetteResult("sub123"), resolveNotificationResultDestination(notification("GTO_LECTURETTE")))
        assertEquals(SSBMaxDestinations.GTOGPEResult("sub123"), resolveNotificationResultDestination(notification("GTO_GPE")))
        assertEquals(SSBMaxDestinations.InterviewResult("sub123"), resolveNotificationResultDestination(notification("IO")))
    }

    @Test
    fun `ignores actionUrl entirely even when it is the self-referential notifications-center bug value`() {
        // Every fixture above already sets actionUrl = "notifications/center" (the undeployed-fix
        // value) and still resolves correctly -- this test just makes that intent explicit so a
        // future edit that reintroduces an actionUrl dependency fails loudly here, not silently
        // on-device against old Firestore docs the server fix hasn't touched yet.
        val result = resolveNotificationResultDestination(notification("WAT"))
        assertEquals(SSBMaxDestinations.WATSubmissionResult("sub123"), result)
    }

    @Test
    fun `unported GTO sub-types fall through to null not a crash`() {
        for (unported in listOf("GTO_PGT", "GTO_GOR", "GTO_HGT", "GTO_IO", "GTO_CT", "GTO_FGT")) {
            assertNull(resolveNotificationResultDestination(notification(unported)), "expected null for $unported")
        }
    }

    @Test
    fun `unrecognized testType returns null`() {
        assertNull(resolveNotificationResultDestination(notification("SOMETHING_NEW")))
    }

    @Test
    fun `missing testType returns null`() {
        assertNull(resolveNotificationResultDestination(notification(testType = null)))
    }

    @Test
    fun `missing submissionId returns null`() {
        assertNull(resolveNotificationResultDestination(notification(testType = "WAT", submissionId = null)))
    }

    @Test
    fun `null actionData returns null`() {
        val notification = SSBMaxNotification(
            id = "notif1",
            userId = "user1",
            type = NotificationType.GRADING_COMPLETE,
            title = "Your result is ready",
            message = "Your evaluation has been graded.",
            actionUrl = "notifications/center",
            actionData = null,
            createdAt = 0L
        )
        assertNull(resolveNotificationResultDestination(notification))
    }
}
