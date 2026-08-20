package com.ssbmax.shared.ui.home.student

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import com.ssbmax.shared.domain.model.TestPhase
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.usecase.dashboard.ProcessedDashboardData
import com.ssbmax.shared.presentation.home.student.StudentHomeUiState
import com.ssbmax.shared.ui.home.student.components.OLQDashboardCard
import com.ssbmax.shared.ui.home.student.components.QuickActionCard
import com.ssbmax.shared.ui.home.student.components.SectionDivider
import com.ssbmax.shared.ui.home.student.components.SectionHeader
import com.ssbmax.shared.ui.home.student.components.StatsCard
import com.ssbmax.shared.ui.theme.Spacing
import com.ssbmax.shared.ui.theme.tokens
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.action_join_batch
import ssbmax.shared.generated.resources.action_self_preparation
import ssbmax.shared.generated.resources.action_study_materials
import ssbmax.shared.generated.resources.action_view_analytics
import ssbmax.shared.generated.resources.cd_menu
import ssbmax.shared.generated.resources.cd_notifications
import ssbmax.shared.generated.resources.cd_stats_streak_icon
import ssbmax.shared.generated.resources.cd_stats_tests_icon
import ssbmax.shared.generated.resources.dashboard_error_load_failed
import ssbmax.shared.generated.resources.dashboard_olq_dashboard
import ssbmax.shared.generated.resources.home_journey_starts
import ssbmax.shared.generated.resources.home_welcome
import ssbmax.shared.generated.resources.section_quick_actions
import ssbmax.shared.generated.resources.section_your_progress
import ssbmax.shared.generated.resources.stats_days
import ssbmax.shared.generated.resources.stats_study_streak
import ssbmax.shared.generated.resources.stats_tests
import ssbmax.shared.generated.resources.stats_tests_done
import ssbmax.shared.generated.resources.student_tests_title
import ssbmax.shared.generated.resources.submissions_list_title

/**
 * Top app bar, navigation actions holder, and scrollable content for [StudentHomeScreen],
 * split into this file purely to keep `StudentHomeScreen.kt` under this repo's 300-line
 * Quality Limit and Detekt method-length thresholds.
 */
internal data class StudentHomeActions(
    val onNavigateToPhaseDetail: (TestPhase) -> Unit,
    val onNavigateToTopic: (topicId: String, selectedTab: Int) -> Unit,
    val onRefreshDashboard: () -> Unit,
    val onNavigateToResult: (TestType, String) -> Unit,
    val onNavigateToTests: () -> Unit,
    val onNavigateToSubmissions: () -> Unit,
    val onOpenDrawer: () -> Unit,
    val onNavigateToMarketplace: () -> Unit,
    val onNavigateToAnalytics: () -> Unit,
    val onNavigateToStudy: () -> Unit
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun StudentHomeTopBar(
    userName: String,
    notificationCount: Int,
    onOpenDrawer: () -> Unit,
    onNavigateToNotifications: () -> Unit
) {
    TopAppBar(
        title = {
            Column {
                Text(
                    stringResource(Res.string.home_welcome, userName),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    stringResource(Res.string.home_journey_starts),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onOpenDrawer) {
                Icon(Icons.Default.Menu, stringResource(Res.string.cd_menu))
            }
        },
        actions = {
            IconButton(onClick = onNavigateToNotifications) {
                BadgedBox(
                    badge = {
                        if (notificationCount > 0) {
                            Badge {
                                Text("$notificationCount")
                            }
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Notifications,
                        contentDescription = stringResource(Res.string.cd_notifications)
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
internal fun StudentHomeScrollableContent(
    uiState: StudentHomeUiState,
    actions: StudentHomeActions,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(Spacing.cardPadding),
        verticalArrangement = Arrangement.spacedBy(Spacing.sectionSpacing)
    ) {
        item { StatsCardsRow(uiState.currentStreak, uiState.testsCompleted) }

        item { SectionDivider() }

        item {
            SectionHeader(
                icon = "📊",
                title = stringResource(Res.string.section_your_progress),
                modifier = Modifier.padding(top = Spacing.small)
            )
        }

        item {
            PhaseProgressRibbon(
                phase1Progress = uiState.phase1Progress,
                phase2Progress = uiState.phase2Progress,
                onPhaseClick = actions.onNavigateToPhaseDetail,
                onTopicClick = { topicId ->
                    actions.onNavigateToTopic(topicId, 2)
                }
            )
        }

        item { SectionDivider() }

        item {
            SectionHeader(
                icon = "🎯",
                title = stringResource(Res.string.dashboard_olq_dashboard),
                modifier = Modifier.padding(top = Spacing.small)
            )
        }

        item {
            OLQDashboardCard(
                processedData = uiState.dashboard ?: ProcessedDashboardData.empty(),
                isLoading = uiState.isDashboardLoading,
                isRefreshing = uiState.isRefreshingDashboard,
                onRefresh = actions.onRefreshDashboard,
                onNavigateToResult = actions.onNavigateToResult,
                modifier = Modifier.padding(horizontal = Spacing.cardPadding)
            )
        }

        if (uiState.dashboardError != null) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.cardPadding),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        text = uiState.dashboardError ?: stringResource(Res.string.dashboard_error_load_failed),
                        modifier = Modifier.padding(Spacing.cardPadding),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }

        item { SectionDivider() }

        item {
            SectionHeader(
                icon = "⚡",
                title = stringResource(Res.string.section_quick_actions),
                modifier = Modifier.padding(top = Spacing.small)
            )
        }

        item { QuickActionsRowThree(actions.onNavigateToTests, actions.onNavigateToSubmissions) }

        item { QuickActionsRowOne(actions.onOpenDrawer, actions.onNavigateToMarketplace) }

        item { QuickActionsRowTwo(actions.onNavigateToAnalytics, actions.onNavigateToStudy) }

        item {
            Spacer(modifier = Modifier.height(Spacing.large))
        }
    }
}

@Composable
internal fun StatsCardsRow(currentStreak: Int, testsCompleted: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.medium)
    ) {
        StatsCard(
            title = stringResource(Res.string.stats_study_streak),
            value = "$currentStreak",
            subtitle = stringResource(Res.string.stats_days),
            icon = Icons.Default.LocalFireDepartment,
            gradient = Brush.linearGradient(
                colors = listOf(MaterialTheme.tokens.warningContainer, MaterialTheme.tokens.warningContainer.copy(alpha = 0.85f))
            ),
            contentColor = MaterialTheme.tokens.onWarningContainer,
            iconContentDescription = stringResource(Res.string.cd_stats_streak_icon),
            modifier = Modifier.weight(1f)
        )

        StatsCard(
            title = stringResource(Res.string.stats_tests_done),
            value = "$testsCompleted",
            subtitle = stringResource(Res.string.stats_tests),
            icon = Icons.Default.CheckCircle,
            gradient = Brush.linearGradient(
                colors = listOf(MaterialTheme.tokens.emeraldContainer, MaterialTheme.tokens.emeraldContainer.copy(alpha = 0.85f))
            ),
            contentColor = MaterialTheme.tokens.onEmeraldContainer,
            iconContentDescription = stringResource(Res.string.cd_stats_tests_icon),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
internal fun QuickActionsRowOne(onOpenDrawer: () -> Unit, onNavigateToMarketplace: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.medium)
    ) {
        QuickActionCard(
            title = stringResource(Res.string.action_self_preparation),
            icon = Icons.AutoMirrored.Filled.MenuBook,
            color = MaterialTheme.tokens.accent,
            onClick = onOpenDrawer,
            modifier = Modifier.weight(1f)
        )

        QuickActionCard(
            title = stringResource(Res.string.action_join_batch),
            icon = Icons.Default.GroupAdd,
            color = MaterialTheme.tokens.violet,
            onClick = onNavigateToMarketplace,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
internal fun QuickActionsRowTwo(onNavigateToAnalytics: () -> Unit, onNavigateToStudy: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.medium)
    ) {
        QuickActionCard(
            title = stringResource(Res.string.action_view_analytics),
            icon = Icons.Default.Analytics,
            color = MaterialTheme.tokens.emerald,
            onClick = onNavigateToAnalytics,
            modifier = Modifier.weight(1f)
        )

        QuickActionCard(
            title = stringResource(Res.string.action_study_materials),
            icon = Icons.Default.Book,
            color = MaterialTheme.tokens.danger,
            onClick = onNavigateToStudy,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
internal fun QuickActionsRowThree(onNavigateToTests: () -> Unit, onNavigateToSubmissions: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.medium)
    ) {
        QuickActionCard(
            title = stringResource(Res.string.student_tests_title),
            icon = Icons.Default.Quiz,
            color = MaterialTheme.tokens.accent,
            onClick = onNavigateToTests,
            modifier = Modifier.weight(1f)
        )

        QuickActionCard(
            title = stringResource(Res.string.submissions_list_title),
            icon = Icons.Default.History,
            color = MaterialTheme.tokens.info,
            onClick = onNavigateToSubmissions,
            modifier = Modifier.weight(1f)
        )
    }
}
