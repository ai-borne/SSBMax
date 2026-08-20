package com.ssbmax.shared.platform.notifications

import com.ssbmax.navigation.DeepLinkGateway
import com.ssbmax.shared.platform.ensureKoinStarted
import com.ssbmax.shared.platform.sharedKoin

/**
 * Swift-callable bridge for notification-tap deep links (KMP-convergence
 * Phase 4). Closes iOS's total prior gap: `AppDelegate.swift`'s
 * `userNotificationCenter(_:didReceive:)` was an explicit no-op before this
 * -- see that method's own doc comment.
 *
 * Same shape as [onFcmTokenReceived] in this package: `ensureKoinStarted()`
 * is a guarded no-op here too (`AppDelegate` already starts Koin in
 * `didFinishLaunchingWithOptions`, before `UNUserNotificationCenter`'s
 * delegate can fire), kept defensive for the same reason.
 *
 * [rawDeepLink] is read from the notification's `userInfo["deepLink"]` --
 * the same key Android's `SSBMaxFirebaseMessagingService`/`NotificationHelper`
 * put into their `PendingIntent`'s extras -- so the two platforms agree on
 * one payload contract even though no server-side push to iOS exists yet
 * (tracked separately, see the plan's Phase 7c).
 */
fun onDeepLinkNotificationReceived(rawDeepLink: String?) {
    ensureKoinStarted()
    sharedKoin().get<DeepLinkGateway>().submit(rawDeepLink)
}
