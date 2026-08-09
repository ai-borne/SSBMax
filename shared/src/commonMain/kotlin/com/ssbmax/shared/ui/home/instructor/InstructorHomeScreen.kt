package com.ssbmax.shared.ui.home.instructor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AssignmentLate
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Badge
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.ssbmax.shared.ui.theme.semanticColors
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.presentation.home.instructor.InstructorHomeViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.action_create_batch
import ssbmax.shared.generated.resources.cd_create_batch
import ssbmax.shared.generated.resources.cd_menu
import ssbmax.shared.generated.resources.cd_pending_grading
import ssbmax.shared.generated.resources.instructor_dashboard
import ssbmax.shared.generated.resources.instructor_stats_summary
import ssbmax.shared.generated.resources.stat_avg_response
import ssbmax.shared.generated.resources.stat_pending
import ssbmax.shared.generated.resources.stat_tests_graded
import ssbmax.shared.generated.resources.stat_time
import ssbmax.shared.generated.resources.stat_to_grade
import ssbmax.shared.generated.resources.stat_today
import ssbmax.shared.generated.resources.tab_batches
import ssbmax.shared.generated.resources.tab_students

/**
 * Instructor Home Screen — Phase 5 KMP port of the Android original
 * (`app/.../ui/home/instructor/InstructorHomeScreen.kt`). Shows student
 * list, pending grading queue, and batch analytics.
 *
 * `StatCard`/`StudentsTab`/`BatchesTab`/`StudentCard`/`BatchCard` live in
 * `InstructorHomeParts.kt` (same package) — split out purely to stay under
 * this repo's 300-line Quality Limit, no behavior change.
 *
 * Uses `koinViewModel()` (Phase 1 of the KMP-convergence plan): a real
 * `androidx.lifecycle.ViewModel`, no manual teardown needed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstructorHomeScreen(
    onNavigateToStudent: (String) -> Unit,
    onNavigateToGrading: () -> Unit,
    onNavigateToBatchDetail: (String) -> Unit,
    onNavigateToCreateBatch: () -> Unit,
    onOpenDrawer: () -> Unit,
    modifier: Modifier = Modifier
) {
    val viewModel = koinViewModel<InstructorHomeViewModel>()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            stringResource(Res.string.instructor_dashboard),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            stringResource(
                                Res.string.instructor_stats_summary,
                                uiState.totalStudents,
                                uiState.activeBatches
                            ),
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
                    IconButton(onClick = onNavigateToGrading) {
                        Badge(containerColor = MaterialTheme.colorScheme.error) {
                            Text("${uiState.pendingGradingCount}")
                        }
                        Icon(Icons.Default.AssignmentLate, stringResource(Res.string.cd_pending_grading))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNavigateToCreateBatch,
                icon = { Icon(Icons.Default.Add, stringResource(Res.string.cd_create_batch)) },
                text = { Text(stringResource(Res.string.action_create_batch)) }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    title = stringResource(Res.string.stat_tests_graded),
                    value = "${uiState.testsGradedToday}",
                    subtitle = stringResource(Res.string.stat_today),
                    icon = Icons.Default.Check,
                    color = MaterialTheme.semanticColors.success,
                    modifier = Modifier.weight(1f)
                )

                StatCard(
                    title = stringResource(Res.string.stat_pending),
                    value = "${uiState.pendingGradingCount}",
                    subtitle = stringResource(Res.string.stat_to_grade),
                    icon = Icons.Default.Schedule,
                    color = MaterialTheme.semanticColors.warning,
                    onClick = onNavigateToGrading,
                    modifier = Modifier.weight(1f)
                )

                StatCard(
                    title = stringResource(Res.string.stat_avg_response),
                    value = "${uiState.avgResponseTime}h",
                    subtitle = stringResource(Res.string.stat_time),
                    icon = Icons.Default.Speed,
                    color = MaterialTheme.semanticColors.informational,
                    modifier = Modifier.weight(1f)
                )
            }

            PrimaryTabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text(stringResource(Res.string.tab_students)) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text(stringResource(Res.string.tab_batches)) }
                )
            }

            when (selectedTab) {
                0 -> StudentsTab(
                    students = uiState.students,
                    onStudentClick = onNavigateToStudent,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                )
                1 -> BatchesTab(
                    batches = uiState.batches,
                    onBatchClick = onNavigateToBatchDetail,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                )
            }
        }
    }
}
