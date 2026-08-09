package com.ssbmax.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.ssbmax.MainActivity
import com.ssbmax.R
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.utils.ErrorLogger

/** Builds Android notifications for GTO analysis results. */
class GtoNotificationHelper(
    private val context: Context
) {
    fun showAnalysisComplete(
        submissionId: String,
        testName: String,
        testType: GTOTestType
    ) {
        try {
            val deepLink = when (testType) {
                GTOTestType.GROUP_DISCUSSION -> "ssbmax://test/gto/gd/result/$submissionId"
                GTOTestType.LECTURETTE -> "ssbmax://test/gto/lecturette/result/$submissionId"
                GTOTestType.GROUP_PLANNING_EXERCISE -> "ssbmax://test/gto/gpe/result/$submissionId"
                GTOTestType.PROGRESSIVE_GROUP_TASK,
                GTOTestType.HALF_GROUP_TASK,
                GTOTestType.GROUP_OBSTACLE_RACE,
                GTOTestType.INDIVIDUAL_OBSTACLES,
                GTOTestType.COMMAND_TASK -> "ssbmax://submission/$submissionId"
            }
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("deepLink", deepLink)
                putExtra("submissionId", submissionId)
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                submissionId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(context.getString(R.string.notification_gto_results_title, testName))
                .setContentText(context.getString(R.string.notification_gto_results_body))
                .setStyle(NotificationCompat.BigTextStyle().bigText(
                    context.getString(R.string.notification_gto_results_big_text, testName)
                ))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setVibrate(longArrayOf(0, 250, 250, 250))
                .build()
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager == null) {
                ErrorLogger.log(
                    IllegalStateException("NotificationManager is null"),
                    "Failed to get NotificationManager service"
                )
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !manager.areNotificationsEnabled()) {
                return
            }
            manager.notify(NOTIFICATION_ID + submissionId.hashCode(), notification)
        } catch (e: Exception) {
            ErrorLogger.log(e, "Failed to show GTO analysis complete notification")
        }
    }

    private companion object {
        const val CHANNEL_ID = "gto_results"
        const val NOTIFICATION_ID = 2001
    }
}
