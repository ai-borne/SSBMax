package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.OIRSubmission
import com.ssbmax.shared.domain.model.PIQSubmission
import com.ssbmax.shared.domain.model.PPDTSubmission
import com.ssbmax.shared.domain.model.SDTSubmission
import com.ssbmax.shared.domain.model.SRTSubmission
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.WATSubmission
import com.ssbmax.shared.domain.model.gto.GTOSubmission
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.repository.SubmissionRepository
import kotlinx.coroutines.flow.Flow

/**
 * GitLive-Firebase-backed port of the Android `FirestoreSubmissionRepository` facade. Delegates
 * to the same specialized-repository split as the Android original
 * (`CommonSubmissionRepository`/`SubmissionArchiveRepository`/`GTOSubmissionRepository`/
 * `PersonalTestSubmissionRepository`/`PsychTestSubmissionRepository`), just merged 1:1 with this
 * slice's `GitLive*` classes instead of Hilt-injected as five separate constructor params (Koin
 * doesn't need the DI-boundary split reason).
 *
 * The raw `Map<String, Any>` methods (`getSubmission`/`getUserSubmissions`/
 * `getUserSubmissionsByTestType`/`observeSubmission`/`observeUserSubmissions`/
 * `getPendingSubmissionsForInstructor`) and `submitPIQ`/
 * `getLatestPIQSubmission` are fully ported — see [FirestoreRawMapSerializer]'s class doc for the
 * raw-Map decode/encode fix and [GitLivePersonalTestSubmissionRepository]'s class doc for the PIQ port.
 * `archiveOldSubmissions` (formerly delegated to `GitLiveSubmissionArchiveRepository`) was removed
 * by the submission-archival server-migration plan — see [SubmissionRepository]'s class doc.
 */
class GitLiveSubmissionRepository(
    private val commonRepo: GitLiveCommonSubmissionRepository = GitLiveCommonSubmissionRepository(),
    private val gtoRepo: GitLiveGTOSubmissionRepository = GitLiveGTOSubmissionRepository(),
    private val personalRepo: GitLivePersonalTestSubmissionRepository = GitLivePersonalTestSubmissionRepository(),
    private val psychRepo: GitLivePsychTestSubmissionRepository = GitLivePsychTestSubmissionRepository()
) : SubmissionRepository {

    // GTO
    override suspend fun submitGD(submission: GTOSubmission.GDSubmission, batchId: String?): Result<String> =
        gtoRepo.submitGD(submission, batchId)

    override suspend fun submitLecturette(submission: GTOSubmission.LecturetteSubmission, batchId: String?): Result<String> =
        gtoRepo.submitLecturette(submission, batchId)

    override suspend fun submitGPE(submission: GTOSubmission.GPESubmission, batchId: String?): Result<String> =
        gtoRepo.submitGPE(submission, batchId)

    // Common
    override suspend fun getSubmission(submissionId: String): Result<Map<String, Any>?> = commonRepo.getSubmission(submissionId)

    override suspend fun getUserSubmissions(userId: String, limit: Int): Result<List<Map<String, Any>>> =
        commonRepo.getUserSubmissions(userId, limit)

    override suspend fun getUserSubmissionsByTestType(userId: String, testType: TestType, limit: Int): Result<List<Map<String, Any>>> =
        commonRepo.getUserSubmissionsByTestType(userId, testType, limit)

    override fun observeSubmission(submissionId: String): Flow<Map<String, Any>?> =
        commonRepo.observeSubmission(submissionId)

    override fun observeUserSubmissions(userId: String, limit: Int): Flow<List<Map<String, Any>>> =
        commonRepo.observeUserSubmissions(userId, limit)

    override suspend fun updateSubmissionStatus(submissionId: String, status: SubmissionStatus): Result<Unit> =
        commonRepo.updateSubmissionStatus(submissionId, status)

    // Personal (PPDT/OIR done, PIQ deferred)
    override suspend fun submitPPDT(submission: PPDTSubmission, batchId: String?): Result<String> =
        personalRepo.submitPPDT(submission, batchId)

    override suspend fun submitOIR(submission: OIRSubmission, batchId: String?): Result<String> =
        personalRepo.submitOIR(submission, batchId)

    override suspend fun submitPIQ(submission: PIQSubmission, batchId: String?): Result<String> =
        personalRepo.submitPIQ(submission, batchId)

    override suspend fun getLatestPIQSubmission(userId: String): Result<PIQSubmission?> =
        personalRepo.getLatestPIQSubmission(userId)

    override suspend fun getLatestOIRSubmission(userId: String): Result<OIRSubmission?> =
        personalRepo.getLatestOIRSubmission(userId)

    override suspend fun getLatestPPDTSubmission(userId: String): Result<PPDTSubmission?> =
        personalRepo.getLatestPPDTSubmission(userId)

    override suspend fun getPPDTSubmission(submissionId: String): Result<PPDTSubmission?> =
        personalRepo.getPPDTSubmission(submissionId)

    override suspend fun updatePPDTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> =
        personalRepo.updatePPDTAnalysisStatus(submissionId, status)

    override suspend fun updatePPDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        personalRepo.updatePPDTOLQResult(submissionId, olqResult)

    override fun observePPDTSubmission(submissionId: String): Flow<PPDTSubmission?> =
        personalRepo.observePPDTSubmission(submissionId)

    override suspend fun getPPDTResult(submissionId: String): Result<OLQAnalysisResult?> =
        personalRepo.getPPDTResult(submissionId)

    // TAT
    override suspend fun submitTAT(submission: TATSubmission, batchId: String?): Result<String> =
        psychRepo.submitTAT(submission, batchId)

    override suspend fun getTATSubmission(submissionId: String): Result<TATSubmission?> =
        psychRepo.getTATSubmission(submissionId)

    override suspend fun getLatestTATSubmission(userId: String): Result<TATSubmission?> =
        psychRepo.getLatestTATSubmission(userId)

    override suspend fun getTATResult(submissionId: String): Result<OLQAnalysisResult?> =
        psychRepo.getTATResult(submissionId)

    override suspend fun updateTATAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> =
        psychRepo.updateTATAnalysisStatus(submissionId, status)

    override suspend fun finalizeTATAnalysisResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        psychRepo.finalizeTATAnalysisResult(submissionId, olqResult)

    override fun observeTATSubmission(submissionId: String): Flow<TATSubmission?> =
        psychRepo.observeTATSubmission(submissionId)

    // WAT
    override suspend fun submitWAT(submission: WATSubmission, batchId: String?): Result<String> =
        psychRepo.submitWAT(submission, batchId)

    override suspend fun getWATSubmission(submissionId: String): Result<WATSubmission?> =
        psychRepo.getWATSubmission(submissionId)

    override suspend fun getLatestWATSubmission(userId: String): Result<WATSubmission?> =
        psychRepo.getLatestWATSubmission(userId)

    override suspend fun getWATResult(submissionId: String): Result<OLQAnalysisResult?> =
        psychRepo.getWATResult(submissionId)

    override suspend fun updateWATAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> =
        psychRepo.updateWATAnalysisStatus(submissionId, status)

    override suspend fun updateWATOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        psychRepo.updateWATOLQResult(submissionId, olqResult)

    override fun observeWATSubmission(submissionId: String): Flow<WATSubmission?> =
        psychRepo.observeWATSubmission(submissionId)

    // SRT
    override suspend fun submitSRT(submission: SRTSubmission, batchId: String?): Result<String> =
        psychRepo.submitSRT(submission, batchId)

    override suspend fun getSRTSubmission(submissionId: String): Result<SRTSubmission?> =
        psychRepo.getSRTSubmission(submissionId)

    override suspend fun getLatestSRTSubmission(userId: String): Result<SRTSubmission?> =
        psychRepo.getLatestSRTSubmission(userId)

    override suspend fun getSRTResult(submissionId: String): Result<OLQAnalysisResult?> =
        psychRepo.getSRTResult(submissionId)

    override suspend fun updateSRTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> =
        psychRepo.updateSRTAnalysisStatus(submissionId, status)

    override suspend fun updateSRTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        psychRepo.updateSRTOLQResult(submissionId, olqResult)

    override fun observeSRTSubmission(submissionId: String): Flow<SRTSubmission?> =
        psychRepo.observeSRTSubmission(submissionId)

    // SDT
    override suspend fun submitSDT(submission: SDTSubmission, batchId: String?): Result<String> =
        psychRepo.submitSDT(submission, batchId)

    override suspend fun getSDTSubmission(submissionId: String): Result<SDTSubmission?> =
        psychRepo.getSDTSubmission(submissionId)

    override suspend fun getLatestSDTSubmission(userId: String): Result<SDTSubmission?> =
        psychRepo.getLatestSDTSubmission(userId)

    override suspend fun getSDTResult(submissionId: String): Result<OLQAnalysisResult?> =
        psychRepo.getSDTResult(submissionId)

    override suspend fun updateSDTAnalysisStatus(submissionId: String, status: AnalysisStatus): Result<Unit> =
        psychRepo.updateSDTAnalysisStatus(submissionId, status)

    override suspend fun updateSDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult): Result<Unit> =
        psychRepo.updateSDTOLQResult(submissionId, olqResult)

    override fun observeSDTSubmission(submissionId: String): Flow<SDTSubmission?> =
        psychRepo.observeSDTSubmission(submissionId)
}
