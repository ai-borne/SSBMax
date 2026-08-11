package com.ssbmax.shared.presentation.testing

import com.ssbmax.shared.domain.model.CacheStatus
import com.ssbmax.shared.domain.model.GoogleSignInData
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.domain.model.OIRSubmission
import com.ssbmax.shared.domain.model.PIQSubmission
import com.ssbmax.shared.domain.model.PPDTQuestion
import com.ssbmax.shared.domain.model.PPDTSubmission
import com.ssbmax.shared.domain.model.SDTQuestion
import com.ssbmax.shared.domain.model.SDTSubmission
import com.ssbmax.shared.domain.model.SRTSubmission
import com.ssbmax.shared.domain.model.SSBMaxNotification
import com.ssbmax.shared.domain.model.SSBMaxUser
import com.ssbmax.shared.domain.model.SubmissionStatus
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.domain.model.TATSubmission
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.UserProfile
import com.ssbmax.shared.domain.model.UserRole
import com.ssbmax.shared.domain.model.WATSubmission
import com.ssbmax.shared.domain.model.gto.GTOSubmission
import com.ssbmax.shared.domain.model.scoring.AnalysisStatus
import com.ssbmax.shared.domain.model.scoring.OLQAnalysisResult
import com.ssbmax.shared.domain.model.FeatureFlags
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.repository.FeatureFlagRepository
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.repository.UsageInfo
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.domain.util.DomainLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf

/**
 * Hand-rolled test doubles shared across Phase 1 ViewModel characterization
 * tests. MockK has no Kotlin/Native equivalent (see shared/build.gradle.kts),
 * so these live in commonTest and run on every target. Each method defaults
 * to a benign success value; tests override only the `var` they assert on.
 */

class FakeAuthRepository(
    initialUser: SSBMaxUser? = null
) : AuthRepository {
    val userFlow = MutableStateFlow(initialUser)
    override val currentUser: MutableStateFlow<SSBMaxUser?> get() = userFlow
    var signInResult: Result<SSBMaxUser> = Result.failure(UnsupportedOperationException("not stubbed"))
    var signUpResult: Result<SSBMaxUser> = Result.failure(UnsupportedOperationException("not stubbed"))
    var handleGoogleSignInResultFn: (GoogleSignInData) -> Result<SSBMaxUser> =
        { Result.failure(UnsupportedOperationException("not stubbed")) }
    var updateUserRoleResult: Result<Unit> = Result.success(Unit)
    var signOutResult: Result<Unit> = Result.success(Unit)
    var isAuthenticatedResult: Boolean = true

    override suspend fun signIn(email: String, password: String) = signInResult
    override suspend fun signUp(email: String, password: String, displayName: String) = signUpResult
    override fun getGoogleSignInIntent(): GoogleSignInData.LaunchData = GoogleSignInData.LaunchData(platformData = Unit)
    override suspend fun handleGoogleSignInResult(data: GoogleSignInData) = handleGoogleSignInResultFn(data)
    override suspend fun updateUserRole(role: UserRole) = updateUserRoleResult
    override suspend fun signOut() = signOutResult
    override suspend fun isAuthenticated() = isAuthenticatedResult
}

class FakeSubscriptionRepository : SubscriptionRepository {
    var tierResult: Result<SubscriptionTier> = Result.success(SubscriptionTier.FREE)
    var monthlyUsageResult: Result<Map<String, UsageInfo>> = Result.success(emptyMap())
    var updateTierResult: Result<Unit> = Result.success(Unit)
    var getSubscriptionTierCallCount = 0

    override suspend fun getSubscriptionTier(userId: String): Result<SubscriptionTier> {
        getSubscriptionTierCallCount++
        return tierResult
    }
    override suspend fun getMonthlyUsage(userId: String, month: String) = monthlyUsageResult
    override suspend fun updateSubscriptionTier(userId: String, tier: SubscriptionTier) = updateTierResult
}

class FakeFeatureFlagRepository(
    var flagsResult: FeatureFlags = FeatureFlags.SAFE_DEFAULT
) : FeatureFlagRepository {
    var getFeatureFlagsCallCount = 0

    override suspend fun getFeatureFlags(): FeatureFlags {
        getFeatureFlagsCallCount++
        return flagsResult
    }
}

class FakeTestContentRepository : TestContentRepository {
    var oirQuestionsResult: Result<List<OIRQuestion>> = Result.success(emptyList())
    var getOIRQuestionsCallCount = 0
    var ppdtQuestionResult: Result<PPDTQuestion> = Result.failure(UnsupportedOperationException("not stubbed"))
    var gpeQuestionsResult: Result<List<com.ssbmax.shared.domain.model.GPEQuestion>> = Result.success(emptyList())
    var getRandomLecturetteTopicsResult: Result<List<String>> = Result.success(emptyList())
    var clearCacheCalls = 0

    override suspend fun getOIRQuestions(testId: String) = oirQuestionsResult
    override suspend fun getOIRTestQuestions(count: Int): Result<List<OIRQuestion>> {
        getOIRQuestionsCallCount++
        return oirQuestionsResult
    }
    override suspend fun initializeOIRCache(): Result<Unit> = Result.success(Unit)
    override suspend fun getOIRCacheStatus(): CacheStatus = CacheStatus(
        cachedQuestions = 0, batchesDownloaded = 0, lastSyncTime = null,
        verbalCount = 0, nonVerbalCount = 0, numericalCount = 0, spatialCount = 0
    )
    override suspend fun getPPDTQuestions(testId: String) = Result.success(emptyList<PPDTQuestion>())
    override suspend fun getPPDTQuestion(questionId: String) = ppdtQuestionResult
    override suspend fun getPPDTQuestion(genderTag: com.ssbmax.shared.domain.model.GenderTag?) = ppdtQuestionResult
    override suspend fun getGPEQuestions(testId: String) = gpeQuestionsResult
    override suspend fun getTATQuestions(testId: String, genderTag: com.ssbmax.shared.domain.model.GenderTag?) =
        Result.success(emptyList<com.ssbmax.shared.domain.model.TATQuestion>())
    override suspend fun getWATQuestions(testId: String) = Result.success(emptyList<com.ssbmax.shared.domain.model.WATWord>())
    override suspend fun getSRTQuestions(testId: String) = Result.success(emptyList<com.ssbmax.shared.domain.model.SRTSituation>())
    override suspend fun getSDTQuestions(testId: String) = Result.success(emptyList<SDTQuestion>())
    override suspend fun getRandomGDTopic() = Result.success("topic")
    override suspend fun getRandomLecturetteTopics(count: Int) = getRandomLecturetteTopicsResult
    override fun clearCache() { clearCacheCalls++ }
}

class FakeTestSessionRepository : TestSessionRepository {
    var hasActiveSessionResult: Result<Boolean> = Result.success(false)
    var createSessionResult: Result<String> = Result.success("session-1")
    var endSessionResult: Result<Unit> = Result.success(Unit)
    var endedSessionIds = mutableListOf<String>()

    // Split out from endedSessionIds so tests can assert WHICH terminal transition fired
    // (e.g. abandon-on-exit vs. complete-on-submit), not just that some transition happened.
    var completedSessionIds = mutableListOf<String>()
    var abandonedSessionIds = mutableListOf<String>()
    var expiredSessionIds = mutableListOf<String>()

    override suspend fun hasActiveTestSession(userId: String, testId: String) = hasActiveSessionResult
    override suspend fun createTestSession(userId: String, testId: String, testType: TestType) = createSessionResult
    override suspend fun completeTestSession(sessionId: String): Result<Unit> {
        endedSessionIds += sessionId
        completedSessionIds += sessionId
        return endSessionResult
    }

    override suspend fun abandonTestSession(sessionId: String): Result<Unit> {
        endedSessionIds += sessionId
        abandonedSessionIds += sessionId
        return endSessionResult
    }

    override suspend fun expireTestSession(sessionId: String): Result<Unit> {
        endedSessionIds += sessionId
        expiredSessionIds += sessionId
        return endSessionResult
    }
}

class FakeUserProfileRepository(
    initialProfile: UserProfile? = null
) : UserProfileRepository {
    val profileFlow = MutableStateFlow<Result<UserProfile?>>(Result.success(initialProfile))
    var saveResult: Result<Unit> = Result.success(Unit)
    var updateResult: Result<Unit> = Result.success(Unit)
    var hasCompletedProfileResult: Boolean = true
    var updateLoginStreakResult: Result<Int> = Result.success(1)

    override fun getUserProfile(userId: String): Flow<Result<UserProfile?>> = profileFlow
    override suspend fun saveUserProfile(profile: UserProfile) = saveResult
    override suspend fun updateUserProfile(profile: UserProfile) = updateResult
    override fun hasCompletedProfile(userId: String): Flow<Boolean> = flowOf(hasCompletedProfileResult)
    override suspend fun updateLoginStreak(userId: String) = updateLoginStreakResult
}

class FakeTestUsageRecorder : TestUsageRecorder {
    val recorded = mutableListOf<Triple<TestType, String, String?>>()
    override suspend fun recordTestUsage(testType: TestType, userId: String, submissionId: String?) {
        recorded += Triple(testType, userId, submissionId)
    }
}

class FakeDifficultyProgressionRepository(
    var recommendedDifficulty: String = "EASY"
) : com.ssbmax.shared.domain.repository.DifficultyProgressionRepository {
    data class RecordedPerformance(
        val testType: String, val difficulty: String, val score: Float,
        val correctAnswers: Int, val totalQuestions: Int, val timeSeconds: Float
    )

    val recorded = mutableListOf<RecordedPerformance>()

    override suspend fun getRecommendedDifficulty(testType: String) = recommendedDifficulty

    override suspend fun recordPerformance(
        testType: String, difficulty: String, score: Float,
        correctAnswers: Int, totalQuestions: Int, timeSeconds: Float
    ) {
        recorded += RecordedPerformance(testType, difficulty, score, correctAnswers, totalQuestions, timeSeconds)
    }

    override fun getPerformanceSummary(testType: String) = flowOf<com.ssbmax.shared.domain.model.TestPerformanceSummary?>(null)
    override suspend fun resetPerformance(testType: String) = Unit
}

class FakeSubmissionAnalysisTrigger : com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger {
    val triggered = mutableListOf<Pair<TestType, String>>()
    /** Alias -- some call sites read `triggeredCalls`, others `triggered`; both refer to the same list. */
    val triggeredCalls: List<Pair<TestType, String>> get() = triggered

    override fun trigger(testType: TestType, submissionId: String) {
        triggered += testType to submissionId
    }
}

/**
 * Covers only the members Phase 1 ViewModels actually call. The interface has
 * ~50 methods across every test-type vertical; the rest fail loud (Rule 12)
 * rather than silently returning a plausible-looking default that could mask
 * a wiring bug in a test that didn't mean to exercise that path.
 */
class FakeSubmissionRepository : SubmissionRepository {
    var submitResult: Result<String> = Result.success("submission-1")
    var getSubmissionResult: Result<Map<String, Any>?> = Result.success(null)
    var getUserSubmissionsResult: Result<List<Map<String, Any>>> = Result.success(emptyList())
    var observeSubmissionFlow: Flow<Map<String, Any>?> = flowOf(null)
    var observeUserSubmissionsFlow: Flow<List<Map<String, Any>>> = flowOf(emptyList())
    var updateStatusResult: Result<Unit> = Result.success(Unit)
    var lastTATSubmission: TATSubmission? = null

    private fun unused(name: String): Nothing = error("FakeSubmissionRepository.$name not stubbed for this test")

    override suspend fun submitTAT(submission: TATSubmission, batchId: String?): Result<String> {
        lastTATSubmission = submission
        return submitResult
    }
    override suspend fun submitWAT(submission: WATSubmission, batchId: String?) = submitResult
    override suspend fun submitSRT(submission: SRTSubmission, batchId: String?) = submitResult
    override suspend fun submitSDT(submission: SDTSubmission, batchId: String?) = submitResult
    override suspend fun submitPPDT(submission: PPDTSubmission, batchId: String?) = submitResult
    override suspend fun submitGD(submission: GTOSubmission.GDSubmission, batchId: String?) = submitResult
    override suspend fun submitLecturette(submission: GTOSubmission.LecturetteSubmission, batchId: String?) = submitResult
    override suspend fun submitOIR(submission: OIRSubmission, batchId: String?) = submitResult
    override suspend fun submitPIQ(submission: PIQSubmission, batchId: String?) = submitResult
    override suspend fun submitGPE(submission: GTOSubmission.GPESubmission, batchId: String?) = submitResult

    override suspend fun getSubmission(submissionId: String) = getSubmissionResult
    override suspend fun getUserSubmissions(userId: String, limit: Int) = getUserSubmissionsResult
    override suspend fun getUserSubmissionsByTestType(userId: String, testType: TestType, limit: Int) = getUserSubmissionsResult

    override fun observeSubmission(submissionId: String) = observeSubmissionFlow
    override fun observeUserSubmissions(userId: String, limit: Int) = observeUserSubmissionsFlow

    override suspend fun updateSubmissionStatus(submissionId: String, status: SubmissionStatus) = updateStatusResult

    override suspend fun getLatestPIQSubmission(userId: String): Result<PIQSubmission?> = Result.success(null)
    override suspend fun getLatestOIRSubmission(userId: String): Result<OIRSubmission?> = Result.success(null)
    override suspend fun getLatestPPDTSubmission(userId: String): Result<PPDTSubmission?> = Result.success(null)

    override suspend fun getTATSubmission(submissionId: String): Result<TATSubmission?> = unused("getTATSubmission")
    // GetOLQDashboardUseCase (a transitive dependency of every Submit*TestUseCase and of
    // StudentHomeViewModel) calls getLatest*Submission for every test type unconditionally --
    // "no submission yet" must be a safe default, not unused(), or the whole dashboard fetch throws.
    override suspend fun getLatestTATSubmission(userId: String): Result<TATSubmission?> = Result.success(null)
    override suspend fun getTATResult(submissionId: String): Result<OLQAnalysisResult?> = unused("getTATResult")
    override suspend fun updateTATAnalysisStatus(submissionId: String, status: AnalysisStatus) = unused("updateTATAnalysisStatus")
    override suspend fun finalizeTATAnalysisResult(submissionId: String, olqResult: OLQAnalysisResult) = unused("finalizeTATAnalysisResult")
    override fun observeTATSubmission(submissionId: String): Flow<TATSubmission?> = unused("observeTATSubmission")

    var watSubmissionResult: Result<WATSubmission?> = Result.failure(UnsupportedOperationException("not stubbed"))
    var updateWATAnalysisStatusResult: Result<Unit> = Result.success(Unit)
    var updateWATOLQResultResult: Result<Unit> = Result.success(Unit)
    var srtSubmissionResult: Result<SRTSubmission?> = Result.failure(UnsupportedOperationException("not stubbed"))
    var updateSRTAnalysisStatusResult: Result<Unit> = Result.success(Unit)
    var updateSRTOLQResultResult: Result<Unit> = Result.success(Unit)
    var sdtSubmissionResult: Result<SDTSubmission?> = Result.failure(UnsupportedOperationException("not stubbed"))
    var updateSDTAnalysisStatusResult: Result<Unit> = Result.success(Unit)
    var updateSDTOLQResultResult: Result<Unit> = Result.success(Unit)
    var ppdtSubmissionResult: Result<PPDTSubmission?> = Result.failure(UnsupportedOperationException("not stubbed"))
    var updatePPDTAnalysisStatusResult: Result<Unit> = Result.success(Unit)
    var updatePPDTOLQResultResult: Result<Unit> = Result.success(Unit)

    override suspend fun getWATSubmission(submissionId: String): Result<WATSubmission?> = watSubmissionResult
    override suspend fun getLatestWATSubmission(userId: String): Result<WATSubmission?> = Result.success(null)
    override suspend fun getWATResult(submissionId: String): Result<OLQAnalysisResult?> = unused("getWATResult")
    override suspend fun updateWATAnalysisStatus(submissionId: String, status: AnalysisStatus) = updateWATAnalysisStatusResult
    override suspend fun updateWATOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = updateWATOLQResultResult
    override fun observeWATSubmission(submissionId: String): Flow<WATSubmission?> = unused("observeWATSubmission")

    override suspend fun getSRTSubmission(submissionId: String): Result<SRTSubmission?> = srtSubmissionResult
    override suspend fun getLatestSRTSubmission(userId: String): Result<SRTSubmission?> = Result.success(null)
    override suspend fun getSRTResult(submissionId: String): Result<OLQAnalysisResult?> = unused("getSRTResult")
    override suspend fun updateSRTAnalysisStatus(submissionId: String, status: AnalysisStatus) = updateSRTAnalysisStatusResult
    override suspend fun updateSRTOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = updateSRTOLQResultResult
    override fun observeSRTSubmission(submissionId: String): Flow<SRTSubmission?> = unused("observeSRTSubmission")

    override suspend fun getSDTSubmission(submissionId: String): Result<SDTSubmission?> = sdtSubmissionResult
    override suspend fun getLatestSDTSubmission(userId: String): Result<SDTSubmission?> = Result.success(null)
    override suspend fun getSDTResult(submissionId: String): Result<OLQAnalysisResult?> = unused("getSDTResult")
    override suspend fun updateSDTAnalysisStatus(submissionId: String, status: AnalysisStatus) = updateSDTAnalysisStatusResult
    override suspend fun updateSDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = updateSDTOLQResultResult
    override fun observeSDTSubmission(submissionId: String): Flow<SDTSubmission?> = unused("observeSDTSubmission")

    override suspend fun getPPDTSubmission(submissionId: String): Result<PPDTSubmission?> = ppdtSubmissionResult
    override suspend fun updatePPDTAnalysisStatus(submissionId: String, status: AnalysisStatus) = updatePPDTAnalysisStatusResult
    override suspend fun updatePPDTOLQResult(submissionId: String, olqResult: OLQAnalysisResult) = updatePPDTOLQResultResult
    override fun observePPDTSubmission(submissionId: String): Flow<PPDTSubmission?> = unused("observePPDTSubmission")
    override suspend fun getPPDTResult(submissionId: String): Result<OLQAnalysisResult?> = Result.success(null)

    override suspend fun archiveOldSubmissions(beforeTimestamp: Long): Result<Int> = unused("archiveOldSubmissions")
}

/**
 * Minimal fake covering only what [com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase]
 * calls (it's a transitive dependency of [com.ssbmax.shared.domain.usecase.oir.SubmitOIRTestUseCase]
 * and every other test-type submit use case) plus the GTO-vertical ViewModels. Same
 * fail-loud-if-unstubbed approach as [FakeSubmissionRepository].
 */
class FakeGTORepository : com.ssbmax.shared.domain.repository.GTORepository {
    var getLatestResultResult: Result<com.ssbmax.shared.domain.model.gto.GTOResultStatus> =
        Result.success(com.ssbmax.shared.domain.model.gto.GTOResultStatus.NotAttempted)
    var submissionResult: Result<GTOSubmission> = Result.failure(UnsupportedOperationException("not stubbed"))
    var observeSubmissionFlow: Flow<GTOSubmission?> = flowOf(null)
    // Phase 1c (GD/Lecturette/GPE) additions -- see GTOEligibilityChecker/GTOSubmissionCoordinator.
    var canUserTakeTestResult: Result<Boolean> = Result.success(true)
    var getCompletedTestsResult: Result<List<com.ssbmax.shared.domain.model.gto.GTOTestType>> = Result.success(emptyList())
    var updateProgressResult: Result<Unit> = Result.success(Unit)
    var getTestResultResult: Result<com.ssbmax.shared.domain.model.gto.GTOResult> = Result.failure(UnsupportedOperationException("not stubbed"))
    val recordedProgress = mutableListOf<Pair<String, com.ssbmax.shared.domain.model.gto.GTOTestType>>()

    private fun unused(name: String): Nothing = error("FakeGTORepository.$name not stubbed for this test")

    override suspend fun getRandomTest(testType: com.ssbmax.shared.domain.model.gto.GTOTestType) = unused("getRandomTest")
    override suspend fun getTestById(testId: String) = unused("getTestById")
    override suspend fun getRandomGPEScenario() = unused("getRandomGPEScenario")
    override suspend fun getObstaclesForTest(testType: com.ssbmax.shared.domain.model.gto.GTOTestType) = unused("getObstaclesForTest")
    var updateSubmissionStatusResult: Result<Unit> = Result.success(Unit)
    var updateSubmissionOLQScoresResult: Result<Unit> = Result.success(Unit)
    val recordedStatusUpdates = mutableListOf<com.ssbmax.shared.domain.model.gto.GTOSubmissionStatus>()
    val recordedOLQScores = mutableListOf<Map<com.ssbmax.shared.domain.model.interview.OLQ, com.ssbmax.shared.domain.model.interview.OLQScore>>()

    override suspend fun getSubmission(submissionId: String) = submissionResult
    override fun observeSubmission(submissionId: String) = observeSubmissionFlow
    override suspend fun updateSubmissionStatus(submissionId: String, status: com.ssbmax.shared.domain.model.gto.GTOSubmissionStatus): Result<Unit> {
        recordedStatusUpdates += status
        return updateSubmissionStatusResult
    }
    override suspend fun updateSubmissionOLQScores(submissionId: String, olqScores: Map<com.ssbmax.shared.domain.model.interview.OLQ, com.ssbmax.shared.domain.model.interview.OLQScore>): Result<Unit> {
        recordedOLQScores += olqScores
        return updateSubmissionOLQScoresResult
    }
    override suspend fun getUserSubmissions(userId: String, testType: com.ssbmax.shared.domain.model.gto.GTOTestType?) = unused("getUserSubmissions")
    override suspend fun getPendingSubmissions(limit: Int) = unused("getPendingSubmissions")
    override suspend fun getUserProgress(userId: String) = unused("getUserProgress")
    override fun observeUserProgress(userId: String) = unused("observeUserProgress")
    override suspend fun updateProgress(userId: String, completedTestType: com.ssbmax.shared.domain.model.gto.GTOTestType): Result<Unit> {
        recordedProgress += userId to completedTestType
        return updateProgressResult
    }
    override suspend fun canUserTakeTest(userId: String, testType: com.ssbmax.shared.domain.model.gto.GTOTestType) = canUserTakeTestResult
    override suspend fun getCompletedTests(userId: String) = getCompletedTestsResult
    override suspend fun getNextAvailableTest(userId: String) = unused("getNextAvailableTest")
    override suspend fun getTestResult(submissionId: String) = getTestResultResult
    override suspend fun getUserResults(userId: String, testType: com.ssbmax.shared.domain.model.gto.GTOTestType?) = unused("getUserResults")
    override suspend fun getLatestResult(userId: String, testType: com.ssbmax.shared.domain.model.gto.GTOTestType) = getLatestResultResult
    override suspend fun getAverageOLQScores(userId: String) = unused("getAverageOLQScores")
    override suspend fun cacheTestContent(testType: com.ssbmax.shared.domain.model.gto.GTOTestType) = unused("cacheTestContent")
    override suspend fun clearCache(testType: com.ssbmax.shared.domain.model.gto.GTOTestType?) = unused("clearCache")
    override suspend fun isContentCached(testType: com.ssbmax.shared.domain.model.gto.GTOTestType) = unused("isContentCached")
}

/**
 * Minimal fake for [com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase] wiring, same fail-loud pattern.
 *
 * Gap-closing addition (13-VM retroactive characterization test pass): `getUserResults`,
 * `createSession`, `getSession`, `updateSession`, `getQuestion`, `submitResponse`,
 * `getResultById`, and `getInterviewStats` were converted from `unused()` to stubbed
 * defaults here -- needed by [com.ssbmax.shared.presentation.interviewstart.StartInterviewViewModel],
 * [com.ssbmax.shared.presentation.interviewsession.InterviewSessionViewModel],
 * [com.ssbmax.shared.presentation.interviewresult.InterviewResultViewModel], and
 * [com.ssbmax.shared.presentation.topic.TopicViewModel]'s tests. Same "safe default,
 * not unused()" precedent [FakeSubmissionRepository] already established above.
 */
class FakeInterviewRepository : com.ssbmax.shared.domain.repository.InterviewRepository {
    var getLatestResultResult: Result<com.ssbmax.shared.domain.model.interview.InterviewResult?> = Result.success(null)
    var userResultsFlow: Flow<List<com.ssbmax.shared.domain.model.interview.InterviewResult>> = flowOf(emptyList())
    var createSessionResult: Result<com.ssbmax.shared.domain.model.interview.InterviewSession> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var getSessionResult: Result<com.ssbmax.shared.domain.model.interview.InterviewSession> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var updateSessionResult: Result<Unit> = Result.success(Unit)
    var getQuestionResult: Result<com.ssbmax.shared.domain.model.interview.InterviewQuestion> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var submitResponseResult: Result<com.ssbmax.shared.domain.model.interview.InterviewResponse> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var getResultByIdResult: Result<com.ssbmax.shared.domain.model.interview.InterviewResult> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var interviewStatsResult: Result<Map<com.ssbmax.shared.domain.model.interview.InterviewMode, Int>> = Result.success(emptyMap())
    val updatedSessions = mutableListOf<com.ssbmax.shared.domain.model.interview.InterviewSession>()
    val submittedResponses = mutableListOf<com.ssbmax.shared.domain.model.interview.InterviewResponse>()

    private fun unused(name: String): Nothing = error("FakeInterviewRepository.$name not stubbed for this test")

    override suspend fun checkPrerequisites(userId: String) = unused("checkPrerequisites")
    override suspend fun checkInterviewLimits(userId: String, mode: com.ssbmax.shared.domain.model.interview.InterviewMode) = unused("checkInterviewLimits")
    override suspend fun createSession(userId: String, mode: com.ssbmax.shared.domain.model.interview.InterviewMode, piqSnapshotId: String, consentGiven: Boolean) = createSessionResult
    override suspend fun getActiveSession(userId: String) = unused("getActiveSession")
    override suspend fun getSession(sessionId: String) = getSessionResult
    override suspend fun updateSession(session: com.ssbmax.shared.domain.model.interview.InterviewSession): Result<Unit> {
        updatedSessions += session
        return updateSessionResult
    }
    override suspend fun abandonSession(sessionId: String) = unused("abandonSession")
    override suspend fun generateQuestions(sessionId: String, piqSnapshotId: String, count: Int) = unused("generateQuestions")
    override suspend fun getQuestion(questionId: String) = getQuestionResult
    override suspend fun cacheQuestions(piqSnapshotId: String, questions: List<com.ssbmax.shared.domain.model.interview.InterviewQuestion>) = unused("cacheQuestions")
    override suspend fun getCachedQuestions(piqSnapshotId: String, limit: Int) = unused("getCachedQuestions")
    override suspend fun submitResponse(response: com.ssbmax.shared.domain.model.interview.InterviewResponse): Result<com.ssbmax.shared.domain.model.interview.InterviewResponse> {
        submittedResponses += response
        return submitResponseResult.let { if (it.isFailure) Result.success(response) else it }
    }
    var getResponsesResult: Result<List<com.ssbmax.shared.domain.model.interview.InterviewResponse>> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var getResponseResult: Result<com.ssbmax.shared.domain.model.interview.InterviewResponse> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var completeInterviewResult: Result<com.ssbmax.shared.domain.model.interview.InterviewResult> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    val updatedResponses = mutableListOf<com.ssbmax.shared.domain.model.interview.InterviewResponse>()

    override suspend fun getResponses(sessionId: String) = getResponsesResult
    override suspend fun getResponse(responseId: String) = getResponseResult
    override suspend fun updateResponse(response: com.ssbmax.shared.domain.model.interview.InterviewResponse): Result<com.ssbmax.shared.domain.model.interview.InterviewResponse> {
        updatedResponses += response
        return Result.success(response)
    }
    override suspend fun completeInterview(sessionId: String) = completeInterviewResult
    override suspend fun getResult(sessionId: String) = unused("getResult")
    override suspend fun getResultById(resultId: String) = getResultByIdResult
    override fun getUserResults(userId: String) = userResultsFlow
    override suspend fun getLatestResult(userId: String) = getLatestResultResult
    override suspend fun getInterviewStats(userId: String) = interviewStatsResult
    override suspend fun getRemainingInterviews(userId: String, mode: com.ssbmax.shared.domain.model.interview.InterviewMode) = unused("getRemainingInterviews")
}

/** [DomainLogger] already ships a reusable no-op double in commonMain — see [com.ssbmax.shared.domain.util.NoOpLogger]. */
typealias FakeLogger = com.ssbmax.shared.domain.util.NoOpLogger

/** Records what was logged, for tests asserting a specific warn/error path fired (e.g. Rule 12 fail-loud checks). */
class RecordingLogger : DomainLogger {
    data class Entry(val level: String, val tag: String, val message: String, val throwable: Throwable?)
    val entries = mutableListOf<Entry>()
    override fun d(tag: String, message: String) { entries += Entry("d", tag, message, null) }
    override fun e(tag: String, message: String, throwable: Throwable?) { entries += Entry("e", tag, message, throwable) }
    override fun w(tag: String, message: String) { entries += Entry("w", tag, message, null) }
    override fun i(tag: String, message: String) { entries += Entry("i", tag, message, null) }
    override fun v(tag: String, message: String) { entries += Entry("v", tag, message, null) }
}

/** Records what was tracked, for tests asserting a specific analytics event fired (Phase 7a). */
class RecordingAnalyticsTracker : com.ssbmax.shared.domain.util.AnalyticsTracker {
    data class Entry(val name: String, val params: Map<String, Any?>)
    val events = mutableListOf<Entry>()
    override fun trackEvent(name: String, params: Map<String, Any?>) { events += Entry(name, params) }
}

/**
 * Emits [values] back-to-back with no suspension between them, so a collector
 * that cancels its own coroutine after the first value (the GTO-pattern
 * "observe -> COMPLETED -> stop observing" ViewModels) still receives the
 * rest synchronously -- `Job.cancel()` doesn't take effect until the next
 * cancellable suspension point. Used by the Phase 3c (#16) regression-monitor
 * tests to deterministically reproduce the conflicting-snapshot race the
 * Android original guarded against.
 */
fun <T> sequentialFlow(vararg values: T): Flow<T> = object : Flow<T> {
    override suspend fun collect(collector: kotlinx.coroutines.flow.FlowCollector<T>) {
        for (value in values) collector.emit(value)
    }
}

fun testUser(
    id: String = "test-user-1",
    role: UserRole = UserRole.STUDENT
) = SSBMaxUser(
    id = id,
    email = "$id@example.com",
    displayName = "Test User",
    role = role
)

/**
 * Phase 1c (GTO/interview/study/instructor) additions below. Same
 * fail-loud-if-unstubbed pattern as [FakeSubmissionRepository]/[FakeGTORepository]
 * above -- covers only the members Phase 1c's ViewModels actually call.
 */

/** Fake for [com.ssbmax.shared.platform.tts.TTSService], used by [com.ssbmax.shared.presentation.interviewsession.InterviewSessionViewModel] (via `TTSManager`). */
class FakeTTSService : com.ssbmax.shared.platform.tts.TTSService {
    private val _events = kotlinx.coroutines.flow.MutableSharedFlow<com.ssbmax.shared.platform.tts.TTSService.TTSEvent>(extraBufferCapacity = 8)
    override val events: kotlinx.coroutines.flow.SharedFlow<com.ssbmax.shared.platform.tts.TTSService.TTSEvent> = _events
    val spoken = mutableListOf<String>()
    var releaseCalls = 0
    var stopCalls = 0
    private var ready = false
    private var speaking = false

    fun emitReady() { ready = true; _events.tryEmit(com.ssbmax.shared.platform.tts.TTSService.TTSEvent.Ready) }
    fun emitSpeechComplete() { speaking = false; _events.tryEmit(com.ssbmax.shared.platform.tts.TTSService.TTSEvent.SpeechComplete) }

    override suspend fun speak(text: String, flush: Boolean) { spoken += text; speaking = true }
    override fun stop() { stopCalls++; speaking = false }
    override fun release() { releaseCalls++ }
    override fun isReady(): Boolean = ready
    override fun isSpeaking(): Boolean = speaking
}

/** Fake for [com.ssbmax.shared.domain.model.interview.QuestionCacheRepository], used by [com.ssbmax.shared.presentation.interviewstart.StartInterviewViewModel]. */
class FakeQuestionCacheRepository : com.ssbmax.shared.domain.model.interview.QuestionCacheRepository {
    var piqQuestionsResult: Result<List<com.ssbmax.shared.domain.model.interview.InterviewQuestion>> = Result.success(emptyList())

    private fun unused(name: String): Nothing = error("FakeQuestionCacheRepository.$name not stubbed for this test")

    override suspend fun cachePIQQuestions(piqSnapshotId: String, questions: List<com.ssbmax.shared.domain.model.interview.InterviewQuestion>, expirationDays: Int) = unused("cachePIQQuestions")
    override suspend fun getPIQQuestions(piqSnapshotId: String, limit: Int, excludeUsed: Boolean) = piqQuestionsResult
    override suspend fun getGenericQuestions(targetOLQs: List<com.ssbmax.shared.domain.model.interview.OLQ>?, difficulty: Int?, limit: Int, excludeUsed: Boolean) = unused("getGenericQuestions")
    override suspend fun markQuestionUsed(questionId: String, sessionId: String) = unused("markQuestionUsed")
    override suspend fun cleanupExpired() = unused("cleanupExpired")
    override suspend fun getCacheStats(userId: String?) = unused("getCacheStats")
    override suspend fun invalidatePIQCache(piqSnapshotId: String) = unused("invalidatePIQCache")
}

/** Fake for [com.ssbmax.shared.domain.repository.TestProgressRepository], used by the Phase1/2 detail + StudentTests + Topic ViewModels. */
class FakeTestProgressRepository : com.ssbmax.shared.domain.repository.TestProgressRepository {
    var phase1Flow: Flow<com.ssbmax.shared.domain.model.Phase1Progress> = flowOf(
        com.ssbmax.shared.domain.model.Phase1Progress(
            oirProgress = com.ssbmax.shared.domain.model.TestProgress(TestType.OIR),
            ppdtProgress = com.ssbmax.shared.domain.model.TestProgress(TestType.PPDT)
        )
    )
    var phase2Flow: Flow<com.ssbmax.shared.domain.model.Phase2Progress> = flowOf(
        com.ssbmax.shared.domain.model.Phase2Progress(
            psychologyProgress = com.ssbmax.shared.domain.model.TestProgress(TestType.TAT),
            gtoProgress = com.ssbmax.shared.domain.model.TestProgress(TestType.GTO_GD),
            interviewProgress = com.ssbmax.shared.domain.model.TestProgress(TestType.IO)
        )
    )

    override fun getPhase1Progress(userId: String) = phase1Flow
    override fun getPhase2Progress(userId: String) = phase2Flow
}

/** Fake for [com.ssbmax.shared.domain.repository.NotificationRepository], used by [com.ssbmax.shared.presentation.notifications.NotificationCenterViewModel]. */
class FakeNotificationRepository : com.ssbmax.shared.domain.repository.NotificationRepository {
    var notificationsFlow: Flow<List<SSBMaxNotification>> = flowOf(emptyList())
    var unreadCountFlow: Flow<Int> = flowOf(0)
    var markAsReadResult: Result<Unit> = Result.success(Unit)
    var deleteResult: Result<Unit> = Result.success(Unit)
    var saveNotificationResult: Result<Unit> = Result.success(Unit)
    var preferencesResult: Result<com.ssbmax.shared.domain.model.NotificationPreferences> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var savePreferencesResult: Result<Unit> = Result.success(Unit)
    val markedRead = mutableListOf<String>()
    val deleted = mutableListOf<String>()
    val savedNotifications = mutableListOf<SSBMaxNotification>()
    val savedPreferences = mutableListOf<com.ssbmax.shared.domain.model.NotificationPreferences>()

    private fun unused(name: String): Nothing = error("FakeNotificationRepository.$name not stubbed for this test")

    override suspend fun saveFCMToken(token: com.ssbmax.shared.domain.model.FCMToken) = unused("saveFCMToken")
    override suspend fun getFCMToken(userId: String, deviceId: String) = unused("getFCMToken")
    override suspend fun deleteFCMToken(userId: String, deviceId: String) = unused("deleteFCMToken")
    override suspend fun saveNotification(notification: SSBMaxNotification): Result<Unit> {
        savedNotifications += notification
        return saveNotificationResult
    }
    override fun getNotifications(userId: String) = notificationsFlow
    override fun getUnreadCount(userId: String) = unreadCountFlow
    override suspend fun markAsRead(notificationId: String): Result<Unit> {
        markedRead += notificationId
        return markAsReadResult
    }
    override suspend fun markAllAsRead(userId: String) = unused("markAllAsRead")
    override suspend fun deleteNotification(notificationId: String): Result<Unit> {
        deleted += notificationId
        return deleteResult
    }
    override suspend fun getPreferences(userId: String) = preferencesResult
    override suspend fun savePreferences(preferences: com.ssbmax.shared.domain.model.NotificationPreferences): Result<Unit> {
        savedPreferences += preferences
        return savePreferencesResult
    }
}

/** Fake for [com.ssbmax.shared.domain.repository.StudyContentRepository], used by [com.ssbmax.shared.presentation.topic.TopicViewModel] and study use cases. */
class FakeStudyContentRepository : com.ssbmax.shared.domain.repository.StudyContentRepository {
    // Interface declares `Result<Any>` (non-null) -- `Unit` stands in as a benign non-null
    // default payload since the interface's own comment says the `Any` is deliberately opaque.
    var topicContentFlow: Flow<Result<Any>> = flowOf(Result.success(Unit))
    var studyMaterialResult: Result<com.ssbmax.shared.domain.model.CloudStudyMaterial> =
        Result.success(com.ssbmax.shared.domain.model.CloudStudyMaterial(id = "mat-1", title = "Material"))

    private fun unused(name: String): Nothing = error("FakeStudyContentRepository.$name not stubbed for this test")

    override fun getTopicContent(topicType: String): Flow<Result<Any>> = topicContentFlow
    override suspend fun getStudyMaterials(topicType: String) = unused("getStudyMaterials")
    override suspend fun getStudyMaterial(materialId: String) = studyMaterialResult
    override suspend fun refreshContent(topicType: String) = unused("refreshContent")
}

/** Fake for [com.ssbmax.shared.domain.repository.StudyProgressRepository], used by [com.ssbmax.shared.presentation.study.StudyMaterialDetailViewModel]'s use cases. */
class FakeStudyProgressRepository : com.ssbmax.shared.domain.repository.StudyProgressRepository {
    var getProgressResult: Result<com.ssbmax.shared.domain.model.StudyProgress?> = Result.success(null)
    var saveProgressResult: Result<Unit> = Result.success(Unit)
    var startSessionResult: Result<com.ssbmax.shared.domain.model.StudySession> =
        Result.success(com.ssbmax.shared.domain.model.StudySession(id = "session-1", userId = "test-user-1", materialId = "mat-1", startedAt = 0L))
    var endSessionResult: Result<Unit> = Result.success(Unit)
    val savedProgress = mutableListOf<com.ssbmax.shared.domain.model.StudyProgress>()
    val endedSessions = mutableListOf<Pair<String, Float>>()

    private fun unused(name: String): Nothing = error("FakeStudyProgressRepository.$name not stubbed for this test")

    override fun observeProgress(userId: String, materialId: String) = unused("observeProgress")
    override suspend fun saveProgress(progress: com.ssbmax.shared.domain.model.StudyProgress): Result<Unit> {
        savedProgress += progress
        return saveProgressResult
    }
    override suspend fun getProgress(userId: String, materialId: String) = getProgressResult
    override suspend fun getAllProgress(userId: String) = unused("getAllProgress")
    override suspend fun deleteProgress(userId: String, materialId: String) = unused("deleteProgress")
    override suspend fun startSession(userId: String, materialId: String) = startSessionResult
    override suspend fun endSession(sessionId: String, progressIncrement: Float): Result<Unit> {
        endedSessions += sessionId to progressIncrement
        return endSessionResult
    }
    override suspend fun getActiveSession(userId: String) = unused("getActiveSession")
    override suspend fun getSessionsForMaterial(userId: String, materialId: String) = unused("getSessionsForMaterial")
}

/**
 * Sub-phase 1b additions (test-taking vertical's Submit*TestViewModel /
 * results-submissions vertical). [com.ssbmax.shared.domain.service.SubmissionAnalysisTrigger]
 * itself is already faked above as `FakeSubmissionAnalysisTrigger` (added
 * concurrently by sub-phase 1c, records calls in `triggered`) -- reused as-is
 * here rather than adding a second implementation of the same interface.
 */

/** Covers only the members [com.ssbmax.shared.presentation.grading.TestDetailGradingViewModel] calls. */
class FakeTestSubmissionRepository : com.ssbmax.shared.domain.repository.TestSubmissionRepository {
    var getSubmissionByIdResult: Result<com.ssbmax.shared.domain.model.TestSubmission> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var updateSubmissionResult: Result<Unit> = Result.success(Unit)
    val updatedSubmissions = mutableListOf<com.ssbmax.shared.domain.model.TestSubmission>()

    private fun unused(name: String): Nothing = error("FakeTestSubmissionRepository.$name not stubbed for this test")

    override suspend fun getSubmissionById(submissionId: String) = getSubmissionByIdResult
    override fun getSubmissionsForStudent(studentId: String) = unused("getSubmissionsForStudent")
    override fun getPendingSubmissions(assessorId: String) = unused("getPendingSubmissions")
    override suspend fun submitTest(submission: com.ssbmax.shared.domain.model.TestSubmission): Result<Unit> = unused("submitTest")
    override suspend fun updateSubmission(submission: com.ssbmax.shared.domain.model.TestSubmission): Result<Unit> {
        updatedSubmissions += submission
        return updateSubmissionResult
    }
    override suspend fun deleteSubmission(submissionId: String): Result<Unit> = unused("deleteSubmission")
}

/**
 * Covers what [com.ssbmax.shared.presentation.instructorgrading.InstructorGradingViewModel] and
 * [com.ssbmax.shared.presentation.home.instructor.InstructorHomeViewModel] each call.
 */
class FakeGradingQueueRepository : com.ssbmax.shared.domain.repository.GradingQueueRepository {
    var pendingSubmissionsFlow: Flow<List<com.ssbmax.shared.domain.model.GradingQueueItem>> = flowOf(emptyList())
    var submissionsByTestTypeFlow: Flow<List<com.ssbmax.shared.domain.model.GradingQueueItem>> = flowOf(emptyList())
    var gradingStatsFlow: Flow<com.ssbmax.shared.domain.model.InstructorGradingStats> = flowOf(
        com.ssbmax.shared.domain.model.InstructorGradingStats(
            totalPending = 0,
            totalGraded = 0,
            averageGradingTimeMinutes = 0,
            todayGraded = 0,
            weekGraded = 0,
            pendingByTestType = emptyMap(),
            averageScoreGiven = 0f
        )
    )

    private fun unused(name: String): Nothing = error("FakeGradingQueueRepository.$name not stubbed for this test")

    override fun observePendingSubmissions(instructorId: String) = pendingSubmissionsFlow
    override fun observeSubmissionsByTestType(testType: TestType) = submissionsByTestTypeFlow
    override fun observeSubmissionsByBatch(batchId: String) = unused("observeSubmissionsByBatch")
    override fun observeGradingStats(instructorId: String) = gradingStatsFlow
    override suspend fun markSubmissionUnderReview(submissionId: String, instructorId: String) = unused("markSubmissionUnderReview")
    override suspend fun releaseSubmissionFromReview(submissionId: String) = unused("releaseSubmissionFromReview")
}

/** Covers only the members [com.ssbmax.shared.presentation.analytics.AnalyticsViewModel] calls. */
class FakeAnalyticsRepository : com.ssbmax.shared.domain.repository.AnalyticsRepository {
    var performanceOverviewFlow: Flow<com.ssbmax.shared.domain.model.PerformanceOverview?> = flowOf(null)
    var testTypeStatsFlow: Flow<com.ssbmax.shared.domain.model.TestTypeStats?> = flowOf(null)
    var allTestTypeStatsFlow: Flow<List<com.ssbmax.shared.domain.model.TestTypeStats>> = flowOf(emptyList())
    var recentProgressFlow: Flow<List<com.ssbmax.shared.domain.model.TestPerformancePoint>> = flowOf(emptyList())

    private fun unused(name: String): Nothing = error("FakeAnalyticsRepository.$name not stubbed for this test")

    override fun getPerformanceOverview() = performanceOverviewFlow
    override fun getTestTypeStats(testType: String) = testTypeStatsFlow
    override fun getAllTestTypeStats() = allTestTypeStatsFlow
    override fun getRecentProgress(limit: Int) = recentProgressFlow
    override suspend fun getDifficultyStats(testType: String, difficulty: String) = unused("getDifficultyStats")
    override suspend fun getProgressionStatus(testType: String) = unused("getProgressionStatus")
    override suspend fun getStudyPattern() = unused("getStudyPattern")
    override fun getAchievements() = unused("getAchievements")
    override fun getGoalProgress() = unused("getGoalProgress")
}

/**
 * Sub-phase 1a additions (auth/home/profile/settings vertical).
 *
 * [FakeTestProgressRepository] and [FakeNotificationRepository] above (added
 * concurrently by sub-phase 1c) already cover
 * [com.ssbmax.shared.presentation.home.student.StudentHomeViewModel]'s and
 * [com.ssbmax.shared.presentation.profile.StudentProfileViewModel]'s needs
 * (`getPhase1Progress`/`getPhase2Progress`/`getUnreadCount`) directly -- reused
 * as-is, no new fake needed for those two interfaces.
 *
 * [com.ssbmax.shared.presentation.settings.notifications.NotificationSettingsViewModel]
 * needs `getPreferences`/`savePreferences` -- already covered by
 * [FakeNotificationRepository] via `unused()`-overridable fields if a future test
 * stubs them (none did yet; consolidated here during Phase 1's tech-debt sweep,
 * this file previously had two more single-purpose duplicates of the same
 * interface that were never actually used by any test).
 */

/**
 * Trivial in-memory [com.russhwolf.settings.Settings] impl for
 * characterization-testing [com.ssbmax.shared.platform.settings.AppThemeSettings]
 * (used by [com.ssbmax.shared.presentation.settings.theme.ThemeSettingsViewModel]).
 * No `multiplatform-settings-test`/`MapSettings` artifact is on this module's
 * commonTest classpath (checked `shared/build.gradle.kts` and
 * `gradle/libs.versions.toml` before writing this -- neither declares it), and
 * `Settings` (not `ObservableSettings`) is a small-enough interface that adding
 * a new Gradle dependency for one fake isn't warranted.
 */
class FakeSettings : com.russhwolf.settings.Settings {
    private val map = mutableMapOf<String, Any?>()

    override val keys: Set<String> get() = map.keys
    override val size: Int get() = map.size
    override fun clear() { map.clear() }
    override fun remove(key: String) { map.remove(key) }
    override fun hasKey(key: String) = map.containsKey(key)

    override fun putInt(key: String, value: Int) { map[key] = value }
    override fun getInt(key: String, defaultValue: Int) = map[key] as? Int ?: defaultValue
    override fun getIntOrNull(key: String) = map[key] as? Int

    override fun putLong(key: String, value: Long) { map[key] = value }
    override fun getLong(key: String, defaultValue: Long) = map[key] as? Long ?: defaultValue
    override fun getLongOrNull(key: String) = map[key] as? Long

    override fun putString(key: String, value: String) { map[key] = value }
    override fun getString(key: String, defaultValue: String) = map[key] as? String ?: defaultValue
    override fun getStringOrNull(key: String) = map[key] as? String

    override fun putFloat(key: String, value: Float) { map[key] = value }
    override fun getFloat(key: String, defaultValue: Float) = map[key] as? Float ?: defaultValue
    override fun getFloatOrNull(key: String) = map[key] as? Float

    override fun putDouble(key: String, value: Double) { map[key] = value }
    override fun getDouble(key: String, defaultValue: Double) = map[key] as? Double ?: defaultValue
    override fun getDoubleOrNull(key: String) = map[key] as? Double

    override fun putBoolean(key: String, value: Boolean) { map[key] = value }
    override fun getBoolean(key: String, defaultValue: Boolean) = map[key] as? Boolean ?: defaultValue
    override fun getBooleanOrNull(key: String) = map[key] as? Boolean
}

/**
 * Fake for [com.ssbmax.shared.platform.worker.BackgroundTaskScheduler], used by
 * [com.ssbmax.shared.presentation.piq.PIQTestViewModel] (Phase 8, KMP-convergence plan).
 */
class FakeBackgroundTaskScheduler : com.ssbmax.shared.platform.worker.BackgroundTaskScheduler {
    var cleanupScheduled = false
    var archivalScheduled = false
    val questionGenerationRequests = mutableListOf<String>()

    override fun scheduleQuestionCacheCleanup() { cleanupScheduled = true }
    override fun scheduleSubmissionArchival() { archivalScheduled = true }
    override fun scheduleInterviewQuestionGeneration(piqSubmissionId: String) {
        questionGenerationRequests += piqSubmissionId
    }
}

/** Fake for [com.ssbmax.shared.domain.repository.OirResultRepository], used by [com.ssbmax.shared.presentation.oirresult.OirResultViewModel] via `GetOirResultUseCase`. */
class FakeOirResultRepository : com.ssbmax.shared.domain.repository.OirResultRepository {
    var oirResult: Result<com.ssbmax.shared.domain.model.OIRTestResult?> = Result.success(null)
    var lastRequestedSubmissionId: String? = null

    override suspend fun getOirResult(submissionId: String): Result<com.ssbmax.shared.domain.model.OIRTestResult?> {
        lastRequestedSubmissionId = submissionId
        return oirResult
    }
}

/**
 * Fake for [com.ssbmax.shared.domain.service.AIService], used by Phase 8 (KMP-convergence plan)
 * `shared/analysis`'s Orchestrator characterization tests. Every `analyze*` method shares one
 * [responseAnalysisResult] by default (all return the same [ResponseAnalysis] shape) since the
 * orchestrators under test don't care which Gemini endpoint answered -- override the specific
 * `var` a test needs to fail one call while others succeed.
 */
open class FakeAIService : com.ssbmax.shared.domain.service.AIService {
    var responseAnalysisResult: Result<com.ssbmax.shared.domain.service.ResponseAnalysis> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var piqQuestionsResult: Result<List<com.ssbmax.shared.domain.model.interview.InterviewQuestion>> =
        Result.failure(UnsupportedOperationException("not stubbed"))
    var isAvailableResult: Boolean = true
    val recordedPrompts = mutableListOf<String>()

    override suspend fun generatePIQBasedQuestions(
        piqData: String,
        targetOLQs: List<com.ssbmax.shared.domain.model.interview.OLQ>?,
        count: Int,
        difficulty: Int
    ) = piqQuestionsResult

    override suspend fun generateAdaptiveQuestions(
        previousQuestions: List<com.ssbmax.shared.domain.model.interview.InterviewQuestion>,
        previousResponses: List<String>,
        weakOLQs: List<com.ssbmax.shared.domain.model.interview.OLQ>,
        count: Int
    ) = Result.failure<List<com.ssbmax.shared.domain.model.interview.InterviewQuestion>>(UnsupportedOperationException("not stubbed"))

    override suspend fun analyzeResponse(
        question: com.ssbmax.shared.domain.model.interview.InterviewQuestion,
        response: String,
        responseMode: String
    ) = responseAnalysisResult

    override suspend fun generateFeedback(
        questions: List<com.ssbmax.shared.domain.model.interview.InterviewQuestion>,
        responses: List<String>,
        olqScores: Map<com.ssbmax.shared.domain.model.interview.OLQ, Float>
    ) = Result.failure<String>(UnsupportedOperationException("not stubbed"))

    override suspend fun analyzeGTOResponse(
        prompt: String,
        testType: com.ssbmax.shared.domain.model.gto.GTOTestType
    ): Result<com.ssbmax.shared.domain.service.ResponseAnalysis> {
        recordedPrompts += prompt
        return responseAnalysisResult
    }

    override suspend fun analyzeTATResponse(prompt: String): Result<com.ssbmax.shared.domain.service.ResponseAnalysis> {
        recordedPrompts += prompt
        return responseAnalysisResult
    }

    override suspend fun analyzeWATResponse(prompt: String): Result<com.ssbmax.shared.domain.service.ResponseAnalysis> {
        recordedPrompts += prompt
        return responseAnalysisResult
    }

    override suspend fun analyzeSRTResponse(prompt: String): Result<com.ssbmax.shared.domain.service.ResponseAnalysis> {
        recordedPrompts += prompt
        return responseAnalysisResult
    }

    override suspend fun analyzeSDResponse(prompt: String): Result<com.ssbmax.shared.domain.service.ResponseAnalysis> {
        recordedPrompts += prompt
        return responseAnalysisResult
    }

    override suspend fun analyzePPDTMultimodal(
        imageBytes: ByteArray,
        story: String,
        imageContext: com.ssbmax.shared.domain.model.PPDTImageContext,
        candidateGender: String
    ) = responseAnalysisResult

    override suspend fun analyzeTATStoryMultimodal(
        imageBytes: ByteArray,
        story: String,
        imageContext: com.ssbmax.shared.domain.model.TATImageContext,
        candidateGender: String,
        storyIndex: Int,
        totalStories: Int,
        imageGenderTag: String
    ) = responseAnalysisResult

    override suspend fun isAvailable() = isAvailableResult
}
