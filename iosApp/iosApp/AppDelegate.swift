import UIKit
import UserNotifications
import SharedKit
import FirebaseCore
import FirebaseMessaging
import GoogleSignIn

/// Real app-launch lifecycle hook (Phase 6 of the KMP migration plan).
///
/// Wires two things that need to happen before/at launch, neither of which
/// can live in `MainViewController.kt`'s `ComposeUIViewController { ... }`
/// body (that only runs once Compose renders its first frame, which is too
/// late for both of these):
///
/// 1. `BGTaskScheduler` registration (plan item 3) -- Apple requires
///    `register(forTaskWithIdentifier:using:launchHandler:)` to be called
///    before `application(_:didFinishLaunchingWithOptions:)` returns.
/// 2. APNs registration + `UNUserNotificationCenterDelegate` (plan item 4).
///
/// The task identifiers registered here (via `registerAndScheduleBackgroundTasksKt`,
/// the Swift-visible name Kotlin/Native generates for `registerAndScheduleBackgroundTasks()`
/// in `BackgroundTaskRegistrar.kt`) MUST match `Info.plist`'s
/// `BGTaskSchedulerPermittedIdentifiers` array below -- both are wired
/// together in this same change.
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Native Firebase iOS SDK bootstrap -- GitLive's Kotlin Firebase SDK is a thin
        // wrapper over this, not a replacement for it. Must run before ensureKoinStarted(),
        // since Koin's DI graph constructs GitLiveAuthRepository/GitLiveUserRepository
        // (Firebase.auth / Firebase.firestore access) as part of module resolution.
        // Discovered via a real launch crash ("The default FirebaseApp instance must be
        // configured before the default Auth instance can be initialized") -- this call
        // never existed anywhere in this codebase before now, Swift or Kotlin.
        FirebaseApp.configure()

        // Phase 2 (Centralized Result-Announcement Notifications plan): must be set
        // before registerForRemoteNotifications() below so Messaging can exchange
        // the APNs device token for a real FCM registration token once it arrives
        // (see didRegisterForRemoteNotificationsWithDeviceToken and
        // messaging(_:didReceiveRegistrationToken:) further down).
        Messaging.messaging().delegate = self

        // GIDSignIn needs its own client ID (Google's OAuth client, distinct
        // from Firebase's own config) before RealIosGoogleSignInLauncher's
        // first signIn(withPresenting:) call -- read from the same
        // GoogleService-Info.plist FirebaseApp.configure() just loaded,
        // rather than hardcoding it a second time here.
        if let clientID = FirebaseApp.app()?.options.clientID {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        } else {
            NSLog("SSBMax: FirebaseApp.options.clientID missing -- Google Sign-In will fail to configure")
        }

        // Starts Koin + registers both BGTaskScheduler identifiers + submits
        // their first requests. See BackgroundTaskRegistrar.kt's class doc
        // for what the launch handlers do (and, just as importantly, don't
        // do yet).
        //
        // The two observability implementations are passed in from Swift
        // because Swift owns the Firebase SPM dependency they wrap -- see
        // FirebaseObservability.swift and IosObservabilityModule.kt. Kotlin
        // has loud no-op defaults, but Kotlin/Native does not export default
        // arguments to Swift, so this call site must supply both, which is
        // what keeps the real ones from being silently forgotten. Runs after
        // FirebaseApp.configure() above, since Crashlytics/Analytics both
        // need the default FirebaseApp.
        AppBootstrapKt.ensureKoinStarted(
            crashReporter: FirebaseCrashReporter(),
            analyticsTracker: FirebaseAnalyticsTracker()
        )
        BackgroundTaskRegistrarKt.registerAndScheduleBackgroundTasks()

        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            guard granted else { return }
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }

        return true
    }

    /// Routes the OAuth redirect (`com.googleusercontent.apps.<id>://` --
    /// see Info.plist's `CFBundleURLTypes`) back into `GIDSignIn`, which
    /// resolves the completion handler passed to
    /// `GIDSignIn.sharedInstance.signIn(withPresenting:)` in
    /// `RealIosGoogleSignInLauncher.swift`.
    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    /// APNs device token arrived. Phase 2: this is no longer handed to `shared`
    /// directly -- it's handed to `Messaging`, which exchanges it (plus the
    /// APNs auth key configured in Firebase Console) for a real FCM
    /// registration token, delivered via `messaging(_:didReceiveRegistrationToken:)`
    /// below. That FCM token, not this raw APNs one, is what actually gets
    /// saved and what the server's `admin.messaging().sendEachForMulticast()`
    /// can target (see `IosPushNotificationBridge.kt`'s class doc).
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Messaging.messaging().apnsToken = deviceToken
    }

    // MARK: - MessagingDelegate

    /// Fires once Messaging has exchanged the APNs device token for an FCM
    /// registration token (at launch if a token already exists, and again
    /// whenever it rotates). No-ops in `shared` if no user is signed in yet --
    /// see `onFcmTokenReceived`'s doc.
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        IosPushNotificationBridgeKt.onFcmTokenReceived(token: fcmToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // No ErrorLogger equivalent wired into iosMain yet (Android-only
        // today) -- NSLog is this codebase's iOS-side floor until a KMP
        // logging shim exists. Not silently swallowed.
        NSLog("SSBMax: APNs registration failed: \(error.localizedDescription)")
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Show the notification banner even while the app is in the
    /// foreground (default UIKit behavior suppresses it otherwise).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    /// User tapped a notification (background or terminated-state launch).
    /// Hands the payload's `deepLink` string off to `shared`'s
    /// `DeepLinkGateway` (KMP-convergence Phase 4) -- iOS's total prior gap,
    /// closed the same way Android's `MainActivity` feeds the same gateway.
    /// Delivery covers both cold start and background: `UNUserNotificationCenter`
    /// defers calling this until the delegate below is set, which
    /// `application(_:didFinishLaunchingWithOptions:)` does synchronously
    /// before returning, so a terminated-state tap still reaches here.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let deepLink = response.notification.request.content.userInfo["deepLink"] as? String
        IosDeepLinkBridgeKt.onDeepLinkNotificationReceived(rawDeepLink: deepLink)
        completionHandler()
    }
}
