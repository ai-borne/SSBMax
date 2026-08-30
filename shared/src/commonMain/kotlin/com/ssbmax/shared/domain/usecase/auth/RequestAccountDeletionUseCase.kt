package com.ssbmax.shared.domain.usecase.auth

import com.ssbmax.shared.domain.repository.AuthRepository

class RequestAccountDeletionUseCase constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(): Result<Unit> {
        return authRepository.requestAccountDeletion()
    }
}
