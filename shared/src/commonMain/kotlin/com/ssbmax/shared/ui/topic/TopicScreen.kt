package com.ssbmax.shared.ui.topic

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.presentation.topic.TopicViewModel
import com.ssbmax.shared.ui.common.TabSwipeableContent
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.topic_retry_button
import ssbmax.shared.generated.resources.topic_tab_overview
import ssbmax.shared.generated.resources.topic_tab_study_material

/**
 * KMP port of the Android `app/.../ui/topic/TopicScreen.kt` -- 3-tab topic
 * detail screen (Overview / Study Material / Tests) for a specific SSB test
 * topic. Tab content composables extracted into [TopicComponents] to stay
 * under the 300-line Quality Limit. See [TopicViewModel] for the
 * ViewModel-level porting notes.
 */
@Composable
fun TopicScreen(
    topicId: String,
    initialTab: Int = 0,
    onNavigateBack: () -> Unit,
    onNavigateToStudyMaterial: (String) -> Unit = {},
    onNavigateToTest: (String) -> Unit = {},
    onNavigateToInterviewResult: (String) -> Unit = {},
    viewModel: TopicViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    LaunchedEffect(topicId) {
        viewModel.loadTopic(topicId)
    }

    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by rememberSaveable { mutableIntStateOf(initialTab) }
    val onPracticeOrTestClick: (TestType) -> Unit =
        { testType -> onNavigateToTest("${testType.name.lowercase()}_standard") }

    Scaffold(
        topBar = {
            TopicTopBar(title = uiState.topicTitle, testType = topicId, onNavigateBack = onNavigateBack)
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 3.dp) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Info, contentDescription = null) },
                    label = { Text(stringResource(Res.string.topic_tab_overview)) },
                    alwaysShowLabel = true
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.AutoMirrored.Filled.MenuBook, contentDescription = null) },
                    label = { Text(stringResource(Res.string.topic_tab_study_material)) },
                    alwaysShowLabel = true
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.AutoMirrored.Filled.Assignment, contentDescription = null) },
                    label = {
                        Text(
                            if (topicId.equals("PIQ", ignoreCase = true) || topicId.equals("PIQ_FORM", ignoreCase = true)) {
                                "Fill PIQ"
                            } else {
                                "Tests"
                            }
                        )
                    },
                    alwaysShowLabel = true
                )
            }
        }
    ) { paddingValues ->
        if (uiState.error != null) {
            TopicErrorState(
                error = uiState.error!!,
                onRetry = { viewModel.loadTopic(topicId) },
                modifier = Modifier.fillMaxSize().padding(paddingValues)
            )
        } else {
            TabSwipeableContent(
                currentIndex = selectedTab,
                totalTabs = 3,
                onTabChange = { newTab -> selectedTab = newTab },
                modifier = Modifier.fillMaxSize().padding(paddingValues)
            ) {
                when (selectedTab) {
                    0 -> IntroductionTab(
                        introduction = uiState.introduction,
                        isLoading = uiState.isLoading,
                        introductionSections = uiState.introductionSections,
                        readSectionIds = uiState.readSectionIds,
                        onToggleSectionRead = viewModel::toggleSectionRead,
                        practiceTestType = uiState.availableTests.singleOrNull(),
                        onPracticeClick = onPracticeOrTestClick
                    )
                    1 -> StudyMaterialTab(
                        materials = uiState.studyMaterials,
                        isLoading = uiState.isLoading,
                        onMaterialClick = onNavigateToStudyMaterial
                    )
                    2 -> TestsTab(
                        tests = uiState.availableTests,
                        topicId = topicId,
                        isLoading = uiState.isLoading,
                        pastInterviewResults = uiState.pastInterviewResults,
                        isLoadingInterviewHistory = uiState.isLoadingInterviewHistory,
                        onTestClick = onPracticeOrTestClick,
                        onInterviewResultClick = onNavigateToInterviewResult
                    )
                }
            }
        }
    }
}

/**
 * Full-tab-content error state for a failed topic load. `TopicUiState.error`
 * existed since the port but was never read by any tab -- a real load
 * failure was silently invisible (found during Phase 6a-2's UI-test port,
 * fixed here rather than left as tracked debt).
 */
@Composable
private fun TopicErrorState(error: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(text = error, style = MaterialTheme.typography.bodyMedium)
            Button(onClick = onRetry) { Text(stringResource(Res.string.topic_retry_button)) }
        }
    }
}
