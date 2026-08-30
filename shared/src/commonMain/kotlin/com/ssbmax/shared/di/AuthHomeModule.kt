package com.ssbmax.shared.di

import com.ssbmax.shared.domain.usecase.GetOirResultUseCase
import com.ssbmax.shared.domain.usecase.auth.CancelAccountDeletionUseCase
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.auth.RequestAccountDeletionUseCase
import com.ssbmax.shared.domain.usecase.auth.SignInWithGoogleUseCase
import com.ssbmax.shared.domain.usecase.auth.SignOutUseCase
import com.ssbmax.shared.domain.usecase.auth.UpdateUserRoleUseCase
import com.ssbmax.shared.domain.usecase.dashboard.GetOLQDashboardUseCase
import com.ssbmax.shared.presentation.auth.AuthViewModel
import com.ssbmax.shared.presentation.home.instructor.InstructorHomeViewModel
import com.ssbmax.shared.presentation.home.student.StudentHomeViewModel
import com.ssbmax.shared.presentation.oirresult.OirResultViewModel
import com.ssbmax.shared.presentation.splash.SplashViewModel
import org.koin.core.module.dsl.factoryOf
import org.koin.core.module.dsl.viewModelOf
import org.koin.dsl.module

/**
 * Auth + Splash + Home vertical. All repository dependencies come from
 * [repositoryModule]. Split out of the former monolithic `SharedModule.kt` —
 * see [repositoryModule]'s doc comment for why.
 *
 * [StudentHomeViewModel]/[InstructorHomeViewModel]'s constructor dependencies
 * (`UserProfileRepository`, `TestProgressRepository`, `NotificationRepository`,
 * `GradingQueueRepository`) used to also be shadow-bound by `core:data`'s
 * Android-only `repositoryModule` — closed sub-phase by sub-phase across
 * Phases 9a-9c, `core:data` itself deleted in Phase 9f. [repositoryModule]'s
 * `GitLive*` bindings are now the sole source for all four.
 */
val authHomeModule = module {
    factoryOf(::SignInWithGoogleUseCase)
    factoryOf(::UpdateUserRoleUseCase)
    factoryOf(::SignOutUseCase)
    factoryOf(::RequestAccountDeletionUseCase)
    factoryOf(::CancelAccountDeletionUseCase)
    factoryOf(::ObserveCurrentUserUseCase)
    factoryOf(::GetOirResultUseCase)
    factoryOf(::GetOLQDashboardUseCase)

    viewModelOf(::AuthViewModel)
    viewModelOf(::OirResultViewModel)
    viewModelOf(::SplashViewModel)
    viewModelOf(::StudentHomeViewModel)
    viewModelOf(::InstructorHomeViewModel)
}
