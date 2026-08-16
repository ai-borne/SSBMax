package com.ssbmax.shared.platform.notifications

import com.ssbmax.shared.domain.model.FCMToken
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.repository.NotificationRepository
import com.ssbmax.shared.platform.ensureKoinStarted
import com.ssbmax.shared.platform.sharedKoin
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import platform.UIKit.UIDevice

/**
 * Swift-callable bridge for the FCM token hand-off (Phase 2 of the
 * Centralized Result-Announcement Notifications plan, superseding the
 * Phase 6 KMP-migration-plan APNs-only version of this file).
 *
 * `iosApp/iosApp/AppDelegate.swift` owns `UIApplication.registerForRemoteNotifications()`,
 * `Messaging.messaging().delegate`, and `UNUserNotificationCenterDelegate` --
 * not portable to `commonMain`/`iosMain` since they're pure UIKit/Firebase
 * Swift APIs with no Kotlin/Native cinterop coverage worth the ceremony for a
 * few call sites. This file only bridges the *result* (a real FCM
 * registration token, exchanged by `Messaging` from the raw APNs device
 * token -- see `AppDelegate.swift`'s `messaging(_:didReceiveRegistrationToken:)`)
 * into the same repository/collection Android's FCM path uses.
 *
 * Android's `SSBMaxFirebaseMessagingService.onNewToken` already calls
 * `NotificationRepository.saveFCMToken` for real -- this bridge writes into
 * the same repository/collection, not a first-of-its-kind path.
 *
 * **Superseded note, kept for history:** earlier (Phase 6 KMP-migration-plan)
 * this file saved the *raw APNs device token* because GitLive's Firebase
 * Kotlin SDK has no Messaging module and no `FirebaseMessaging` SPM product
 * was linked into the iOS app. Phase 2 added `FirebaseMessaging` as a Swift
 * SPM dependency of `iosApp` (Xcode-project-only, not reachable from
 * Gradle/Kotlin -- same category of change as the Crashlytics/Analytics SPM
 * additions), so `Messaging` now performs the real APNs->FCM token exchange
 * in Swift and this bridge saves that FCM token, not a raw APNs one. The
 * server's `admin.messaging().sendEachForMulticast()`
 * (`functions/src/notifications/sendNotification.js`) can now target
 * `platform == "ios"` rows the same way it targets Android/web -- no
 * separate APNs HTTP/2 client needed.
 */
private val bridgeScope = CoroutineScope(Dispatchers.Main)

/**
 * Called from `AppDelegate.messaging(_:didReceiveRegistrationToken:)` once a
 * real FCM registration token is available. No-ops (does not throw) if no
 * user is signed in yet -- `Messaging` re-delivers this callback on every
 * launch and whenever the token rotates, so the token is captured again once
 * the user signs in.
 */
@OptIn(ExperimentalForeignApi::class)
fun onFcmTokenReceived(token: String) {
    ensureKoinStarted()
    val koin = sharedKoin()
    val userId = koin.get<AuthRepository>().currentUser.value?.id ?: return
    val notificationRepository = koin.get<NotificationRepository>()
    val deviceId = UIDevice.currentDevice.identifierForVendor?.UUIDString ?: token.take(DEVICE_ID_FALLBACK_LENGTH)

    bridgeScope.launch {
        notificationRepository.saveFCMToken(
            FCMToken(
                userId = userId,
                token = token,
                deviceId = deviceId,
                platform = PLATFORM_IOS
            )
        )
    }
}

private const val PLATFORM_IOS = "ios"

// Only used if identifierForVendor is unavailable (rare -- e.g. right after
// a fresh install before the OS assigns one); keeps deviceId non-blank
// rather than failing the save.
private const val DEVICE_ID_FALLBACK_LENGTH = 16
