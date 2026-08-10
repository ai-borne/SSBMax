package com.ssbmax.workers

import androidx.work.ListenableWorker
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger
import com.ssbmax.shared.domain.util.DomainLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

private const val TAG = "WorkManagerSubmissionAnalysisTrigger"

/**
 * Real Android binding for [SubmissionAnalysisTrigger], overriding
 * `shared`'s own default binding (`com.ssbmax.shared.analysis.KtorSubmissionAnalysisTrigger`,
 * the real iOS-side implementation) on this platform
 * (see that interface's doc for why the override lives here rather than as
 * an `expect`/`actual` pair: `shared` cannot depend on `app`'s concrete
 * `CoroutineWorker` classes, so the real implementation can only live where
 * they do). Bound in [com.ssbmax.di.workManagerModule], which loads after
 * `sharedModule` in `appModules` -- Koin's default `allowOverride` lets this
 * binding win, the same pattern already used for `TestUsageRecorder`/
 * `TestSessionRepository` in `core:data`'s `repositoryModule`.
 *
 * iOS never loads `app`'s Koin modules, so it keeps the logging no-op
 * automatically -- no `expect`/`actual` needed.
 *
 * OIR and PIQ have no async-analysis worker (confirmed: neither test type's
 * ViewModel calls [SubmissionAnalysisTrigger.trigger] at all -- grep-verified
 * across `shared/commonMain/presentation`), so they fall through to the same
 * "not scheduled" log line the pure-logging binding used everywhere.
 *
 * TAT is the one branch that can't just build a single `WorkRequest`
 * synchronously: [TATAnalysisPipelineOrchestrator.startPipeline] needs the
 * submission's stories + questions in memory, but `trigger()` only receives
 * a `submissionId`. Fetched here via the already-injected
 * [SubmissionRepository]/[TestContentRepository] and launched on [scope]
 * (the same app-wide `SupervisorJob` scope `core:data`'s repositories share
 * -- see `CoroutineScopeModule`'s doc) rather than blocking this
 * non-suspend interface method.
 *
 * GTO (GD/Lecturette/GPE) needs no `TestType` -> `GTOTestType` mapping:
 * [GTOAnalysisWorker] fetches its own submission via `GTORepository.
 * getSubmission`, which already carries the real `GTOSubmission.testType` --
 * confirmed by reading both the worker and its only caller when this was
 * written (`GTOTestSubmissionHelper`, formerly `app/ui/tests/gto/common/`,
 * deleted in KMP-convergence Phase 6a along with the rest of `app/ui`; it
 * only ever passed `KEY_SUBMISSION_ID`, so nothing here depended on it).
 */
class WorkManagerSubmissionAnalysisTrigger(
    private val workManager: WorkManager,
    private val submissionRepository: SubmissionRepository,
    private val testContentRepository: TestContentRepository,
    private val tatPipelineOrchestrator: TATAnalysisPipelineOrchestrator,
    private val logger: DomainLogger,
    private val scope: CoroutineScope
) : SubmissionAnalysisTrigger {

    override fun trigger(testType: TestType, submissionId: String) {
        when (testType) {
            TestType.PPDT -> enqueue<PPDTAnalysisWorker>(PPDTAnalysisWorker.KEY_SUBMISSION_ID, submissionId)
            TestType.WAT -> enqueue<WATAnalysisWorker>(WATAnalysisWorker.KEY_SUBMISSION_ID, submissionId)
            TestType.SRT -> enqueue<SRTAnalysisWorker>(SRTAnalysisWorker.KEY_SUBMISSION_ID, submissionId)
            TestType.SD -> enqueue<SDTAnalysisWorker>(SDTAnalysisWorker.KEY_SUBMISSION_ID, submissionId)
            TestType.GTO_GD, TestType.GTO_LECTURETTE, TestType.GTO_GPE ->
                enqueue<GTOAnalysisWorker>(GTOAnalysisWorker.KEY_SUBMISSION_ID, submissionId)
            TestType.IO -> enqueue<InterviewAnalysisWorker>(InterviewAnalysisWorker.KEY_SESSION_ID, submissionId)
            TestType.TAT -> scope.launch { triggerTat(submissionId) }
            else -> logger.w(
                TAG,
                "No real analysis scheduler bound for $testType submission $submissionId " +
                    "-- it will remain PENDING_ANALYSIS until a platform-specific trigger is wired in."
            )
        }
    }

    private inline fun <reified W : ListenableWorker> enqueue(key: String, submissionId: String) {
        val request = OneTimeWorkRequestBuilder<W>()
            .setInputData(workDataOf(key to submissionId))
            .build()
        workManager.enqueue(request)
    }

    private suspend fun triggerTat(submissionId: String) {
        val submission = submissionRepository.getTATSubmission(submissionId).getOrNull()
        if (submission == null) {
            logger.e(TAG, "TAT submission not found for analysis trigger: $submissionId")
            return
        }
        // Prefer the exact questions the user saw, persisted on the submission (TAT_Impr_3).
        // Only fall back to a fresh repo fetch for legacy docs written before the `questions`
        // field existed -- getTATQuestions(testId) ignores testId and returns a random 12 that
        // won't match the user's questionIds, which is the root cause of the "0 bytes" bug.
        val questions = submission.questions.ifEmpty {
            testContentRepository.getTATQuestions(submission.testId).getOrNull().orEmpty()
        }
        tatPipelineOrchestrator.startPipeline(submissionId, submission.stories, questions)
            .onFailure { logger.e(TAG, "Failed to start TAT analysis pipeline for $submissionId", it) }
    }
}
