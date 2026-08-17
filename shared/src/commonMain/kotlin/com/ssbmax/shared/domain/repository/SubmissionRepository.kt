package com.ssbmax.shared.domain.repository

import com.ssbmax.shared.domain.model.*
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import kotlinx.coroutines.flow.Flow

/**
 * Repository interface for test submissions
 */
interface SubmissionRepository {

    /**
     * Submit TAT test
     */
    suspend fun submitTAT(submission: TATSubmission, batchId: String? = null): Result<String>

    /**
     * Submit WAT test
     */
    suspend fun submitWAT(submission: WATSubmission, batchId: String? = null): Result<String>

    /**
     * Submit SRT test
     */
    suspend fun submitSRT(submission: SRTSubmission, batchId: String? = null): Result<String>

    /**
     * Submit SDT test
     */
    suspend fun submitSDT(submission: SDTSubmission, batchId: String? = null): Result<String>

    /**
     * Submit PPDT test
     */
    suspend fun submitPPDT(submission: PPDTSubmission, batchId: String? = null): Result<String>

    /**
     * Submit GD test
     */
    suspend fun submitGD(submission: com.ssbmax.shared.domain.model.gto.GTOSubmission.GDSubmission, batchId: String? = null): Result<String>

    /**
     * Submit Lecturette test
     */
    suspend fun submitLecturette(submission: com.ssbmax.shared.domain.model.gto.GTOSubmission.LecturetteSubmission, batchId: String? = null): Result<String>

    /**
     * Submit OIR test
     */
    suspend fun submitOIR(submission: OIRSubmission, batchId: String? = null): Result<String>

    /**
     * Submit PIQ test
     */
    suspend fun submitPIQ(submission: PIQSubmission, batchId: String? = null): Result<String>

    /**
     * Submit GPE test
     */
    suspend fun submitGPE(submission: com.ssbmax.shared.domain.model.gto.GTOSubmission.GPESubmission, batchId: String? = null): Result<String>

    /**
     * Get submission by ID
     */
    suspend fun getSubmission(submissionId: String): Result<Map<String, Any>?>

    /**
     * Get user's submissions
     */
    suspend fun getUserSubmissions(userId: String, limit: Int = 50): Result<List<Map<String, Any>>>

    /**
     * Get user's submissions by test type
     */
    suspend fun getUserSubmissionsByTestType(
        userId: String,
        testType: TestType,
        limit: Int = 20
    ): Result<List<Map<String, Any>>>

    /**
     * Observe submission changes in real-time
     */
    fun observeSubmission(submissionId: String): Flow<Map<String, Any>?>

    /**
     * Observe user's submissions in real-time
     */
    fun observeUserSubmissions(userId: String, limit: Int = 50): Flow<List<Map<String, Any>>>

    /**
     * Update submission status
     */
    suspend fun updateSubmissionStatus(
        submissionId: String,
        status: SubmissionStatus
    ): Result<Unit>

    /**
     * Get latest PIQ submission for user
     */
    suspend fun getLatestPIQSubmission(userId: String): Result<PIQSubmission?>

    /**
     * Get latest OIR submission for user
     */
    suspend fun getLatestOIRSubmission(userId: String): Result<OIRSubmission?>

    /**
     * Get latest PPDT submission for user
     */
    suspend fun getLatestPPDTSubmission(userId: String): Result<PPDTSubmission?>

    // ===========================
    // TAT OLQ Analysis Methods
    // ===========================

    /**
     * Get TAT submission by ID
     */
    suspend fun getTATSubmission(submissionId: String): Result<TATSubmission?>

    /**
     * Get latest TAT submission for user
     */
    suspend fun getLatestTATSubmission(userId: String): Result<TATSubmission?>

    /**
     * Get TAT OLQ Result
     */
    suspend fun getTATResult(submissionId: String): Result<OLQAnalysisResult?>

    /**
     * Update TAT analysis status
     */
    suspend fun updateTATAnalysisStatus(
        submissionId: String,
        status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus
    ): Result<Unit>

    /**
     * Atomically finalizes a TAT analysis result.
     *
     * Guarantees that the OLQ result is persisted to `psych_results` **before** the
     * submission is marked COMPLETED. Completion metadata ([resultUpdatedAt], [hasOlqResult],
     * [resultSource]) is written atomically with the status change so the submission document
     * remains self-describing even when the full result body is stored elsewhere.
     *
     * Returns [Result.failure] if either persistence step fails. Callers must not trigger
     * side effects (cache invalidation, notifications) until this returns success.
     */
    suspend fun finalizeTATAnalysisResult(
        submissionId: String,
        olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
    ): Result<Unit>

    /**
     * Observe TAT submission in real-time
     */
    fun observeTATSubmission(submissionId: String): Flow<TATSubmission?>

    // ===========================
    // WAT OLQ Analysis Methods
    // ===========================

    /**
     * Get WAT submission by ID
     */
    suspend fun getWATSubmission(submissionId: String): Result<WATSubmission?>

    /**
     * Get latest WAT submission for user
     */
    suspend fun getLatestWATSubmission(userId: String): Result<WATSubmission?>

    /**
     * Get WAT OLQ Result
     */
    suspend fun getWATResult(submissionId: String): Result<OLQAnalysisResult?>

    /**
     * Update WAT analysis status
     */
    suspend fun updateWATAnalysisStatus(
        submissionId: String,
        status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus
    ): Result<Unit>

    /**
     * Update WAT OLQ result
     */
    suspend fun updateWATOLQResult(
        submissionId: String,
        olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
    ): Result<Unit>

    /**
     * Observe WAT submission in real-time
     */
    fun observeWATSubmission(submissionId: String): Flow<WATSubmission?>

    // ===========================
    // SRT OLQ Analysis Methods
    // ===========================

    /**
     * Get SRT submission by ID
     */
    suspend fun getSRTSubmission(submissionId: String): Result<SRTSubmission?>

    /**
     * Get latest SRT submission for user
     */
    suspend fun getLatestSRTSubmission(userId: String): Result<SRTSubmission?>

    /**
     * Get SRT OLQ Result
     */
    suspend fun getSRTResult(submissionId: String): Result<OLQAnalysisResult?>

    /**
     * Update SRT analysis status
     */
    suspend fun updateSRTAnalysisStatus(
        submissionId: String,
        status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus
    ): Result<Unit>

    /**
     * Update SRT OLQ result
     */
    suspend fun updateSRTOLQResult(
        submissionId: String,
        olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
    ): Result<Unit>

    /**
     * Observe SRT submission in real-time
     */
    fun observeSRTSubmission(submissionId: String): Flow<SRTSubmission?>

    // ===========================
    // SDT OLQ Analysis Methods
    // ===========================

    /**
     * Get SDT submission by ID
     */
    suspend fun getSDTSubmission(submissionId: String): Result<SDTSubmission?>

    /**
     * Get latest SDT submission for user
     */
    suspend fun getLatestSDTSubmission(userId: String): Result<SDTSubmission?>

    /**
     * Get SDT OLQ Result
     */
    suspend fun getSDTResult(submissionId: String): Result<OLQAnalysisResult?>

    /**
     * Update SDT analysis status
     */
    suspend fun updateSDTAnalysisStatus(
        submissionId: String,
        status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus
    ): Result<Unit>

    /**
     * Update SDT OLQ result
     */
    suspend fun updateSDTOLQResult(
        submissionId: String,
        olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
    ): Result<Unit>

    /**
     * Observe SDT submission in real-time
     */
    fun observeSDTSubmission(submissionId: String): Flow<SDTSubmission?>

    // ===========================
    // PPDT OLQ Analysis Methods
    // ===========================

    /**
     * Get PPDT submission by ID
     */
    suspend fun getPPDTSubmission(submissionId: String): Result<PPDTSubmission?>

    /**
     * Update PPDT analysis status
     */
    suspend fun updatePPDTAnalysisStatus(
        submissionId: String,
        status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus
    ): Result<Unit>

    /**
     * Update PPDT OLQ result
     */
    suspend fun updatePPDTOLQResult(
        submissionId: String,
        olqResult: com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
    ): Result<Unit>

    /**
     * Observe PPDT submission in real-time
     */
    fun observePPDTSubmission(submissionId: String): Flow<PPDTSubmission?>

    /**
     * Get PPDT OLQ result from ppdt_results collection (GTO pattern)
     */
    suspend fun getPPDTResult(submissionId: String): Result<com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult?>

    // Archival: submission archival ([archiveOldSubmissions]) was removed from this interface by
    // the submission-archival server-migration plan. `archived_submissions` is server-only in
    // firestore.rules, so the client write always hit PERMISSION_DENIED; a scheduled Cloud
    // Function (`functions/src/archival/archiveOldSubmissions.js`) replaces it entirely.
}
