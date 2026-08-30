@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package com.ssbmax.shared.presentation.topic

import com.ssbmax.shared.data.repository.ContentSource
import com.ssbmax.shared.data.repository.TopicContentData
import com.ssbmax.shared.domain.model.CloudStudyMaterial
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.interview.InterviewMode
import com.ssbmax.shared.domain.model.interview.InterviewResult
import com.ssbmax.shared.domain.usecase.auth.ObserveCurrentUserUseCase
import com.ssbmax.shared.domain.util.NoOpLogger
import com.ssbmax.shared.platform.settings.ReadStateSettings
import com.ssbmax.shared.presentation.testing.FakeAuthRepository
import com.ssbmax.shared.presentation.testing.FakeInterviewRepository
import com.ssbmax.shared.presentation.testing.FakeSettings
import com.ssbmax.shared.presentation.testing.FakeStudyContentRepository
import com.ssbmax.shared.presentation.testing.FakeTestProgressRepository
import com.ssbmax.shared.presentation.testing.testUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.time.Instant
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/**
 * Characterization test for [TopicViewModel], written retroactively (13-VM
 * gap-closing pass, see the KMP-convergence plan's Phase 1). Pins the current
 * cloud-with-local-fallback content loading (the default fake's `Unit` payload
 * is not a [TopicContentData], so the default path exercises the fallback --
 * same behaviour the ViewModel falls into whenever cloud data doesn't come
 * back in the expected shape) plus the INTERVIEW-only history load.
 */
class TopicViewModelTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var authRepository: FakeAuthRepository
    private lateinit var testProgressRepository: FakeTestProgressRepository
    private lateinit var studyContentRepository: FakeStudyContentRepository
    private lateinit var interviewRepository: FakeInterviewRepository

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = FakeAuthRepository(initialUser = testUser())
        testProgressRepository = FakeTestProgressRepository()
        studyContentRepository = FakeStudyContentRepository()
        interviewRepository = FakeInterviewRepository()
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel() = TopicViewModel(
        testProgressRepository = testProgressRepository,
        observeCurrentUser = ObserveCurrentUserUseCase(authRepository),
        studyContentRepository = studyContentRepository,
        interviewRepository = interviewRepository,
        logger = NoOpLogger(),
        readStateSettings = ReadStateSettings(FakeSettings())
    )

    @Test
    fun `loadTopic falls back to local content when cloud data isn't the expected shape`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()

        viewModel.loadTopic("OIR")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(false, state.isLoading)
        assertEquals("OIR", state.testType)
        assertEquals("Officer Intelligence Rating", state.topicTitle)
        assertEquals(listOf(TestType.OIR), state.availableTests)
        assertEquals("Local", state.contentSource)
    }

    @Test
    fun `loadTopic applies real cloud content when the repository returns it`() = runTest(testDispatcher) {
        studyContentRepository.topicContentFlow = flowOf(
            Result.success(
                TopicContentData(
                    title = "Cloud OIR Overview",
                    introduction = "Cloud intro text",
                    materials = listOf(CloudStudyMaterial(id = "m1", title = "Material 1")),
                    source = ContentSource.CLOUD
                )
            )
        )
        val viewModel = buildViewModel()

        viewModel.loadTopic("OIR")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("Cloud (Firestore)", state.contentSource)
        assertEquals("Cloud OIR Overview", state.topicTitle)
        assertEquals(1, state.studyMaterials.size)
    }

    @Test
    fun `loadTopic falls back to the generated structured model when no D2 side document is published`() = runTest(testDispatcher) {
        // Phase 5, docs/plans/write-the-phased-plan-wobbly-pancake.md's exit criterion: a
        // missing side document falls back to the generated offline copy, not a blank section.
        studyContentRepository.topicSectionsResult = Result.success(null)
        val viewModel = buildViewModel()

        viewModel.loadTopic("OIR")
        testDispatcher.scheduler.advanceUntilIdle()

        val sections = viewModel.uiState.value.introductionSections
        assertEquals(TopicContentLoader.getStructuredIntroduction("OIR"), sections)
    }

    @Test
    fun `loadTopic also returns structured sections for a non-OIR topic -- Phase 8 removed the flag and all 9 topics are on`() = runTest(testDispatcher) {
        studyContentRepository.topicSectionsResult = Result.success(null)
        val viewModel = buildViewModel()

        viewModel.loadTopic("MEDICALS")
        testDispatcher.scheduler.advanceUntilIdle()

        val sections = viewModel.uiState.value.introductionSections
        assertEquals(TopicContentLoader.getStructuredIntroduction("MEDICALS"), sections)
    }

    @Test
    fun `loadTopic prefers the D2 side document over the generated fallback when one is published`() = runTest(testDispatcher) {
        val cloudModel = com.ssbmax.shared.ui.content.blocks.DocumentModel(
            sections = listOf(
                com.ssbmax.shared.ui.content.blocks.DocSection(
                    id = "topics/OIR.md#root",
                    slug = "intro",
                    heading = null,
                    level = 0,
                    blocks = listOf(com.ssbmax.shared.ui.content.blocks.ParagraphBlock("Cloud-authored intro"))
                )
            )
        )
        studyContentRepository.topicSectionsResult = Result.success(cloudModel)
        val viewModel = buildViewModel()

        viewModel.loadTopic("OIR")
        testDispatcher.scheduler.advanceUntilIdle()

        assertEquals(cloudModel, viewModel.uiState.value.introductionSections)
    }

    @Test
    fun `loadTopic for INTERVIEW also loads past interview history`() = runTest(testDispatcher) {
        interviewRepository.userResultsFlow = flowOf(
            listOf(
                InterviewResult(
                    id = "result-1",
                    sessionId = "session-1",
                    userId = testUser().id,
                    mode = InterviewMode.VOICE_BASED,
                    completedAt = Instant.fromEpochMilliseconds(5_000),
                    durationSec = 500,
                    totalQuestions = 3,
                    totalResponses = 3,
                    overallOLQScores = emptyMap(),
                    categoryScores = emptyMap(),
                    overallConfidence = 70,
                    strengths = emptyList(),
                    weaknesses = emptyList(),
                    feedback = "Good",
                    overallRating = 6
                )
            )
        )
        val viewModel = buildViewModel()

        viewModel.loadTopic("INTERVIEW")
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(1, state.pastInterviewResults.size)
        assertFalse(state.isLoadingInterviewHistory)
        assertEquals(listOf(TestType.IO), state.availableTests)
    }

    @Test
    fun `refresh reloads the current topic's content`() = runTest(testDispatcher) {
        val viewModel = buildViewModel()
        viewModel.loadTopic("PPDT")
        testDispatcher.scheduler.advanceUntilIdle()

        viewModel.refresh()
        testDispatcher.scheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("PPDT", state.testType)
        assertEquals(false, state.isLoading)
    }
}
