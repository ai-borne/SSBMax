@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.study

import com.ssbmax.shared.domain.model.CloudStudyMaterial
import com.ssbmax.shared.domain.model.StudyProgress
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.usecase.study.GetStudyMaterialDetailUseCase
import com.ssbmax.shared.domain.usecase.study.GetStudyProgressUseCase
import com.ssbmax.shared.domain.usecase.study.SaveStudyProgressUseCase
import com.ssbmax.shared.domain.usecase.study.TrackStudySessionUseCase
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeStudyContentRepository
import com.ssbmax.shared.presentation.testing.FakeStudyProgressRepository
import com.ssbmax.shared.presentation.testing.testUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

/**
 * Characterization test for [StudyMaterialDetailViewModel], written retroactively
 * (13-VM gap-closing pass, see the KMP-convergence plan's Phase 1). Pins the
 * current content-load + progress-tracking behaviour. `endStudySession()`
 * deliberately stays public (see the ViewModel's own doc comment on why it's
 * called from the screen's `DisposableEffect` instead of `onCleared()`) --
 * tested here by calling it directly, per this session's own guidance.
 */
class StudyMaterialDetailViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var studyContentRepository: FakeStudyContentRepository
    private lateinit var studyProgressRepository: FakeStudyProgressRepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        studyContentRepository = FakeStudyContentRepository()
        studyProgressRepository = FakeStudyProgressRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = StudyMaterialDetailViewModel(
        getStudyMaterialDetail = GetStudyMaterialDetailUseCase(studyContentRepository),
        saveStudyProgress = SaveStudyProgressUseCase(studyProgressRepository),
        trackStudySession = TrackStudySessionUseCase(studyProgressRepository),
        getStudyProgress = GetStudyProgressUseCase(studyProgressRepository),
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        studyContentRepository = studyContentRepository
    )

    @Test
    fun `loadMaterial populates content and starts a study session`() = runTest(testDispatcher) {
        studyContentRepository.studyMaterialResult = Result.success(
            CloudStudyMaterial(id = "mat-1", title = "OIR Basics", category = "OIR", contentMarkdown = "# Hello")
        )
        val viewModel = buildViewModel()

        viewModel.loadMaterial("mat-1")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertNotNull(state.material)
        assertEquals("OIR Basics", state.material?.title)
        assertEquals("SSB Expert", state.material?.author) // blank author falls back
        assertEquals("10 min read", state.material?.readTime) // blank readTime falls back
        assertEquals("session-1", state.activeSessionId)
    }

    @Test
    fun `loadMaterial falls back to markdown when the D2 side document is missing`() = runTest(testDispatcher) {
        // Every topic is behind ContentFeatureFlags.isStructuredStudyMaterialRenderingEnabled
        // today -- this pins Phase 5, docs/plans/write-the-phased-plan-wobbly-pancake.md's exit
        // criterion that a missing side document renders markdown, not a blank screen.
        studyContentRepository.studyMaterialResult = Result.success(
            CloudStudyMaterial(id = "mat-1", title = "OIR Basics", topicType = "OIR", contentMarkdown = "# Hello")
        )
        studyContentRepository.studyMaterialSectionsResult = Result.success(null)
        val viewModel = buildViewModel()

        viewModel.loadMaterial("mat-1")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertNotNull(state.material)
        assertEquals(null, state.material?.sections)
        assertEquals("# Hello", state.material?.content)
    }

    @Test
    fun `loadMaterial uses the D2 side document's DocumentModel when one is published`() = runTest(testDispatcher) {
        val model = com.ssbmax.shared.ui.content.blocks.DocumentModel(
            sections = listOf(
                com.ssbmax.shared.ui.content.blocks.DocSection(
                    id = "study-materials/oir_1.md#0",
                    slug = "intro",
                    heading = null,
                    level = 0,
                    blocks = listOf(com.ssbmax.shared.ui.content.blocks.ParagraphBlock("Hello"))
                )
            )
        )
        studyContentRepository.studyMaterialResult = Result.success(
            CloudStudyMaterial(id = "mat-1", title = "OIR Basics", topicType = "OIR", contentMarkdown = "# Hello")
        )
        studyContentRepository.studyMaterialSectionsResult = Result.success(model)
        val viewModel = buildViewModel()

        viewModel.loadMaterial("mat-1")
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(model, viewModel.uiState.value.material?.sections)
    }

    @Test
    fun `loadMaterial uses the D2 side document for a non-OIR topic too (SRT belongs to PSYCHOLOGY)`() = runTest(testDispatcher) {
        // Regression test for the bug this fix closes: study-material bodies used to be gated
        // behind ContentFeatureFlags.isStructuredRenderingEnabled (OIR-only, meant for topic
        // intros' offline-fallback readiness), which silently fell back to markdown for every
        // other topic even though its Firestore side document existed. Now gated behind
        // isStructuredStudyMaterialRenderingEnabled, which has no such offline-fallback
        // dependency and is enabled for all 9 topics.
        val model = com.ssbmax.shared.ui.content.blocks.DocumentModel(
            sections = listOf(
                com.ssbmax.shared.ui.content.blocks.DocSection(
                    id = "study-materials/psy_4.md#0",
                    slug = "intro",
                    heading = null,
                    level = 0,
                    blocks = listOf(com.ssbmax.shared.ui.content.blocks.ParagraphBlock("Hello"))
                )
            )
        )
        studyContentRepository.studyMaterialResult = Result.success(
            CloudStudyMaterial(id = "mat-2", title = "SRT Situation Analysis", topicType = "PSYCHOLOGY", contentMarkdown = "# Hello")
        )
        studyContentRepository.studyMaterialSectionsResult = Result.success(model)
        val viewModel = buildViewModel()

        viewModel.loadMaterial("mat-2")
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(model, viewModel.uiState.value.material?.sections)
    }

    @Test
    fun `loadMaterial surfaces an error when content is unavailable`() = runTest(testDispatcher) {
        studyContentRepository.studyMaterialResult = Result.failure(Exception("not found"))
        val viewModel = buildViewModel()

        viewModel.loadMaterial("unknown-material")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals("Content not available. Please check your internet connection.", state.error)
    }

    @Test
    fun `loadMaterial restores existing reading progress`() = runTest(testDispatcher) {
        studyContentRepository.studyMaterialResult = Result.success(CloudStudyMaterial(id = "mat-1", title = "OIR Basics"))
        studyProgressRepository.getProgressResult = Result.success(
            StudyProgress(materialId = "mat-1", userId = testUser().id, progress = 45f, lastReadAt = 0L)
        )
        val viewModel = buildViewModel()

        viewModel.loadMaterial("mat-1")
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(45f, viewModel.uiState.value.readingProgress)
    }

    @Test
    fun `updateProgress coerces and persists the new progress`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadMaterial("mat-1")
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.updateProgress(150f)
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(100f, viewModel.uiState.value.readingProgress)
        assertEquals(1, studyProgressRepository.savedProgress.size)
        assertEquals(true, studyProgressRepository.savedProgress.first().isCompleted)
    }

    @Test
    fun `endStudySession ends the active session with the current progress`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadMaterial("mat-1")
        testDispatcher.scheduler.advanceUntilIdle()
        viewModel.updateProgress(30f)
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.endStudySession()
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, studyProgressRepository.endedSessions.size)
        assertEquals("session-1" to 30f, studyProgressRepository.endedSessions.first())
    }
}
