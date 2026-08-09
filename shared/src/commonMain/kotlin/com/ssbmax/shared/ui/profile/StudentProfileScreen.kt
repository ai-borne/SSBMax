package com.ssbmax.shared.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.presentation.profile.StudentProfileUiState
import com.ssbmax.shared.presentation.profile.StudentProfileViewModel
import com.ssbmax.shared.ui.common.loadingSemantics
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.profile_phase1_screening
import ssbmax.shared.generated.resources.profile_phase2_assessment
import ssbmax.shared.generated.resources.profile_phase_progress_title
import ssbmax.shared.generated.resources.profile_loading
import ssbmax.shared.generated.resources.profile_settings
import ssbmax.shared.generated.resources.profile_title

/**
 * KMP port of the Android `app/.../ui/profile/StudentProfileScreen.kt` —
 * student profile summary + stats display (distinct from [UserProfileScreen],
 * which is the create/edit form).
 *
 * Split across this file (screen shell + phase-progress card),
 * [StudentProfileHeader] (avatar/name/premium-badge header + quick-stats
 * card), and [StudentProfileSections] (achievements/history/account-actions
 * cards) to stay under this repo's 300-line-per-file Quality Limit — the
 * Android original was a single 519-line file; this port is the same
 * content, reorganized, not trimmed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentProfileScreen(
    onNavigateToSettings: () -> Unit = {},
    onNavigateToAchievements: () -> Unit = {},
    onNavigateToHistory: () -> Unit = {},
    viewModel: StudentProfileViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.profile_title)) },
                actions = {
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = stringResource(Res.string.profile_settings)
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .loadingSemantics(stringResource(Res.string.profile_loading)),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }
            return@Scaffold
        }

        StudentProfileContent(
            uiState = uiState,
            paddingValues = paddingValues,
            onNavigateToAchievements = onNavigateToAchievements,
            onNavigateToHistory = onNavigateToHistory
        )
    }
}

@Composable
private fun StudentProfileContent(
    uiState: StudentProfileUiState,
    paddingValues: PaddingValues,
    onNavigateToAchievements: () -> Unit,
    onNavigateToHistory: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            ProfileHeader(uiState.userName, uiState.userEmail, uiState.photoUrl, uiState.isPremium)
        }
        item {
            QuickStatsCard(
                totalTests = uiState.totalTestsAttempted,
                studyHours = uiState.totalStudyHours,
                streakDays = uiState.streakDays,
                averageScore = uiState.averageScore
            )
        }
        item { PhaseProgressCard(uiState.phase1Completion, uiState.phase2Completion) }
        item {
            AchievementsCard(uiState.recentAchievements, onNavigateToAchievements)
        }
        item { TestHistoryCard(uiState.recentTests, onNavigateToHistory) }
        item {
            AccountActionsCard(
                isPremium = uiState.isPremium,
                onUpgradeToPremium = {},
                onEditProfile = {},
                onViewBadges = onNavigateToAchievements
            )
        }
    }
}

@Composable
private fun PhaseProgressCard(
    phase1Progress: Int,
    phase2Progress: Int
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(Res.string.profile_phase_progress_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            PhaseProgressRow(
                label = stringResource(Res.string.profile_phase1_screening),
                progress = phase1Progress,
                color = MaterialTheme.colorScheme.primary
            )

            PhaseProgressRow(
                label = stringResource(Res.string.profile_phase2_assessment),
                progress = phase2Progress,
                color = MaterialTheme.colorScheme.tertiary
            )
        }
    }
}

@Composable
private fun PhaseProgressRow(
    label: String,
    progress: Int,
    color: Color
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(text = label, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = "$progress%",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
        }
        LinearProgressIndicator(
            progress = { progress / 100f },
            modifier = Modifier.fillMaxWidth(),
            color = color
        )
    }
}
