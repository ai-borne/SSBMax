package com.ssbmax.shared.domain.usecase.auth

import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class CancelAccountDeletionUseCaseTest {

    @Test
    fun `delegates to repository and returns its result`() = runTest {
        val authRepository = FakeAuthRepository()
        authRepository.cancelAccountDeletionResult = Result.success(Unit)
        val useCase = CancelAccountDeletionUseCase(authRepository)

        val result = useCase()

        assertEquals(Result.success(Unit), result)
    }

    @Test
    fun `surfaces repository failure`() = runTest {
        val authRepository = FakeAuthRepository()
        val failure = Exception("already purged")
        authRepository.cancelAccountDeletionResult = Result.failure(failure)
        val useCase = CancelAccountDeletionUseCase(authRepository)

        val result = useCase()

        assertEquals(failure, result.exceptionOrNull())
    }
}
