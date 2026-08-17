package com.ssbmax.shared.platform.worker

import com.ssbmax.shared.platform.ensureKoinStarted
import com.ssbmax.shared.platform.sharedKoin
import kotlinx.cinterop.ExperimentalForeignApi
import platform.BackgroundTasks.BGTask
import platform.BackgroundTasks.BGTaskScheduler

/**
 * Real launch-time `BGTaskScheduler` registration (Phase 6, KMP migration
 * plan item 3: "iOS `BGTaskScheduler` launch-time registration + Info.plist
 * task identifiers"). Must be called from
 * `AppDelegate.application(_:didFinishLaunchingWithOptions:)` before it
 * returns -- `BGTaskScheduler.register(forTaskWithIdentifier:using:launchHandler:)`
 * is documented by Apple to fail/assert if called any later.
 *
 * The identifier below comes from [BGTaskSchedulerBackgroundTaskScheduler]
 * (the value actually submitted via `submitTaskRequest`) and MUST also be
 * declared in `iosApp/iosApp/Info.plist`'s `BGTaskSchedulerPermittedIdentifiers`
 * array -- both sides are wired together in this Phase 6 change.
 *
 * **Launch handler body is a scheduled-completion no-op, not a port of
 * the Android `QuestionCacheCleanupWorker` business logic.** That worker is
 * an Android-only `WorkManager` class living in `app` (which `shared`
 * cannot depend on), and porting its actual cache-cleanup logic to iOS was
 * deliberately deferred pending a product decision on iOS
 * background-execution UX -- see the plan's "Risks a Senior App Developer
 * Should Push Back On" #2, re-confirmed unchanged at Phase 6, not silently
 * resolved here. This registrar closes only the *registration* half of the
 * open item: the task now actually fires (subject to iOS's own best-effort
 * scheduling), reschedules its next occurrence, and completes successfully
 * -- it does no cache work yet.
 *
 * (A second identifier, `ARCHIVAL_TASK_ID`, used to be registered here for
 * submission archival -- removed by the submission-archival server-migration
 * plan in favor of a scheduled Cloud Function; see [BackgroundTaskScheduler]'s
 * class doc.)
 */
/**
 * Swift-callable entry point: `AppDelegate` calls this once, from
 * `application(_:didFinishLaunchingWithOptions:)`. Ensures Koin is started
 * first (registration needs the Koin-provided [BackgroundTaskScheduler]
 * single) then registers the task identifier and submits its first request.
 */
fun registerAndScheduleBackgroundTasks() {
    ensureKoinStarted()
    val scheduler = sharedKoin().get<BackgroundTaskScheduler>()
    registerBackgroundTasks(scheduler)
    scheduler.scheduleQuestionCacheCleanup()
}

@OptIn(ExperimentalForeignApi::class)
private fun registerBackgroundTasks(scheduler: BackgroundTaskScheduler) {
    BGTaskScheduler.sharedScheduler.registerForTaskWithIdentifier(
        BGTaskSchedulerBackgroundTaskScheduler.CLEANUP_TASK_ID,
        usingQueue = null
    ) { task ->
        handleTask(task) { scheduler.scheduleQuestionCacheCleanup() }
    }
}

@OptIn(ExperimentalForeignApi::class)
private fun handleTask(task: BGTask?, rescheduleNext: () -> Unit) {
    // Always schedule the next occurrence before completing -- BGTaskScheduler
    // does not repeat automatically (unlike WorkManager's PeriodicWorkRequest).
    rescheduleNext()
    task?.setTaskCompletedWithSuccess(true)
}
