package com.ssbmax.notifications

import android.app.PendingIntent
import android.content.Context
import android.content.Intent

import androidx.core.app.NotificationCompat
import com.ssbmax.MainActivity
import com.ssbmax.R
import com.ssbmax.utils.ErrorLogger

/** Builds result notifications for psychology test analysis. */
class PsychologyNotificationHelper(
    private val context: Context
) {
    fun showResultsReady(submissionId: String, testType: String, titleResId: Int, bodyResId: Int) {
        try {
            val intent = resultIntent("ssbmax://test/${testType.lowercase()}/result/$submissionId")
            val notification = NotificationCompat.Builder(context, CHANNEL_ID_RESULTS)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(context.getString(titleResId))
                .setContentText(context.getString(bodyResId))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent(submissionId, intent))
                .build()
            context.getSystemService(android.app.NotificationManager::class.java)
                ?.notify(submissionId.hashCode(), notification)
        } catch (e: Exception) {
            ErrorLogger.log(e, "Failed to show $testType result notification")
        }
    }

    fun showAnalysisFailed(submissionId: String, testType: String, titleResId: Int, bodyResId: Int) {
        try {
            val intent = resultIntent("ssbmax://tests/psychology")
            val notification = NotificationCompat.Builder(context, CHANNEL_ID_RESULTS)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(context.getString(titleResId))
                .setContentText(context.getString(bodyResId))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent(submissionId, intent))
                .build()
            context.getSystemService(android.app.NotificationManager::class.java)
                ?.notify(submissionId.hashCode(), notification)
        } catch (e: Exception) {
            ErrorLogger.log(e, "Failed to show $testType failed notification")
        }
    }

    private fun resultIntent(deepLink: String) =
        Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deepLink", deepLink)
        }

    private fun pendingIntent(submissionId: String, intent: Intent) = PendingIntent.getActivity(
        context,
        submissionId.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    private companion object {
        const val CHANNEL_ID_RESULTS = "interview_results"
    }
}
