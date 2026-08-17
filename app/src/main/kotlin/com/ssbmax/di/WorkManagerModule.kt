package com.ssbmax.di

import androidx.work.WorkManager
import com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger
import com.ssbmax.shared.platform.worker.BackgroundTaskScheduler
import com.ssbmax.shared.platform.worker.WorkManagerBackgroundTaskScheduler
import com.ssbmax.workers.InterviewQuestionGenerationWorker
import com.ssbmax.workers.QuestionCacheCleanupWorker
import com.ssbmax.workers.WorkManagerSubmissionAnalysisTrigger
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

/**
 * Koin module for providing WorkManager and the shared-module
 * BackgroundTaskScheduler (Phase 4 platform shim). The scheduler is
 * bound here, in `app`, rather than in shared's own platformModule --
 * unlike iOS's BGTaskScheduler actual, the Android actual is generic over
 * which `ListenableWorker` classes to run (`shared` can't depend on
 * `app`'s concrete Worker classes), so `app` supplies them.
 *
 * Also binds the real [SubmissionAnalysisTrigger] (Phase 5 KMP migration,
 * "Phase D" of the close-out plan) -- this module loads after `sharedModule`
 * in `appModules` (see `KoinModules.kt`), so Koin's default `allowOverride`
 * lets [WorkManagerSubmissionAnalysisTrigger] win over `sharedModule`'s own
 * `KtorSubmissionAnalysisTrigger` default, same override pattern as
 * `TestUsageRecorder`/`TestSessionRepository` in `core:data`'s
 * `repositoryModule`.
 */
val workManagerModule = module {
    single { WorkManager.getInstance(androidContext()) }
    single<BackgroundTaskScheduler> {
        WorkManagerBackgroundTaskScheduler(
            workManager = get(),
            cleanupWorker = QuestionCacheCleanupWorker::class,
            questionGenerationWorker = InterviewQuestionGenerationWorker::class
        )
    }
    single<SubmissionAnalysisTrigger> {
        WorkManagerSubmissionAnalysisTrigger(
            workManager = get(),
            submissionRepository = get(),
            testContentRepository = get(),
            tatPipelineOrchestrator = get(),
            logger = get(),
            scope = get()
        )
    }
}
