package com.ssbmax.shared.data.repository

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import app.cash.turbine.test
import com.ssbmax.shared.db.SharedDatabase
import com.ssbmax.shared.domain.model.NotificationPriority
import com.ssbmax.shared.domain.model.NotificationType
import kotlinx.coroutines.test.runTest
import org.junit.Before
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Phase 4 (Centralized Result-Announcement Notifications plan): getNotifications/getUnreadCount
 * used to depend on a push actually being delivered and handled (the only writer into the cache
 * was saveNotification, called solely from Android's FCM handler; iOS had no writer at all). This
 * test exercises the piece that closes that gap -- a Firestore-shaped `SSBMaxNotificationDto`
 * mapping straight into the same cache the ViewModel reads, with no push/saveNotification call
 * involved -- to encode Rule 9's "why": push delivery isn't guaranteed, so the inbox must not
 * depend on it.
 */
class GitLiveNotificationDtosTest {

    private lateinit var database: SharedDatabase
    private lateinit var cache: GitLiveNotificationCacheManager

    @Before
    fun setup() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        SharedDatabase.Schema.create(driver)
        database = SharedDatabase(driver)
        cache = GitLiveNotificationCacheManager(database)
    }

    @Test
    fun `a Firestore-shaped DTO maps to the exact domain fields, not just a subset`() {
        val dto = SSBMaxNotificationDto(
            id = "n1",
            userId = "user-1",
            type = "GRADING_COMPLETE",
            priority = "HIGH",
            title = "Result ready",
            message = "Your TAT evaluation is ready",
            actionUrl = "ssbmax://results/n1",
            actionData = mapOf("submissionId" to "sub-1"),
            isRead = false,
            createdAt = 1_700_000_000_000L,
            expiresAt = null
        )

        val domain = dto.toDomain()

        assertEquals("n1", domain.id)
        assertEquals(NotificationType.GRADING_COMPLETE, domain.type)
        assertEquals(NotificationPriority.HIGH, domain.priority)
        assertEquals("ssbmax://results/n1", domain.actionUrl)
        assertEquals(mapOf("submissionId" to "sub-1"), domain.actionData)
    }

    @Test
    fun `an unrecognized type or priority string defaults instead of throwing`() {
        val dto = SSBMaxNotificationDto(id = "n2", userId = "user-1", type = "SOME_FUTURE_TYPE", priority = "SOME_FUTURE_PRIORITY")

        val domain = dto.toDomain()

        assertEquals(NotificationType.GENERAL_ANNOUNCEMENT, domain.type)
        assertEquals(NotificationPriority.NORMAL, domain.priority)
    }

    @Test
    fun `inbox reflects a Firestore-mapped notification with no saveNotification or push call involved`() = runTest {
        val dto = SSBMaxNotificationDto(
            id = "n3",
            userId = "user-1",
            type = "FEEDBACK_AVAILABLE",
            title = "Feedback ready",
            message = "Your instructor left feedback",
            createdAt = 1_700_000_000_000L
        )

        // Mirrors exactly what GitLiveNotificationRepository.ensureFirestoreSyncStarted's snapshot
        // listener does per document -- map then insert -- without going through saveNotification.
        cache.insert(dto.toDomain())

        cache.getNotifications("user-1").test {
            assertEquals(listOf("n3"), awaitItem().map { it.id })
        }
        cache.getUnreadCount("user-1").test {
            assertEquals(1, awaitItem())
        }
    }
}
