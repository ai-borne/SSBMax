package com.ssbmax.shared.presentation.gto.common

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.repository.GTORepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger
import com.ssbmax.shared.domain.util.DomainLogger

/**
 * KMP port of the common tail of `app/.../ui/tests/gto/common/GTOTestSubmissionHelper.kt`:
 * once a test-type-specific `SubmissionRepository.submitXxx(...)` call
 * succeeds, every GTO test type does the exact same three things --
 * [TestUsageRecorder.recordTestUsage] (subscription-limit bookkeeping, via the
 * server-side `recordTestUsage` callable -- same path every other test type
 * uses, since Phase 5 (docs/plans/CrossPlatform_SSOT) retired GTO's own
 * bespoke, non-atomic `GTORepository.recordTestUsage` counter),
 * [GTORepository.updateProgress] (sequential-access unlock for the next
 * test), and fire [SubmissionAnalysisTrigger] (see that interface's own doc
 * comment for why this is a logged no-op today, not a real
 * `WorkManager`/`GTOAnalysisWorker` enqueue -- `shared` cannot depend on
 * `app`'s worker classes).
 *
 * Shared by GD and Lecturette (and future GPE/PGT/etc.) rather than
 * duplicated per-vertical, since the per-type submit call itself is the only
 * part that actually differs.
 */
class GTOSubmissionCoordinator(
    private val gtoRepository: GTORepository,
    private val usageRecorder: TestUsageRecorder,
    private val analysisTrigger: SubmissionAnalysisTrigger,
    private val logger: DomainLogger
) {
    private val tag = "GTOSubmissionCoordinator"

    suspend fun onSubmitted(submissionId: String, testType: TestType, gtoTestType: GTOTestType, userId: String) {
        runCatching { usageRecorder.recordTestUsage(testType, userId, submissionId) }
            .onFailure { logger.e(tag, "Failed to record GTO test usage for $gtoTestType", it) }
        gtoRepository.updateProgress(userId, gtoTestType)
            .onFailure { logger.e(tag, "Failed to update GTO progress for $gtoTestType", it) }
        analysisTrigger.trigger(testType, submissionId)
    }
}
