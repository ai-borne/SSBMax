package com.ssbmax.shared.ui.topic

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.domain.model.interview.InterviewResult
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.topic_no_tests_available

/**
 * The "Tests" tab for [TopicScreen] (GTO's day-1/day-2 split, Interview's
 * past-results section, and the default single-list layout), extracted
 * purely to keep [TopicComponents] under the repo's 300-line Quality Limit --
 * no behavior change from having it inline.
 */
@Composable
internal fun TestsTab(
    tests: List<TestType>,
    topicId: String,
    isLoading: Boolean,
    pastInterviewResults: List<InterviewResult> = emptyList(),
    isLoadingInterviewHistory: Boolean = false,
    onTestClick: (TestType) -> Unit,
    onInterviewResultClick: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    if (tests.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                stringResource(Res.string.topic_no_tests_available),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        return
    }

    LazyColumn(modifier = modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            topicId.equals("GTO", ignoreCase = true) -> {
                val day1Tests = tests.take(4)
                val day2Tests = tests.drop(4)

                item { DayHeader("Day 1") }
                items(day1Tests) { test -> TestCard(test = test, onClick = { onTestClick(test) }) }

                item { Spacer(modifier = Modifier.height(16.dp)); DayHeader("Day 2") }
                items(day2Tests) { test -> TestCard(test = test, onClick = { onTestClick(test) }) }
            }
            topicId.equals("INTERVIEW", ignoreCase = true) -> {
                items(tests) { test -> TestCard(test = test, onClick = { onTestClick(test) }) }

                if (pastInterviewResults.isNotEmpty() || isLoadingInterviewHistory) {
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        InterviewHistorySection(
                            results = pastInterviewResults,
                            isLoading = isLoadingInterviewHistory,
                            onResultClick = onInterviewResultClick
                        )
                    }
                }
            }
            else -> {
                items(tests) { test -> TestCard(test = test, onClick = { onTestClick(test) }) }
            }
        }
    }
}

@Composable
private fun DayHeader(title: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(text = title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
        HorizontalDivider(thickness = 2.dp, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
    }
}

@Composable
private fun TestCard(test: TestType, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Surface(shape = MaterialTheme.shapes.medium, color = getTestColor(test).copy(alpha = 0.2f), modifier = Modifier.size(56.dp)) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(getTestIcon(test), contentDescription = null, tint = getTestColor(test), modifier = Modifier.size(32.dp))
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(text = test.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(text = test.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
            }

            Icon(Icons.Default.PlayArrow, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        }
    }
}

private fun getTestColor(testType: TestType): Color {
    return when (testType) {
        TestType.OIR -> Color(0xFF1976D2)
        TestType.PPDT -> Color(0xFF388E3C)
        TestType.PIQ -> Color(0xFF009688)
        TestType.TAT -> Color(0xFFD32F2F)
        TestType.WAT -> Color(0xFFF57C00)
        TestType.SRT -> Color(0xFF7B1FA2)
        TestType.SD -> Color(0xFF0097A7)
        TestType.GTO_GD -> Color(0xFF2196F3)
        TestType.GTO_GPE -> Color(0xFF4CAF50)
        TestType.GTO_PGT -> Color(0xFFFF9800)
        TestType.GTO_GOR -> Color(0xFF9C27B0)
        TestType.GTO_HGT -> Color(0xFF00BCD4)
        TestType.GTO_LECTURETTE -> Color(0xFF3F51B5)
        TestType.GTO_IO -> Color(0xFF8BC34A)
        TestType.GTO_CT -> Color(0xFFFF5722)
        TestType.GTO_FGT -> Color(0xFF795548)
        TestType.IO -> Color(0xFF455A64)
    }
}

private fun getTestIcon(testType: TestType): ImageVector {
    return when (testType) {
        TestType.OIR -> Icons.Default.Psychology
        TestType.PPDT -> Icons.Default.Image
        TestType.PIQ -> Icons.AutoMirrored.Filled.Assignment
        TestType.TAT, TestType.WAT, TestType.SRT, TestType.SD -> Icons.Default.EditNote
        TestType.GTO_GD -> Icons.Default.Forum
        TestType.GTO_GPE -> Icons.Default.Map
        TestType.GTO_PGT -> Icons.AutoMirrored.Filled.TrendingUp
        TestType.GTO_GOR -> Icons.AutoMirrored.Filled.DirectionsRun
        TestType.GTO_HGT -> Icons.Default.People
        TestType.GTO_LECTURETTE -> Icons.Default.Mic
        TestType.GTO_IO -> Icons.Default.Person
        TestType.GTO_CT -> Icons.Default.MilitaryTech
        TestType.GTO_FGT -> Icons.AutoMirrored.Filled.DirectionsRun
        TestType.IO -> Icons.Default.RecordVoiceOver
    }
}
