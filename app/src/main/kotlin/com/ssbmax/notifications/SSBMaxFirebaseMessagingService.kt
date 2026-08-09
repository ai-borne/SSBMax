package com.ssbmax.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.ssbmax.MainActivity
import com.ssbmax.shared.domain.model.FCMToken
import com.ssbmax.shared.domain.model.NotificationType
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.repository.NotificationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import kotlin.random.Random

/**
 * Firebase Cloud Messaging Service for SSBMax
 * Handles incoming push notifications from Firebase
 */
class SSBMaxFirebaseMessagingService : FirebaseMessagingService(), KoinComponent {

    private val authRepository: AuthRepository by inject()
    private val notificationRepository: NotificationRepository by inject()
    private val serviceScope = CoroutineScope(Dispatchers.IO)

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
     * Parse and display notification based on type
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        
        android.util.Log.d(TAG, "FCM message received")
        
        // Check if message contains data payload
        if (message.data.isNotEmpty()) {
            android.util.Log.d(TAG, "FCM data payload received")
            handleDataPayload(message.data)
        }
        
        // Check if message contains notification payload
        message.notification?.let {
            android.util.Log.d(TAG, "FCM notification payload received")
            handleNotificationPayload(it.title, it.body, message.data)
        }
    }
    
    /**
     * Handle data payload from FCM
     */
    private fun handleDataPayload(data: Map<String, String>) {
        val type = data["type"]?.let { 
            try { NotificationType.valueOf(it) } 
            catch (e: Exception) { null }
        } ?: NotificationType.GENERAL_ANNOUNCEMENT
        
        val title = data["title"] ?: getString(com.ssbmax.R.string.notification_default_title)
        val message = data["message"] ?: ""
        val actionUrl = data["actionUrl"]
        val notificationId = data["notificationId"]
        
        android.util.Log.i(TAG, "Handling FCM data payload")
        
        // Show notification
        showNotification(
            type = type,
            title = title,
            message = message,
            actionUrl = actionUrl,
            notificationId = notificationId
        )
        
        // TODO: Save notification to local database via NotificationRepository
        // This allows:
        //  - Showing notification history in NotificationCenterScreen
        //  - Marking notifications as read/unread
        //  - Tracking notification engagement analytics
        //  - Providing offline access to notifications
    }
    
    /**
     * Handle notification payload from FCM
     */
    private fun handleNotificationPayload(
        title: String?,
        body: String?,
        data: Map<String, String>
    ) {
        val type = data["type"]?.let {
            try { NotificationType.valueOf(it) }
            catch (e: Exception) { null }
        } ?: NotificationType.GENERAL_ANNOUNCEMENT
        
        showNotification(
            type = type,
            title = title ?: getString(com.ssbmax.R.string.notification_default_title),
            message = body ?: "",
            actionUrl = data["actionUrl"],
            notificationId = data["notificationId"]
        )
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
        
        // Create intent for notification tap
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
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
            .setSmallIcon(getIconForType(type))
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
                    getString(com.ssbmax.R.string.notification_action_view_results),
                    pendingIntent
                )
            }
            NotificationType.BATCH_INVITATION -> {
                notificationBuilder.addAction(
                    android.R.drawable.ic_menu_view,
                    getString(com.ssbmax.R.string.notification_action_view_invitation),
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
                description = getString(com.ssbmax.R.string.notification_channel_description, channelName)
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
            NotificationType.GRADING_COMPLETE -> getString(com.ssbmax.R.string.notification_channel_grading)
            NotificationType.FEEDBACK_AVAILABLE -> getString(com.ssbmax.R.string.notification_channel_feedback)
            NotificationType.BATCH_INVITATION -> getString(com.ssbmax.R.string.notification_channel_batch)
            NotificationType.GENERAL_ANNOUNCEMENT -> getString(com.ssbmax.R.string.notification_channel_general)
            NotificationType.STUDY_REMINDER -> getString(com.ssbmax.R.string.notification_channel_study_reminders)
            NotificationType.TEST_REMINDER -> getString(com.ssbmax.R.string.notification_channel_test_reminders)
            NotificationType.MARKETPLACE_UPDATE -> getString(com.ssbmax.R.string.notification_channel_marketplace)
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
     * Get icon based on notification type
     */
    private fun getIconForType(type: NotificationType): Int {
        // TODO: Add specific icons for each type
        return android.R.drawable.ic_dialog_info
    }
    
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

