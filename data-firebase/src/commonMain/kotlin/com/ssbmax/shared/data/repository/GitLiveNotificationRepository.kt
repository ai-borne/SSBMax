package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.FCMToken
import com.ssbmax.shared.domain.model.NotificationPreferences
import com.ssbmax.shared.domain.model.SSBMaxNotification
import com.ssbmax.shared.domain.repository.NotificationRepository
import com.ssbmax.shared.contracts.SsbContracts
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * GitLive-Firebase-backed port of the Android `NotificationRepositoryImpl`.
 * Same three Firestore collections (fcmTokens, notifications,
 * notificationPreferences -- both non-"notifications" names camelCase per
 * firestore.rules, fixed from a snake_case mismatch in Phase 7c) plus the
 * local Room->SQLDelight cache
 * ([GitLiveNotificationCacheManager]) for [getNotifications]/[getUnreadCount]
 * -- still cache-read, matching the Android original, but as of Phase 4 (Centralized
 * Result-Announcement Notifications plan) the cache itself is kept in sync from the
 * `NOTIFICATIONS` Firestore collection directly (see [ensureFirestoreSyncStarted]), not solely
 * from `saveNotification` calls triggered by push receipt.
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

    // Phase 4 (Centralized Result-Announcement Notifications plan): getNotifications/getUnreadCount
    // below only ever read the local SQLDelight cache, and the ONLY writer into that cache was
    // saveNotification() -- called solely from Android's FCM onMessageReceived (Phase 3). iOS's
    // AppDelegate has no equivalent write at all, so its inbox was permanently empty, and even
    // Android's inbox depended on a push actually being delivered (not guaranteed -- permissions,
    // backgrounding, app not running). This listener mirrors the NOTIFICATIONS collection into the
    // cache directly, independent of push delivery, on both platforms (this class is commonMain).
    // No app-wide CoroutineScope singleton exists in this module's Koin graph (same gap
    // GitLiveAuthRepository's class doc names), so this repository owns its own background scope,
    // matching that precedent.
    private val repositoryScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val syncedUserIdsMutex = Mutex()
    private val syncedUserIds = mutableSetOf<String>()

    private fun ensureFirestoreSyncStarted(userId: String) {
        repositoryScope.launch {
            syncedUserIdsMutex.withLock {
                if (!syncedUserIds.add(userId)) return@withLock
                notificationsCollection
                    .where { FIELD_USER_ID equalTo userId }
                    .snapshots
                    .onEach { snapshot ->
                        snapshot.documents.forEach { doc ->
                            runCatching { doc.data(SSBMaxNotificationDto.serializer()) }
                                .getOrNull()
                                ?.let { cache.insert(it.toDomain()) }
                        }
                    }
                    .launchIn(repositoryScope)
            }
        }
    }

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

    override fun getNotifications(userId: String): Flow<List<SSBMaxNotification>> {
        ensureFirestoreSyncStarted(userId)
        return cache.getNotifications(userId)
    }

    override fun getUnreadCount(userId: String): Flow<Int> {
        ensureFirestoreSyncStarted(userId)
        return cache.getUnreadCount(userId)
    }

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
