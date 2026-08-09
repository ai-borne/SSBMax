package com.ssbmax.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.ssbmax.MainActivity
import com.ssbmax.R
import com.ssbmax.navigation.DeepLinkParser
import com.ssbmax.utils.ErrorLogger

/**
 * Helper class for sending local notifications
 *
 * Used by background workers to notify users when async operations complete.
 */
class NotificationHelper(
    private val context: Context
) {
    private val psychologyNotifications = PsychologyNotificationHelper(context)
    private val gtoNotifications = GtoNotificationHelper(context)

    companion object {
        private const val TAG = "NotificationHelper"
        private const val CHANNEL_ID_INTERVIEW = "interview_results"
        private const val CHANNEL_NAME_INTERVIEW = "Interview Results"

        private const val NOTIFICATION_ID_INTERVIEW_RESULT = 1001

    }

    init {
        Log.d(TAG, "📢 NotificationHelper initialized")
        createNotificationChannels()
    }

    /**
     * Create notification channels (required for Android O+)
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val interviewChannel = NotificationChannel(
                CHANNEL_ID_INTERVIEW,
                CHANNEL_NAME_INTERVIEW,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.notification_interview_channel_description)
                enableVibration(true)
                enableLights(true)
            }


            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(interviewChannel)

        }
    }

    /**
     * Show notification when interview results are ready
     *
     * @param sessionId The interview session ID
     * @param resultId The result ID to navigate to
     */
    fun showInterviewResultsReadyNotification(sessionId: String, resultId: String) {
        Log.d(TAG, "Showing interview results notification")

        try {
            // Build deep link using centralized parser
            val deepLink = DeepLinkParser.buildInterviewResultDeepLink(resultId)
            
            // Create intent to open results screen
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("deepLink", deepLink)
                putExtra("sessionId", sessionId)
                putExtra("resultId", resultId)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                sessionId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, CHANNEL_ID_INTERVIEW)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(context.getString(R.string.notification_interview_results_title))
                .setContentText(context.getString(R.string.notification_interview_results_body))
                .setStyle(NotificationCompat.BigTextStyle()
                    .bigText(context.getString(R.string.notification_interview_results_body)))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setVibrate(longArrayOf(0, 250, 250, 250))
                .build()

            val notificationManager = context.getSystemService(NotificationManager::class.java)
            val notificationId = NOTIFICATION_ID_INTERVIEW_RESULT + sessionId.hashCode()

            if (notificationManager == null) {
                ErrorLogger.log(
                    IllegalStateException("NotificationManager is null"),
                    "Failed to get NotificationManager service"
                )
                return
            }

            // Check if notifications are enabled
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                if (!notificationManager.areNotificationsEnabled()) {
                    Log.w(TAG, "⚠️ Notifications are disabled by user")
                }
            }

            notificationManager.notify(notificationId, notification)
            Log.d(TAG, "✅ Notification sent successfully! ID: $notificationId")

        } catch (e: Exception) {
            ErrorLogger.log(e, "Failed to show interview results notification")
        }
    }

    /**
     * Show notification when interview analysis fails
     *
     * @param sessionId The interview session ID
     */
    fun showInterviewAnalysisFailedNotification(sessionId: String) {
        try {
            // Build deep link using centralized parser
            val deepLink = DeepLinkParser.buildInterviewHistoryDeepLink()
            
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("deepLink", deepLink)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                sessionId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, CHANNEL_ID_INTERVIEW)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(context.getString(R.string.notification_interview_failed_title))
                .setContentText(context.getString(R.string.notification_interview_failed_body))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()

            val notificationManager = context.getSystemService(NotificationManager::class.java)
            notificationManager?.notify(
                NOTIFICATION_ID_INTERVIEW_RESULT + sessionId.hashCode(),
                notification
            )
        } catch (e: Exception) {
            ErrorLogger.log(e, "Failed to show interview analysis failed notification")
        }
    }

    /** Show notification when GTO test analysis is complete. */
    fun showGTOAnalysisCompleteNotification(
        submissionId: String,
        testName: String,
        testType: com.ssbmax.shared.domain.model.gto.GTOTestType
    ) = gtoNotifications.showAnalysisComplete(submissionId, testName, testType)

    // ===========================
    // Psychology Test Notifications
    // ===========================

    fun showTATResultsReadyNotification(submissionId: String) =
        psychologyNotifications.showResultsReady(
            submissionId,
            "TAT",
            R.string.notification_tat_complete_title,
            R.string.notification_tat_complete_body
        )

    fun showTATAnalysisFailedNotification(submissionId: String) =
        psychologyNotifications.showAnalysisFailed(
            submissionId,
            "TAT",
            R.string.notification_tat_failed_title,
            R.string.notification_tat_failed_body
        )

    fun showWATResultsReadyNotification(submissionId: String) =
        psychologyNotifications.showResultsReady(
            submissionId,
            "WAT",
            R.string.notification_wat_complete_title,
            R.string.notification_wat_complete_body
        )

    fun showWATAnalysisFailedNotification(submissionId: String) =
        psychologyNotifications.showAnalysisFailed(
            submissionId,
            "WAT",
            R.string.notification_wat_failed_title,
            R.string.notification_wat_failed_body
        )

    fun showSRTResultsReadyNotification(submissionId: String) =
        psychologyNotifications.showResultsReady(
            submissionId,
            "SRT",
            R.string.notification_srt_complete_title,
            R.string.notification_srt_complete_body
        )

    fun showSRTAnalysisFailedNotification(submissionId: String) =
        psychologyNotifications.showAnalysisFailed(
            submissionId,
            "SRT",
            R.string.notification_srt_failed_title,
            R.string.notification_srt_failed_body
        )

    fun showSDTResultsReadyNotification(submissionId: String) =
        psychologyNotifications.showResultsReady(
            submissionId,
            "SDT",
            R.string.notification_sdt_complete_title,
            R.string.notification_sdt_complete_body
        )

    fun showSDTAnalysisFailedNotification(submissionId: String) =
        psychologyNotifications.showAnalysisFailed(
            submissionId,
            "SDT",
            R.string.notification_sdt_failed_title,
            R.string.notification_sdt_failed_body
        )

    fun showPPDTResultsReadyNotification(submissionId: String) =
        psychologyNotifications.showResultsReady(
            submissionId,
            "PPDT",
            R.string.notification_ppdt_complete_title,
            R.string.notification_ppdt_complete_body
        )

    fun showPPDTAnalysisFailedNotification(submissionId: String) =
        psychologyNotifications.showAnalysisFailed(
            submissionId,
            "PPDT",
            R.string.notification_ppdt_failed_title,
            R.string.notification_ppdt_failed_body
        )
}

