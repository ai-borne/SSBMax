package com.ssbmax.shared.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ssbmax.data.firebase.R
import com.ssbmax.shared.domain.model.FCMToken
import com.ssbmax.shared.domain.model.NotificationType
import com.ssbmax.shared.domain.model.SSBMaxNotification
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.repository.NotificationRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import java.util.UUID
import kotlin.random.Random

/**
 * Firebase Cloud Messaging Service for SSBMax.
 *
 * Lives in `:data-firebase` (not `app`) so the app layer stays free of direct Firebase imports
 * (root CLAUDE.md's "No Firebase imports in app layer" lint rule, except Firebase Auth) --
 * `app`'s `AndroidManifest.xml` registers this class by its fully-qualified name here.
 * Opens the launcher activity generically via `packageManager.getLaunchIntentForPackage`
 * rather than referencing `com.ssbmax.MainActivity` directly, since `app` depends on this
 * module (not the reverse) and a direct reference would be a circular dependency.
 */
class SSBMaxFirebaseMessagingService(
    // Defaulted, not hardcoded inline, so a test can override it -- the Android framework still
    // instantiates this via the no-arg constructor Kotlin generates for an all-defaulted param list.
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : FirebaseMessagingService(), KoinComponent {

    private val authRepository: AuthRepository by inject()
    private val notificationRepository: NotificationRepository by inject()
    private val serviceScope = CoroutineScope(ioDispatcher)

    /**
     * Called when a new FCM token is generated
     * This happens on first app install and when token is refreshed
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)

        android.util.Log.i(TAG, "New FCM token generated (length: ${token.length})")

        val userId = authRepository.currentUser.value?.id ?: return
        val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
            ?: token.take(DEVICE_ID_FALLBACK_LENGTH)

        serviceScope.launch {
            notificationRepository.saveFCMToken(
                FCMToken(
                    userId = userId,
                    token = token,
                    deviceId = deviceId,
                    platform = "android"
                )
            )
        }
    }

    /**
     * Called when a message is received
     * Parse once (merging the data + notification payloads, which FCM delivers together in
     * foreground), then display the tray notification and persist it to the in-app inbox.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        android.util.Log.d(TAG, "FCM message received")

        val data = message.data
        val type = data["type"]?.let {
            try { NotificationType.valueOf(it) }
            catch (e: Exception) { null }
        } ?: NotificationType.GENERAL_ANNOUNCEMENT
        val title = message.notification?.title ?: data["title"]
            ?: getString(R.string.notification_default_title)
        val body = (message.notification?.body ?: data["message"]).orEmpty()
        val actionUrl = data["actionUrl"]
        val notificationId = data["notificationId"]

        showNotification(
            type = type,
            title = title,
            message = body,
            actionUrl = actionUrl,
            notificationId = notificationId
        )

        val userId = authRepository.currentUser.value?.id ?: return
        val notification = buildInboxNotification(
            userId = userId,
            notificationId = notificationId,
            type = type,
            title = title,
            message = body,
            action = InboxNotificationAction(
                actionUrl = actionUrl,
                submissionId = data["submissionId"],
                testType = data["testType"]
            )
        )
        serviceScope.launch {
            notificationRepository.saveNotification(notification)
        }
    }

    /**
     * Display notification to user
     */
    private fun showNotification(
        type: NotificationType,
        title: String,
        message: String,
        actionUrl: String?,
        notificationId: String?
    ) {
        val channelId = getChannelIdForType(type)
        val channelName = getChannelNameForType(type)
        val importance = getImportanceForType(type)

        // Create notification channel (required for Android O+)
        createNotificationChannel(channelId, channelName, importance)

        // Generic launch intent for notification tap -- see class doc for why this isn't a
        // direct reference to `com.ssbmax.MainActivity`.
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
            actionUrl?.let { putExtra("deepLink", it) }
            notificationId?.let { putExtra("notificationId", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(getIcon())
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        // Add action buttons for specific types
        when (type) {
            NotificationType.GRADING_COMPLETE,
            NotificationType.FEEDBACK_AVAILABLE -> {
                notificationBuilder.addAction(
                    android.R.drawable.ic_menu_view,
                    getString(R.string.notification_action_view_results),
                    pendingIntent
                )
            }
            NotificationType.BATCH_INVITATION -> {
                notificationBuilder.addAction(
                    android.R.drawable.ic_menu_view,
                    getString(R.string.notification_action_view_invitation),
                    pendingIntent
                )
            }
            else -> {
                // No action buttons for other types
            }
        }

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Use notification ID from payload or generate random
        val notifId = notificationId?.hashCode() ?: Random.nextInt()
        notificationManager.notify(notifId, notificationBuilder.build())
    }

    /**
     * Create notification channel for Android O+
     */
    private fun createNotificationChannel(
        channelId: String,
        channelName: String,
        importance: Int
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = getString(R.string.notification_channel_description, channelName)
                enableLights(true)
                enableVibration(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Get channel ID based on notification type
     */
    private fun getChannelIdForType(type: NotificationType): String {
        return when (type) {
            NotificationType.GRADING_COMPLETE -> CHANNEL_GRADING
            NotificationType.FEEDBACK_AVAILABLE -> CHANNEL_FEEDBACK
            NotificationType.BATCH_INVITATION -> CHANNEL_BATCH
            NotificationType.GENERAL_ANNOUNCEMENT -> CHANNEL_GENERAL
            NotificationType.STUDY_REMINDER -> CHANNEL_REMINDERS
            NotificationType.TEST_REMINDER -> CHANNEL_REMINDERS
            NotificationType.MARKETPLACE_UPDATE -> CHANNEL_MARKETPLACE
        }
    }

    /**
     * Get channel name based on notification type
     */
    private fun getChannelNameForType(type: NotificationType): String {
        return when (type) {
            NotificationType.GRADING_COMPLETE -> getString(R.string.notification_channel_grading)
            NotificationType.FEEDBACK_AVAILABLE -> getString(R.string.notification_channel_feedback)
            NotificationType.BATCH_INVITATION -> getString(R.string.notification_channel_batch)
            NotificationType.GENERAL_ANNOUNCEMENT -> getString(R.string.notification_channel_general)
            NotificationType.STUDY_REMINDER -> getString(R.string.notification_channel_study_reminders)
            NotificationType.TEST_REMINDER -> getString(R.string.notification_channel_test_reminders)
            NotificationType.MARKETPLACE_UPDATE -> getString(R.string.notification_channel_marketplace)
        }
    }

    /**
     * Get importance level based on notification type
     */
    private fun getImportanceForType(type: NotificationType): Int {
        return when (type) {
            NotificationType.GRADING_COMPLETE,
            NotificationType.FEEDBACK_AVAILABLE -> NotificationManager.IMPORTANCE_HIGH
            NotificationType.BATCH_INVITATION -> NotificationManager.IMPORTANCE_DEFAULT
            NotificationType.GENERAL_ANNOUNCEMENT -> NotificationManager.IMPORTANCE_DEFAULT
            NotificationType.STUDY_REMINDER,
            NotificationType.TEST_REMINDER -> NotificationManager.IMPORTANCE_DEFAULT
            NotificationType.MARKETPLACE_UPDATE -> NotificationManager.IMPORTANCE_LOW
        }
    }

    /**
     * Icon for the notification tray. Same icon for every [NotificationType] for now -- no
     * per-type icon assets exist yet.
     */
    private fun getIcon(): Int = android.R.drawable.ic_dialog_info

    companion object {
        private const val TAG = "SSBMaxFCM"
        private const val DEVICE_ID_FALLBACK_LENGTH = 16

        // Notification channel IDs
        private const val CHANNEL_GRADING = "grading_channel"
        private const val CHANNEL_FEEDBACK = "feedback_channel"
        private const val CHANNEL_BATCH = "batch_channel"
        private const val CHANNEL_GENERAL = "general_channel"
        private const val CHANNEL_REMINDERS = "reminders_channel"
        private const val CHANNEL_MARKETPLACE = "marketplace_channel"
    }
}

/**
 * Maps an FCM payload to the in-app inbox model. Pure/no Android deps so it's testable without
 * Robolectric. `notificationId` is expected to match the Firestore `NOTIFICATIONS` doc id
 * `sendNotification.js` wrote server-side (`data.notificationId`) so `saveNotification`'s
 * `.document(id).set(...)` overwrites that same doc instead of creating a duplicate; falls back to
 * a locally-generated id only when the payload doesn't carry one.
 */
/** Groups the FCM payload's action fields so [buildInboxNotification] stays under the parameter-count limit. */
data class InboxNotificationAction(
    val actionUrl: String?,
    val submissionId: String?,
    val testType: String?
)

internal fun buildInboxNotification(
    userId: String,
    notificationId: String?,
    type: NotificationType,
    title: String,
    message: String,
    action: InboxNotificationAction
): SSBMaxNotification {
    val actionData = buildMap {
        action.submissionId?.let { put("submissionId", it) }
        action.testType?.let { put("testType", it) }
    }.ifEmpty { null }

    return SSBMaxNotification(
        id = notificationId ?: UUID.randomUUID().toString(),
        userId = userId,
        type = type,
        title = title,
        message = message,
        actionUrl = action.actionUrl,
        actionData = actionData
    )
}
