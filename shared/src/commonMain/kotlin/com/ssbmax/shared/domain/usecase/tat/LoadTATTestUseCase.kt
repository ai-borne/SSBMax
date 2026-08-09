package com.ssbmax.shared.domain.usecase.tat

import com.ssbmax.shared.domain.model.Gender
import com.ssbmax.shared.domain.model.GenderTag
import com.ssbmax.shared.domain.model.TATQuestion
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first

/** @param sessionId The durable `test_sessions` doc id, returned so the caller can later
 *    complete/abandon it -- see [com.ssbmax.shared.presentation.tat.TATTestViewModel]. */
data class LoadTATTestResult(
    val sessionId: String,
    val questions: List<TATQuestion>
)

class LoadTATTestUseCase constructor(
    private val testContentRepository: TestContentRepository,
    private val testSessionRepository: TestSessionRepository,
    private val userProfileRepository: UserProfileRepository
) {
    class ProfileIncompleteException : Exception("User profile is incomplete or not found")

    suspend operator fun invoke(userId: String, testId: String): Result<LoadTATTestResult> = runCatching {
        val profileResult = userProfileRepository.getUserProfile(userId).first()
        if (profileResult.isSuccess && profileResult.getOrNull() == null) {
            throw ProfileIncompleteException()
        }
        val genderTag = profileResult.getOrNull()?.let { profile ->
            when (profile.gender) {
                Gender.MALE -> GenderTag.MALE
                Gender.FEMALE -> GenderTag.FEMALE
                else -> null
            }
        }
        val sessionId = testSessionRepository.createTestSession(userId, testId, TestType.TAT).getOrThrow()
        // Release the session again if the question fetch fails: otherwise the test_sessions doc
        // is left ACTIVE for a test the candidate never entered, corrupting the audit trail and
        // making hasActiveTestSession lie. Mirrors OIRTestViewModel.loadTest's cleanup.
        val questions = try {
            testContentRepository.getTATQuestions(testId, genderTag).getOrThrow()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            testSessionRepository.abandonTestSession(sessionId)
            throw e
        }
        LoadTATTestResult(sessionId, questions)
    }
}
