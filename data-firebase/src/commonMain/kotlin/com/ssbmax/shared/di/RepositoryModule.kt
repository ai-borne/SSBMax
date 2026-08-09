package com.ssbmax.shared.di

import com.ssbmax.shared.data.repository.DebugOverrideSubscriptionRepository
import com.ssbmax.shared.data.repository.DebugOverrideTestUsageRecorder
import com.ssbmax.shared.data.repository.GitLiveAnalyticsRepository
import com.ssbmax.shared.data.repository.GitLiveAuthRepository
import com.ssbmax.shared.data.repository.GitLiveDifficultyProgressionManager
import com.ssbmax.shared.data.repository.GitLiveGPEImageCacheManager
import com.ssbmax.shared.data.repository.GitLiveGradingQueueRepository
import com.ssbmax.shared.data.repository.GitLiveGTOCollections
import com.ssbmax.shared.data.repository.GitLiveGTOProgressDelegate
import com.ssbmax.shared.data.repository.GitLiveGTORepository
import com.ssbmax.shared.data.repository.GitLiveGTOResultsDelegate
import com.ssbmax.shared.data.repository.GitLiveGTOSubmissionDelegate
import com.ssbmax.shared.data.repository.GitLiveGTOTaskCacheManager
import com.ssbmax.shared.data.repository.GitLiveInterviewRepository
import com.ssbmax.shared.data.repository.GitLiveNotificationCacheManager
import com.ssbmax.shared.data.repository.GitLiveNotificationRepository
import com.ssbmax.shared.data.repository.GitLiveOirResultRepository
import com.ssbmax.shared.data.repository.GitLiveOIRQuestionCacheManager
import com.ssbmax.shared.data.repository.GitLiveOIRQuestionSelector
import com.ssbmax.shared.data.repository.GitLivePPDTImageCacheManager
import com.ssbmax.shared.data.repository.GitLiveQuestionCacheRepository
import com.ssbmax.shared.data.repository.GitLiveSRTSituationCacheManager
import com.ssbmax.shared.data.repository.GitLiveStudyContentRepository
import com.ssbmax.shared.data.repository.GitLiveStudyProgressRepository
import com.ssbmax.shared.data.repository.GitLiveSubmissionRepository
import com.ssbmax.shared.data.repository.GitLiveSubscriptionRepository
import com.ssbmax.shared.data.repository.GitLiveTATImageCacheManager
import com.ssbmax.shared.data.repository.GitLiveTestContentRepository
import com.ssbmax.shared.data.repository.GitLiveTestProgressRepository
import com.ssbmax.shared.data.repository.GitLiveTestRepository
import com.ssbmax.shared.data.repository.GitLiveTestSessionRepository
import com.ssbmax.shared.data.repository.GitLiveTestSubmissionRepository
import com.ssbmax.shared.data.repository.GitLiveTestUsageRecorder
import com.ssbmax.shared.data.repository.GitLiveUnifiedResultRepository
import com.ssbmax.shared.data.repository.GitLiveUserProfileRepository
import com.ssbmax.shared.data.repository.GitLiveUserRepository
import com.ssbmax.shared.data.repository.GitLiveWATWordCacheManager
import com.ssbmax.shared.data.repository.InterviewQuestionGenerator
import com.ssbmax.shared.domain.model.interview.QuestionCacheRepository
import com.ssbmax.shared.domain.repository.AnalyticsRepository
import com.ssbmax.shared.domain.repository.AuthRepository
import com.ssbmax.shared.domain.repository.DifficultyProgressionRepository
import com.ssbmax.shared.domain.repository.GradingQueueRepository
import com.ssbmax.shared.domain.repository.GTORepository
import com.ssbmax.shared.domain.repository.InterviewRepository
import com.ssbmax.shared.domain.repository.NotificationRepository
import com.ssbmax.shared.domain.repository.OirResultRepository
import com.ssbmax.shared.domain.repository.StudyContentRepository
import com.ssbmax.shared.domain.repository.StudyProgressRepository
import com.ssbmax.shared.domain.repository.SubmissionRepository
import com.ssbmax.shared.domain.repository.SubscriptionRepository
import com.ssbmax.shared.domain.repository.TestContentRepository
import com.ssbmax.shared.domain.repository.TestProgressRepository
import com.ssbmax.shared.domain.repository.TestRepository
import com.ssbmax.shared.domain.repository.TestSessionRepository
import com.ssbmax.shared.domain.repository.TestSubmissionRepository
import com.ssbmax.shared.domain.repository.TestUsageRecorder
import com.ssbmax.shared.domain.repository.UnifiedResultRepository
import com.ssbmax.shared.domain.repository.UserProfileRepository
import com.ssbmax.shared.platform.isDebugBuild
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.bind
import org.koin.dsl.module

/**
 * All GitLive-Firebase-backed repository and SQLDelight cache-manager bindings,
 * shared across every vertical module below. Split out of the former
 * monolithic `SharedModule.kt` (which grew to 565 lines across Phase 5's many
 * sessions) purely to bring the DI graph back under the repo's 300-line
 * Quality Limit — zero behavior change.
 *
 * As of Phase 9e (KMP-convergence plan), every repository this module binds is single-sourced —
 * `core:data`'s own `repositoryModule` was empty (its last 3 shadow bindings,
 * `SubmissionRepository`/`TestSessionRepository`/`TestSubmissionRepository`, closed that phase),
 * and `core:data` itself was deleted outright in Phase 9f. These `GitLive*` implementations are
 * the sole binding on both Android and iOS. See git history (Phase 5 sessions, pre-split; Phase
 * 9a-9e for each repository's individual closure) for the full per-repository rationale.
 */
val repositoryModule = module {
    single<CoroutineScope> { CoroutineScope(SupervisorJob() + Dispatchers.Default) }
    // GitLiveAuthRepository's userRepository constructor param has a Kotlin default
    // value (= GitLiveUserRepository()), but singleOf's reflection-based DSL ignores
    // Kotlin default parameters and always resolves every constructor param through
    // Koin -- so this binding is required, not optional, despite the default value
    // suggesting otherwise. Discovered via a real iOS launch crash
    // (NoDefinitionFoundException); at the time, Android didn't hit it because
    // core:data's (now-deleted, KMP-convergence Phase 9f) AuthRepositoryImpl
    // shadow-overrode AuthRepository there, so GitLiveAuthRepository itself was never
    // actually constructed on that platform. The binding stays required today
    // regardless -- this reflection behavior of singleOf is platform-independent.
    singleOf(::GitLiveUserRepository)
    singleOf(::GitLiveAuthRepository) bind AuthRepository::class
    singleOf(::GitLiveOirResultRepository) bind OirResultRepository::class
    singleOf(::GitLiveUserProfileRepository) bind UserProfileRepository::class
    // Phase 3/4 (KMP-convergence plan): wraps the real repository in the dev-tier-override
    // decorator only when isDebugBuild() -- fail-closed, since isDebugBuild() is false in every
    // release binary, so DebugOverrideSubscriptionRepository is never even constructed there.
    // Nothing else constructs GitLiveSubscriptionRepository() directly, so this one seam covers
    // every caller (CheckTestEligibilityUseCase, GetSubscriptionTierUseCase,
    // CheckInterviewPrerequisitesUseCase, SubscriptionManagementViewModel, UpgradeViewModel) with
    // zero edits at those call sites.
    single<SubscriptionRepository> {
        val plain = GitLiveSubscriptionRepository()
        if (isDebugBuild()) DebugOverrideSubscriptionRepository(plain, get()) else plain
    }
    singleOf(::GitLiveTestProgressRepository) bind TestProgressRepository::class
    singleOf(::GitLiveStudyProgressRepository) bind StudyProgressRepository::class
    singleOf(::GitLiveGradingQueueRepository) bind GradingQueueRepository::class
    singleOf(::GitLiveQuestionCacheRepository) bind QuestionCacheRepository::class
    singleOf(::GitLiveTestRepository) bind TestRepository::class
    singleOf(::GitLiveAnalyticsRepository) bind AnalyticsRepository::class
    singleOf(::GitLiveStudyContentRepository) bind StudyContentRepository::class
    singleOf(::GitLiveDifficultyProgressionManager) bind DifficultyProgressionRepository::class
    single { GitLiveGTOTaskCacheManager(get()) }
    single { GitLiveWATWordCacheManager(get()) }
    single { GitLiveGPEImageCacheManager(get()) }
    single { GitLivePPDTImageCacheManager(get()) }
    single { GitLiveSRTSituationCacheManager(get()) }
    single { GitLiveTATImageCacheManager(get()) }
    single { GitLiveOIRQuestionSelector(get()) }
    single { GitLiveOIRQuestionCacheManager(get(), get(), get()) }
    single { GitLiveNotificationCacheManager(get()) }
    singleOf(::GitLiveTestContentRepository) bind TestContentRepository::class
    single { GitLiveGTOCollections() }
    single { GitLiveGTOSubmissionDelegate(get()) }
    single { GitLiveGTOProgressDelegate(get()) }
    single { GitLiveGTOResultsDelegate(get(), get()) }
    singleOf(::GitLiveGTORepository) bind GTORepository::class
    // Phase 7b (KMP-convergence plan): implemented and interface-complete
    // since Phase 5, but never bound here -- unresolvable via Koin on iOS
    // (no core:data shadow binding exists there). Both constructor deps
    // (InterviewRepository/GTORepository) are already bound above.
    singleOf(::GitLiveUnifiedResultRepository) bind UnifiedResultRepository::class
    singleOf(::GitLiveNotificationRepository) bind NotificationRepository::class
    single { GitLiveSubmissionRepository() } bind SubmissionRepository::class
    single { InterviewQuestionGenerator(get(), get(), get()) }
    singleOf(::GitLiveInterviewRepository) bind InterviewRepository::class
    singleOf(::GitLiveTestSessionRepository) bind TestSessionRepository::class
    // Same treatment as SubscriptionRepository above: fail-closed on isDebugBuild(), one seam
    // covers every recordTestUsage caller.
    single<TestUsageRecorder> {
        val plain = GitLiveTestUsageRecorder()
        if (isDebugBuild()) DebugOverrideTestUsageRecorder(plain, get()) else plain
    }
    singleOf(::GitLiveTestSubmissionRepository) bind TestSubmissionRepository::class
}
