package com.ssbmax.shared.domain.usecase.auth

import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class RequestAccountDeletionUseCaseTest {

    @Test
    fun `delegates to repository and returns its result`() = runTest {
        val authRepository = FakeAuthRepository()
        authRepository.requestAccountDeletionResult = Result.success(Unit)
        val useCase = RequestAccountDeletionUseCase(authRepository)

        val result = useCase()

        assertEquals(Result.success(Unit), result)
    }

    @Test
    fun `surfaces repository failure`() = runTest {
        val authRepository = FakeAuthRepository()
        val failure = Exception("network down")
        authRepository.requestAccountDeletionResult = Result.failure(failure)
        val useCase = RequestAccountDeletionUseCase(authRepository)

        val result = useCase()

        assertEquals(failure, result.exceptionOrNull())
    }
}
