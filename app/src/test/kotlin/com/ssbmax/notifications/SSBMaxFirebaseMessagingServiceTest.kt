package com.ssbmax.notifications

import com.ssbmax.shared.domain.model.NotificationType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Phase 3 (Centralized Result-Announcement Notifications plan): `buildInboxNotification` is the
 * pure payload -> SSBMaxNotification mapping `onMessageReceived` uses to fix the
 * "never writes to the in-app inbox" bug. Kept Android-framework-free so it's testable without
 * Robolectric (the existing Robolectric suite here is `@Ignore`d for an SDK-35 mismatch).
 */
class SSBMaxFirebaseMessagingServiceTest {

    @Test
    fun buildInboxNotification_usesServerNotificationIdWhenPresent_soSaveOverwritesNotDuplicates() {
        val notification = buildInboxNotification(
            userId = "user-1",
            notificationId = "server-doc-id",
            type = NotificationType.GRADING_COMPLETE,
            title = "Your result is ready",
            message = "Your WAT evaluation has been graded.",
            actionUrl = "/notifications",
            submissionId = "sub-42",
            testType = "WAT"
        )

        assertEquals("server-doc-id", notification.id)
    }

    @Test
    fun buildInboxNotification_generatesIdWhenPayloadHasNone() {
        val notification = buildInboxNotification(
            userId = "user-1",
            notificationId = null,
            type = NotificationType.GENERAL_ANNOUNCEMENT,
            title = "Announcement",
            message = "Hello",
            actionUrl = null,
            submissionId = null,
            testType = null
        )

        assertTrue(notification.id.isNotBlank())
    }

    @Test
    fun buildInboxNotification_mapsAllFieldsForGradingComplete() {
        val notification = buildInboxNotification(
            userId = "user-1",
            notificationId = "doc-1",
            type = NotificationType.GRADING_COMPLETE,
            title = "Your result is ready",
            message = "Your SRT evaluation has been graded.",
            actionUrl = "/notifications",
            submissionId = "sub-99",
            testType = "SRT"
        )

        assertEquals("user-1", notification.userId)
        assertEquals(NotificationType.GRADING_COMPLETE, notification.type)
        assertEquals("Your result is ready", notification.title)
        assertEquals("Your SRT evaluation has been graded.", notification.message)
        assertEquals("/notifications", notification.actionUrl)
        assertEquals(mapOf("submissionId" to "sub-99", "testType" to "SRT"), notification.actionData)
        assertEquals(false, notification.isRead)
    }

    @Test
    fun buildInboxNotification_preservesTypeForEveryNotificationType() {
        NotificationType.entries.forEach { type ->
            val notification = buildInboxNotification(
                userId = "user-1",
                notificationId = "doc-$type",
                type = type,
                title = "Title",
                message = "Message",
                actionUrl = null,
                submissionId = null,
                testType = null
            )

            assertEquals(type, notification.type)
        }
    }

    @Test
    fun buildInboxNotification_actionDataNullWhenSubmissionAndTestTypeMissing() {
        val notification = buildInboxNotification(
            userId = "user-1",
            notificationId = "doc-1",
            type = NotificationType.GENERAL_ANNOUNCEMENT,
            title = "Announcement",
            message = "Hello",
            actionUrl = null,
            submissionId = null,
            testType = null
        )

        assertNull(notification.actionData)
    }
}
