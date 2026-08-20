package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.PPDTImageContext
import com.ssbmax.shared.domain.model.TATImageContext
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.gto.GTOSubmission
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.model.interview.InterviewQuestion
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.QuestionCacheRepository
import com.ssbmax.shared.domain.model.interview.QuestionCacheStats
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.service.AIService
import com.ssbmax.shared.domain.service.ResponseAnalysis
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

/**
 * Test doubles for [InterviewQuestionGenerator]'s 3 collaborators. Only the methods
 * [InterviewQuestionGenerator] actually calls are meaningfully configurable; every other
 * interface member is a required-but-unused stub (Kotlin has no partial interface
 * implementation), kept to one line each to stay within this file's budget.
 */
private fun unused(): Nothing = error("not used by InterviewQuestionGeneratorTest")

internal class FakeQuestionCacheRepository(
    var piqQuestions: List<InterviewQuestion> = emptyList(),
    var genericQuestions: List<InterviewQuestion> = emptyList()
) : QuestionCacheRepository {
    val cachedBatches = mutableListOf<List<InterviewQuestion>>()
    override suspend fun cachePIQQuestions(piqSnapshotId: String, questions: List<InterviewQuestion>, expirationDays: Int) =
        Result.success(Unit).also { cachedBatches.add(questions) }
    override suspend fun getPIQQuestions(piqSnapshotId: String, limit: Int, excludeUsed: Boolean) =
        Result.success(piqQuestions.take(limit))
    override suspend fun getGenericQuestions(targetOLQs: List<OLQ>?, difficulty: Int?, limit: Int, excludeUsed: Boolean) =
        Result.success(genericQuestions.take(limit))
    override suspend fun markQuestionUsed(questionId: String, sessionId: String) = unused()
    override suspend fun cleanupExpired(): Result<Int> = unused()
    override suspend fun getCacheStats(userId: String?): Result<QuestionCacheStats> = unused()
    override suspend fun invalidatePIQCache(piqSnapshotId: String) = unused()
}

internal class FakeAIService(
    var piqQuestionsResult: Result<List<InterviewQuestion>> = Result.success(emptyList())
) : AIService {
    override suspend fun generatePIQBasedQuestions(piqData: String, targetOLQs: List<OLQ>?, count: Int, difficulty: Int) =
        piqQuestionsResult
    override suspend fun generateAdaptiveQuestions(previousQuestions: List<InterviewQuestion>, previousResponses: List<String>, weakOLQs: List<OLQ>, count: Int) = unused()
    override suspend fun analyzeResponse(question: InterviewQuestion, response: String, responseMode: String): Result<ResponseAnalysis> = unused()
    override suspend fun generateFeedback(questions: List<InterviewQuestion>, responses: List<String>, olqScores: Map<OLQ, Float>) = unused()
    override suspend fun analyzeGTOResponse(prompt: String, testType: GTOTestType): Result<ResponseAnalysis> = unused()
    override suspend fun analyzeTATResponse(prompt: String): Result<ResponseAnalysis> = unused()
    override suspend fun analyzeWATResponse(prompt: String): Result<ResponseAnalysis> = unused()
    override suspend fun analyzeSRTResponse(prompt: String): Result<ResponseAnalysis> = unused()
    override suspend fun analyzeSDResponse(prompt: String): Result<ResponseAnalysis> = unused()
    override suspend fun analyzePPDTMultimodal(imageBytes: ByteArray, story: String, imageContext: PPDTImageContext, candidateGender: String): Result<ResponseAnalysis> = unused()
    override suspend fun analyzeTATStoryMultimodal(imageBytes: ByteArray, story: String, imageContext: TATImageContext, candidateGender: String, storyIndex: Int, totalStories: Int, imageGenderTag: String): Result<ResponseAnalysis> = unused()
    override suspend fun isAvailable(): Boolean = unused()
}

internal class FakeSubmissionRepository(
    var submission: Map<String, Any>? = null
) : SubmissionRepository {
    override suspend fun getSubmission(submissionId: String) = Result.success(submission)
    override suspend fun submitTAT(submission: com.ssbmax.shared.domain.model.TATSubmission, batchId: String?) = unused()
    override suspend fun submitWAT(submission: com.ssbmax.shared.domain.model.WATSubmission, batchId: String?) = unused()
    override suspend fun submitSRT(submission: com.ssbmax.shared.domain.model.SRTSubmission, batchId: String?) = unused()
    override suspend fun submitSDT(submission: com.ssbmax.shared.domain.model.SDTSubmission, batchId: String?) = unused()
    override suspend fun submitPPDT(submission: com.ssbmax.shared.domain.model.PPDTSubmission, batchId: String?) = unused()
    override suspend fun submitGD(submission: GTOSubmission.GDSubmission, batchId: String?) = unused()
    override suspend fun submitLecturette(submission: GTOSubmission.LecturetteSubmission, batchId: String?) = unused()
    override suspend fun submitOIR(submission: com.ssbmax.shared.domain.model.OIRSubmission, batchId: String?) = unused()
    override suspend fun submitPIQ(submission: com.ssbmax.shared.domain.model.PIQSubmission, batchId: String?) = unused()
    override suspend fun submitGPE(submission: GTOSubmission.GPESubmission, batchId: String?) = unused()
    override suspend fun getUserSubmissions(userId: String, limit: Int) = unused()
    override suspend fun getUserSubmissionsByTestType(userId: String, testType: TestType, limit: Int) = unused()
    override fun observeSubmission(submissionId: String): Flow<Map<String, Any>?> = flowOf(null)
    override fun observeUserSubmissions(userId: String, limit: Int): Flow<List<Map<String, Any>>> = flowOf(emptyList())
    override suspend fun updateSubmissionStatus(submissionId: String, status: com.ssbmax.shared.domain.model.SubmissionStatus) = unused()
    override suspend fun getLatestPIQSubmission(userId: String) = unused()
    override suspend fun getLatestOIRSubmission(userId: String) = unused()
    override suspend fun getLatestPPDTSubmission(userId: String) = unused()
    override suspend fun getTATSubmission(submissionId: String) = unused()
    override suspend fun getLatestTATSubmission(userId: String) = unused()
    override suspend fun getTATResult(submissionId: String): Result<OLQAnalysisResult?> = unused()
    override suspend fun updateTATAnalysisStatus(submissionId: String, status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus) = unused()
    override suspend fun finalizeTATAnalysisResult(submissionId: String, olqResult: OLQAnalysisResult) = unused()
    override fun observeTATSubmission(submissionId: String) = unused()
    override suspend fun getWATSubmission(submissionId: String) = unused()
    override suspend fun getLatestWATSubmission(userId: String) = unused()
    override suspend fun getWATResult(submissionId: String): Result<OLQAnalysisResult?> = unused()
    override suspend fun updateWATAnalysisStatus(submissionId: String, status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus) = unused()
    override suspend fun updateWATOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = unused()
    override fun observeWATSubmission(submissionId: String) = unused()
    override suspend fun getSRTSubmission(submissionId: String) = unused()
    override suspend fun getLatestSRTSubmission(userId: String) = unused()
    override suspend fun getSRTResult(submissionId: String): Result<OLQAnalysisResult?> = unused()
    override suspend fun updateSRTAnalysisStatus(submissionId: String, status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus) = unused()
    override suspend fun updateSRTOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = unused()
    override fun observeSRTSubmission(submissionId: String) = unused()
    override suspend fun getSDTSubmission(submissionId: String) = unused()
    override suspend fun getLatestSDTSubmission(userId: String) = unused()
    override suspend fun getSDTResult(submissionId: String): Result<OLQAnalysisResult?> = unused()
    override suspend fun updateSDTAnalysisStatus(submissionId: String, status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus) = unused()
    override suspend fun updateSDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = unused()
    override fun observeSDTSubmission(submissionId: String) = unused()
    override suspend fun getPPDTSubmission(submissionId: String) = unused()
    override suspend fun updatePPDTAnalysisStatus(submissionId: String, status: com.ssbmax.shared.domain.model.scoring.AnalysisStatus) = unused()
    override suspend fun updatePPDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = unused()
    override fun observePPDTSubmission(submissionId: String) = unused()
    override suspend fun getPPDTResult(submissionId: String): Result<OLQAnalysisResult?> = unused()
}
