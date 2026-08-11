package com.ssbmax.shared.ui.home.student

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import com.ssbmax.shared.ui.home.student.components.QuickActionCard
import com.ssbmax.shared.ui.home.student.components.StatsCard
import com.ssbmax.shared.ui.theme.Spacing
import com.ssbmax.shared.ui.theme.tokens
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.action_join_batch
import ssbmax.shared.generated.resources.action_self_preparation
import ssbmax.shared.generated.resources.action_study_materials
import ssbmax.shared.generated.resources.action_view_analytics
import ssbmax.shared.generated.resources.cd_stats_streak_icon
import ssbmax.shared.generated.resources.cd_stats_tests_icon
import ssbmax.shared.generated.resources.stats_days
import ssbmax.shared.generated.resources.stats_study_streak
import ssbmax.shared.generated.resources.stats_tests
import ssbmax.shared.generated.resources.stats_tests_done

/**
 * Stats + quick-action rows for [StudentHomeScreen], split into their own
 * file purely to keep `StudentHomeScreen.kt` under this repo's 300-line
 * Quality Limit — no behavior change from the Android original.
 */
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
                colors = listOf(MaterialTheme.tokens.warning, MaterialTheme.tokens.warning.copy(alpha = 0.8f))
            ),
            iconContentDescription = stringResource(Res.string.cd_stats_streak_icon),
            modifier = Modifier.weight(1f)
        )

        StatsCard(
            title = stringResource(Res.string.stats_tests_done),
            value = "$testsCompleted",
            subtitle = stringResource(Res.string.stats_tests),
            icon = Icons.Default.CheckCircle,
            gradient = Brush.linearGradient(
                colors = listOf(MaterialTheme.tokens.success, MaterialTheme.tokens.success.copy(alpha = 0.8f))
            ),
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
