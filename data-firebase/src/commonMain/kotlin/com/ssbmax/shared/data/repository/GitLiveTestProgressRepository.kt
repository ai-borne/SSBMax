package com.ssbmax.shared.data.repository

import com.ssbmax.shared.domain.model.Phase1Progress
import com.ssbmax.shared.domain.model.Phase2Progress
import com.ssbmax.shared.domain.model.TestProgress
import com.ssbmax.shared.domain.model.TestStatus
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.TestProgressRepository
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable

/**
 * GitLive-Firebase-backed port of the Android TestProgressRepositoryImpl.
 * Same "submissions" collection and same aggregation rules (latest submission
 * per test type, psychology tests TAT/WAT/SRT/SD grouped into one representative
 * progress entry); uses Query.snapshots (a Flow) in place of the Android SDK's
 * addSnapshotListener/callbackFlow, same as the other GitLive*Repository ports.
 *
 * [getPhase1Progress]/[getPhase2Progress] deliberately do NOT catch-and-emit a
 * default on listener errors (an earlier version did) -- the Android original's
 * `addSnapshotListener` closes the flow with the error (`close(error)`), and
 * both `Phase1DetailViewModel`/`Phase2DetailViewModel` already have their own
 * `.catch { }` expecting to see it and show a real error state. Swallowing it
 * here made that ViewModel code unreachable and showed "not attempted" for
 * what was actually a permission/network failure.
 */
class GitLiveTestProgressRepository : TestProgressRepository {

    private val submissionsCollection = Firebase.firestore.collection(SUBMISSIONS_COLLECTION)

    override fun getPhase1Progress(userId: String): Flow<Phase1Progress> =
        submissionsCollection
            .where { "userId" equalTo userId }
            .where { "testType" inArray listOf("OIR", "PPDT") }
            .orderBy("submittedAt", Direction.DESCENDING)
            .snapshots
            .map { snapshot ->
                val submissions = snapshot.documents.mapNotNull { doc ->
                    runCatching { doc.data(SubmissionProgressDto.serializer()) }.getOrNull()
                }

                val oirSubmission = submissions.firstOrNull { it.testType == "OIR" }
                val ppdtSubmission = submissions.firstOrNull { it.testType == "PPDT" }

                Phase1Progress(
                    oirProgress = createTestProgress(TestType.OIR, oirSubmission),
                    ppdtProgress = createTestProgress(TestType.PPDT, ppdtSubmission)
                )
            }

    override fun getPhase2Progress(userId: String): Flow<Phase2Progress> =
        submissionsCollection
            .where { "userId" equalTo userId }
            .where { "testType" inArray listOf("TAT", "WAT", "SRT", "SD", "GTO", "IO") }
            .orderBy("submittedAt", Direction.DESCENDING)
            .snapshots
            .map { snapshot ->
                val submissions = snapshot.documents.mapNotNull { doc ->
                    runCatching { doc.data(SubmissionProgressDto.serializer()) }.getOrNull()
                }

                val psychologySubmissions = submissions.filter {
                    it.testType in listOf("TAT", "WAT", "SRT", "SD")
                }
                val mostRecentPsychology = psychologySubmissions.maxByOrNull { it.submittedAt }

                val gtoSubmission = submissions.firstOrNull { it.testType == "GTO" }
                val interviewSubmission = submissions.firstOrNull { it.testType == "IO" }

                Phase2Progress(
                    psychologyProgress = createTestProgress(
                        TestType.TAT,
                        mostRecentPsychology
                    ),
                    gtoProgress = createTestProgress(TestType.GTO_GD, gtoSubmission),
                    interviewProgress = createTestProgress(TestType.IO, interviewSubmission)
                )
            }

    private fun createTestProgress(
        testType: TestType,
        submission: SubmissionProgressDto?
    ): TestProgress {
        if (submission == null) {
            return TestProgress(testType = testType, status = TestStatus.NOT_ATTEMPTED)
        }

        return TestProgress(
            testType = testType,
            status = submissionStatusToTestStatus(submission.status),
            lastAttemptDate = submission.submittedAt,
            latestScore = submission.score,
            isPendingReview = submission.status == "SUBMITTED_PENDING_REVIEW",
            isAnalysisPending = submission.analysisStatus in ANALYSIS_PENDING_STATUSES ||
                submission.status in ANALYSIS_PENDING_STATUSES
        )
    }

    private companion object {
        const val SUBMISSIONS_COLLECTION = "submissions"
        val ANALYSIS_PENDING_STATUSES = setOf("PENDING_ANALYSIS", "ANALYZING")
    }
}

@Serializable
internal data class SubmissionProgressDto(
    val testType: String = "",
    val status: String = "",
    val submittedAt: Long = 0L,
    val score: Float? = null,
    // TAT/psychology analysis state is stored inside the shared `data` envelope.
    val data: SubmissionProgressDataDto = SubmissionProgressDataDto()
) {
    val analysisStatus: String?
        get() = data.analysisStatus
}

@Serializable
internal data class SubmissionProgressDataDto(
    val analysisStatus: String? = null
)

/**
 * Unknown/legacy status strings default to NOT_ATTEMPTED rather than throwing,
 * same defensive behavior as the Android original's `when` fallback.
 */
internal fun submissionStatusToTestStatus(status: String): TestStatus = when (status) {
    "SUBMITTED_PENDING_REVIEW", "PENDING_ANALYSIS", "ANALYZING" -> TestStatus.SUBMITTED_PENDING_REVIEW
    "GRADED" -> TestStatus.GRADED
    "COMPLETED" -> TestStatus.COMPLETED
    else -> TestStatus.NOT_ATTEMPTED
}
