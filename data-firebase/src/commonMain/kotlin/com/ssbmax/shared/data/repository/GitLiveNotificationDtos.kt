package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.FCMToken
import com.ssbmax.shared.domain.model.NotificationPreferences
import com.ssbmax.shared.domain.model.NotificationPriority
import com.ssbmax.shared.domain.model.NotificationType
import com.ssbmax.shared.domain.model.SSBMaxNotification
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * Firestore DTOs + domain<->DTO mappers for [GitLiveNotificationRepository], split out (Phase 4,
 * Centralized Result-Announcement Notifications plan) to keep that file under the 300-line cap once
 * it gained a Firestore-sync listener.
 */
internal fun FCMToken.toDto() = FCMTokenDto(
    userId = userId,
    token = token,
    deviceId = deviceId,
    platform = platform,
    createdAt = createdAt,
    updatedAt = updatedAt
)

internal fun FCMTokenDto.toDomain() = FCMToken(
    userId = userId,
    token = token,
    deviceId = deviceId,
    platform = platform,
    createdAt = createdAt,
    updatedAt = updatedAt
)

// Same unknown-enum-name fallback as GitLiveNotificationCacheManager.toDomain() -- a legacy/future
// server-written type/priority string must not crash the sync listener for a user's whole inbox.
internal fun SSBMaxNotificationDto.toDomain() = SSBMaxNotification(
    id = id,
    userId = userId,
    type = runCatching { NotificationType.valueOf(type) }
        .getOrDefault(NotificationType.GENERAL_ANNOUNCEMENT),
    priority = runCatching { NotificationPriority.valueOf(priority) }
        .getOrDefault(NotificationPriority.NORMAL),
    title = title,
    message = message,
    imageUrl = imageUrl,
    actionUrl = actionUrl,
    actionData = actionData,
    isRead = isRead,
    createdAt = createdAt,
    expiresAt = expiresAt
)

internal fun SSBMaxNotification.toDto() = SSBMaxNotificationDto(
    id = id,
    userId = userId,
    type = type.name,
    priority = priority.name,
    title = title,
    message = message,
    imageUrl = imageUrl,
    actionUrl = actionUrl,
    actionData = actionData,
    isRead = isRead,
    createdAt = createdAt,
    expiresAt = expiresAt
)

internal fun NotificationPreferences.toDto() = NotificationPreferencesDto(
    userId = userId,
    enablePushNotifications = enablePushNotifications,
    enableGradingNotifications = enableGradingNotifications,
    enableFeedbackNotifications = enableFeedbackNotifications,
    enableBatchInvitations = enableBatchInvitations,
    enableGeneralAnnouncements = enableGeneralAnnouncements,
    enableStudyReminders = enableStudyReminders,
    enableTestReminders = enableTestReminders,
    enableMarketplaceUpdates = enableMarketplaceUpdates,
    quietHoursEnabled = quietHoursEnabled,
    quietHoursStart = quietHoursStart,
    quietHoursEnd = quietHoursEnd,
    updatedAt = updatedAt
)

internal fun NotificationPreferencesDto.toDomain() = NotificationPreferences(
    userId = userId,
    enablePushNotifications = enablePushNotifications,
    enableGradingNotifications = enableGradingNotifications,
    enableFeedbackNotifications = enableFeedbackNotifications,
    enableBatchInvitations = enableBatchInvitations,
    enableGeneralAnnouncements = enableGeneralAnnouncements,
    enableStudyReminders = enableStudyReminders,
    enableTestReminders = enableTestReminders,
    enableMarketplaceUpdates = enableMarketplaceUpdates,
    quietHoursEnabled = quietHoursEnabled,
    quietHoursStart = quietHoursStart,
    quietHoursEnd = quietHoursEnd,
    updatedAt = updatedAt
)

@Serializable
internal data class FCMTokenDto(
    val userId: String = "",
    val token: String = "",
    val deviceId: String = "",
    val platform: String = "android",
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L
)

@Serializable
internal data class SSBMaxNotificationDto(
    val id: String = "",
    val userId: String = "",
    val type: String = "",
    val priority: String = "NORMAL",
    val title: String = "",
    val message: String = "",
    val imageUrl: String? = null,
    val actionUrl: String? = null,
    val actionData: Map<String, String>? = null,
    val isRead: Boolean = false,
    val createdAt: Long = 0L,
    val expiresAt: Long? = null
)

@Serializable
internal data class NotificationPreferencesDto(
    val userId: String = "",
    val enablePushNotifications: Boolean = true,
    val enableGradingNotifications: Boolean = true,
    val enableFeedbackNotifications: Boolean = true,
    val enableBatchInvitations: Boolean = true,
    val enableGeneralAnnouncements: Boolean = true,
    val enableStudyReminders: Boolean = true,
    val enableTestReminders: Boolean = true,
    val enableMarketplaceUpdates: Boolean = true,
    val quietHoursEnabled: Boolean = false,
    val quietHoursStart: Int = 22,
    val quietHoursEnd: Int = 8,
    val updatedAt: Long = Clock.System.now().toEpochMilliseconds()
)
