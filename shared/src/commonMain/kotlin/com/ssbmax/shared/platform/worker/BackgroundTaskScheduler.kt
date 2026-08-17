package com.ssbmax.shared.platform.worker

/**
 * Schedules the app's periodic background jobs (previously scheduled
 * directly from `SSBMaxApplication.onCreate` via `androidx.work.WorkManager`).
 * Submission archival used to be a second periodic job here
 * ([scheduleSubmissionArchival]) -- removed by the submission-archival
 * server-migration plan in favor of a scheduled Cloud Function
 * (`functions/src/archival/archiveOldSubmissions.js`), since the client write
 * it depended on was server-only in `firestore.rules` and always failed.
 *
 * IMPORTANT — read before assuming iOS parity: Android's actual
 * ([WorkManager]-backed, in `shared/androidMain`) gives WorkManager's usual
 * execution guarantees. iOS's actual (`BGTaskScheduler`-backed, in
 * `shared/iosMain`) does **not** — the OS may defer or skip a background
 * task entirely depending on battery, usage patterns, and system load, with
 * no guaranteed execution window. This interface intentionally does NOT try
 * to paper over that difference with a fake "guaranteed" contract; callers
 * that need a stronger guarantee (e.g. a UX depending on a job actually
 * having run) must not assume it did.
 *
 * Per the KMP migration plan's own caution (Phase 4 scope, "Risks a Senior
 * App Developer Should Push Back On" #2): the TAT/PPDT async AI-analysis
 * flow (grading a just-submitted test) is a *separate*, more UX-sensitive
 * background-execution concern that is explicitly OUT of this shim's scope
 * -- that flow goes through [com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger]
 * instead, unchanged by this interface. [scheduleInterviewQuestionGeneration]
 * (Phase 8, KMP-convergence plan) is a lower-stakes, best-effort cache-warm
 * -- closer in spirit to the two periodic jobs below than to real-time
 * grading -- so it belongs here, not on that seam.
 */
interface BackgroundTaskScheduler {
    /**
     * Daily cleanup of expired cached questions (PIQ-based questions older
     * than the app's cache-retention window). Requires network + not-low
     * battery on Android; best-effort on iOS (see class doc).
     */
    fun scheduleQuestionCacheCleanup()

    /**
     * Pre-generates Interview-module questions from a just-submitted PIQ, so the
     * candidate's interview can start instantly instead of waiting on a Gemini
     * call at start time. One-off, not periodic -- Android runs it as a real
     * `WorkManager` one-time job (survives process death); iOS dispatches it
     * immediately in-process rather than deferring to `BGTaskScheduler` (same
     * reasoning as [com.ssbmax.shared.analysis.KtorSubmissionAnalysisTrigger]: no
     * execution-time guarantee makes an immediate run strictly more reliable for
     * something the candidate wants ready soon).
     */
    fun scheduleInterviewQuestionGeneration(piqSubmissionId: String)

    companion object {
        /**
         * `WorkManager` input-data key for [scheduleInterviewQuestionGeneration]'s Android
         * `WorkRequest` -- shared so `app`'s worker (which reads it) and this interface's
         * Android actual (which writes it) can't drift apart on the literal.
         */
        const val KEY_PIQ_SUBMISSION_ID = "piq_submission_id"
    }
}
