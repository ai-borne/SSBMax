package com.ssbmax.shared.platform.worker

import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ListenableWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit
import kotlin.reflect.KClass

/**
 * Android actual, backed by `androidx.work.WorkManager`. Real behavior moved
 * from `SSBMaxApplication.onCreate` (cleanup) — same intervals/constraints,
 * unchanged.
 *
 * Submission archival ([scheduleSubmissionArchival]/`ArchivalWorker`) was removed by the
 * submission-archival server-migration plan -- `archived_submissions` is server-only in
 * `firestore.rules`, so the client write always hit PERMISSION_DENIED on Android and had no
 * execution guarantee at all on iOS's BGTaskScheduler; a `functions/src/archival/
 * archiveOldSubmissions.js` scheduled Cloud Function replaces it entirely, on both platforms.
 * Devices with a pre-existing enqueued `"archival_worker"` unique periodic work will simply see
 * that work item fail once (its `ArchivalWorker` class no longer exists) and then stop being
 * re-enqueued, since nothing calls `scheduleSubmissionArchival()` anymore.
 *
 * The concrete `CoroutineWorker` subclasses (`QuestionCacheCleanupWorker`) stay in `app`
 * (they're Android-only, KoinComponent-based classes with business logic that reaches into
 * `shared` repositories) — `shared` can't depend on `app` in the other direction, so this class
 * is parameterized by [KClass] reference instead of hardcoding them, and `app`'s Koin module
 * supplies the concrete classes when constructing this. Same reason [questionGenerationWorker]
 * (Phase 8) is a second [KClass] param rather than a hardcoded
 * `InterviewQuestionGenerationWorker` reference.
 */
class WorkManagerBackgroundTaskScheduler(
    private val workManager: WorkManager,
    private val cleanupWorker: KClass<out ListenableWorker>,
    private val questionGenerationWorker: KClass<out ListenableWorker>
) : BackgroundTaskScheduler {

    override fun scheduleQuestionCacheCleanup() {
        val request = PeriodicWorkRequest.Builder(
            cleanupWorker.java,
            CLEANUP_INTERVAL_HOURS,
            TimeUnit.HOURS
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .setRequiresBatteryNotLow(true)
                    .build()
            )
            .addTag(CLEANUP_TAG)
            .build()

        workManager.enqueueUniquePeriodicWork(
            CLEANUP_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    override fun scheduleInterviewQuestionGeneration(piqSubmissionId: String) {
        val request = OneTimeWorkRequest.Builder(questionGenerationWorker.java)
            .setInputData(workDataOf(BackgroundTaskScheduler.KEY_PIQ_SUBMISSION_ID to piqSubmissionId))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        workManager.enqueue(request)
    }

    private companion object {
        const val CLEANUP_INTERVAL_HOURS = 24L
        const val CLEANUP_TAG = "question_cache_cleanup"
        // Same literal AppConstants.WorkManager.CLEANUP_WORK_NAME used pre-shim --
        // keeps WorkManager's uniqueWork identity stable across this migration
        // (a changed name would silently duplicate the schedule on existing installs).
        const val CLEANUP_WORK_NAME = "question_cache_cleanup_periodic"
    }
}
