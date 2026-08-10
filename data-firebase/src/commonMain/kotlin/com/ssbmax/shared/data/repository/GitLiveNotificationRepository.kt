package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.FCMToken
import com.ssbmax.shared.domain.model.NotificationPreferences
import com.ssbmax.shared.domain.model.SSBMaxNotification
import com.ssbmax.shared.domain.repository.NotificationRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed port of the Android `NotificationRepositoryImpl`.
 * Same three Firestore collections (fcmTokens, notifications,
 * notificationPreferences -- both non-"notifications" names camelCase per
 * firestore.rules, fixed from a snake_case mismatch in Phase 7c) plus the
 * local Room->SQLDelight cache
 * ([GitLiveNotificationCacheManager]) for [getNotifications]/[getUnreadCount]
 * (read from cache only, matching the Android original -- these two never
 * read Firestore directly there either).
 *
 * Two things named here rather than silently ported, both confirmed by grep
 * across core/data + app before starting:
 *
 * 1. `getDeviceId()` (Android's `Settings.Secure.ANDROID_ID` read) is defined
 *    in the Android `NotificationRepositoryImpl` but never called anywhere in
 *    that same file or by any caller -- genuinely dead code in the original,
 *    not just an unused DAO method. No device-ID expect/actual was added
 *    here because there is nothing that would call it; adding one now would
 *    be exactly the kind of speculative feature Rule 2 rules out.
 * 2. `getCurrentFCMToken`/`subscribeToTopic`/`unsubscribeFromTopic` (the
 *    Android impl's extra, non-interface public methods backed by
 *    `FirebaseMessaging`) have zero callers anywhere in app/ or core/ --
 *    confirmed by grep, still true as of Phase 7c even though
 *    `SSBMaxFirebaseMessagingService.onNewToken` itself does call
 *    `saveFCMToken` for real now (not the TODO stub earlier session notes
 *    described).
 *    `dev.gitlive:firebase-messaging` is also not a dependency of this
 *    module (only auth/firestore/common/storage are, per
 *    shared/build.gradle.kts) -- adding it to reach zero real callers would
 *    be scope creep, so this port has no `FirebaseMessaging` surface at all.
 *    If/when the messaging service is actually wired up, this is the named
 *    gap to close.
 *
 * `saveFCMToken`/`getFCMToken`/`deleteFCMToken`/`getPreferences`/
 * `savePreferences` ARE ported despite having no ViewModel caller either,
 * because they are mandatory members of the `NotificationRepository`
 * interface (SSOT) -- Kotlin requires a full implementation, unlike the DAO
 * methods above which are internal helpers with no such contract.
 */
class GitLiveNotificationRepository(
    private val cache: GitLiveNotificationCacheManager
) : NotificationRepository {

    private val tokensCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.FCM_TOKENS)
    private val notificationsCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.NOTIFICATIONS)
    private val preferencesCollection = Firebase.firestore.collection(SsbContracts.FirestorePaths.NOTIFICATION_PREFERENCES)

    override suspend fun saveFCMToken(token: FCMToken): Result<Unit> = try {
        tokensCollection.document("${token.userId}_${token.deviceId}").set(token.toDto())
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to save FCM token: ${e.message}", e))
    }

    override suspend fun getFCMToken(userId: String, deviceId: String): Result<FCMToken?> = try {
        val doc = tokensCollection.document("${userId}_$deviceId").get()
        val token = if (doc.exists) doc.data(FCMTokenDto.serializer()).toDomain() else null
        Result.success(token)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get FCM token: ${e.message}", e))
    }

    override suspend fun deleteFCMToken(userId: String, deviceId: String): Result<Unit> = try {
        tokensCollection.document("${userId}_$deviceId").delete()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to delete FCM token: ${e.message}", e))
    }

    override suspend fun saveNotification(notification: SSBMaxNotification): Result<Unit> = try {
        notificationsCollection.document(notification.id).set(notification.toDto())
        cache.insert(notification)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to save notification: ${e.message}", e))
    }

    override fun getNotifications(userId: String): Flow<List<SSBMaxNotification>> =
        cache.getNotifications(userId)

    override fun getUnreadCount(userId: String): Flow<Int> =
        cache.getUnreadCount(userId)

    override suspend fun markAsRead(notificationId: String): Result<Unit> = try {
        notificationsCollection.document(notificationId).update(FIELD_IS_READ to true)
        cache.markAsRead(notificationId)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to mark notification as read: ${e.message}", e))
    }

    override suspend fun markAllAsRead(userId: String): Result<Unit> = try {
        val batch = Firebase.firestore.batch()
        notificationsCollection
            .where { FIELD_USER_ID equalTo userId }
            .where { FIELD_IS_READ equalTo false }
            .get()
            .documents
            .forEach { doc -> batch.update(doc.reference, FIELD_IS_READ to true) }
        batch.commit()

        cache.markAllAsRead(userId)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to mark all notifications as read: ${e.message}", e))
    }

    override suspend fun deleteNotification(notificationId: String): Result<Unit> = try {
        notificationsCollection.document(notificationId).delete()
        cache.delete(notificationId)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to delete notification: ${e.message}", e))
    }

    override suspend fun getPreferences(userId: String): Result<NotificationPreferences> = try {
        val doc = preferencesCollection.document(userId).get()
        val prefs = if (doc.exists) {
            doc.data(NotificationPreferencesDto.serializer()).toDomain()
        } else {
            NotificationPreferences(userId = userId)
        }
        Result.success(prefs)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to get notification preferences: ${e.message}", e))
    }

    override suspend fun savePreferences(preferences: NotificationPreferences): Result<Unit> = try {
        preferencesCollection.document(preferences.userId).set(preferences.toDto())
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(Exception("Failed to save notification preferences: ${e.message}", e))
    }

    private companion object {
        // Phase 7c (KMP-convergence plan): must match firestore.rules exactly -- the previous
        // snake_case names fell through to the rules file's default-deny catch-all, so every
        // save/read/delete here was silently PERMISSION_DENIED on this platform too.
        const val FIELD_IS_READ = "isRead"
        const val FIELD_USER_ID = "userId"
    }
}

private fun FCMToken.toDto() = FCMTokenDto(
    userId = userId,
    token = token,
    deviceId = deviceId,
    platform = platform,
    createdAt = createdAt,
    updatedAt = updatedAt
)

private fun FCMTokenDto.toDomain() = FCMToken(
    userId = userId,
    token = token,
    deviceId = deviceId,
    platform = platform,
    createdAt = createdAt,
    updatedAt = updatedAt
)

private fun SSBMaxNotification.toDto() = SSBMaxNotificationDto(
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

private fun NotificationPreferences.toDto() = NotificationPreferencesDto(
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

private fun NotificationPreferencesDto.toDomain() = NotificationPreferences(
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
