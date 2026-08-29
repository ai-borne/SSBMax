package com.ssbmax.shared.domain.usecase.auth

import com.ssbmax.shared.domain.repository.AuthRepository

class CancelAccountDeletionUseCase constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(): Result<Unit> {
        return authRepository.cancelAccountDeletion()
    }
}
