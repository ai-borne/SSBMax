package com.ssbmax.shared.ui.topic

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.presentation.topic.StudyMaterialItem
import com.ssbmax.shared.ui.common.MarkdownText
import com.ssbmax.shared.ui.content.DocumentView
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.premium_badge_label
import ssbmax.shared.generated.resources.topic_no_study_materials
import ssbmax.shared.generated.resources.topic_tab_overview

/**
 * Extracted composables for [TopicScreen]'s top bar / Overview tab / Study
 * Material tab, split out purely to keep files under the repo's 300-line
 * Quality Limit -- no behavior change from having them inline. The "Tests"
 * tab lives in [TopicTestsTab]; interview-history-specific composables live
 * in [TopicInterviewHistoryComponents].
 */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TopicTopBar(title: String, testType: String, onNavigateBack: () -> Unit) {
    TopAppBar(
        title = {
            Column(modifier = Modifier.padding(end = 8.dp)) {
                Text(text = title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(
                    text = "SSB Preparation > ${formatBreadcrumbText(testType)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

/** Keeps acronyms uppercase (OIR, PPDT, TAT, ...); title-cases everything else. */
private fun formatBreadcrumbText(text: String): String {
    val upperCaseAcronyms = setOf("OIR", "PPDT", "TAT", "WAT", "SRT", "GTO", "IO", "PIQ", "SD")
    val normalized = text.trim().uppercase()
    return if (upperCaseAcronyms.contains(normalized)) {
        normalized
    } else {
        text.split("_", "-", " ").joinToString(" ") { word -> word.lowercase().replaceFirstChar { it.uppercase() } }
    }
}

@Composable
internal fun IntroductionTab(
    introduction: String,
    isLoading: Boolean,
    introductionSections: DocumentModel? = null,
    modifier: Modifier = Modifier,
    practiceTestType: TestType? = null,
    onPracticeClick: (TestType) -> Unit = {}
) {
    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    // Phase 2/8 (docs/plans/write-the-phased-plan-wobbly-pancake.md): when a structured model is
    // available, render it via DocumentView's real per-section LazyColumn instead of the
    // single-item MarkdownText card below -- the fallback now only fires on a genuine missing
    // fetch and missing generated offline copy, not a rollout flag (removed in the Phase 8 sweep).
    if (introductionSections != null) {
        DocumentView(
            model = introductionSections,
            modifier = modifier.fillMaxSize(),
            practiceTestType = practiceTestType,
            onPracticeClick = onPracticeClick
        )
        return
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Lightbulb, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(
                            stringResource(Res.string.topic_tab_overview),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    MarkdownText(content = introduction, textColor = MaterialTheme.colorScheme.onPrimaryContainer)
                }
            }
        }
    }
}

@Composable
internal fun StudyMaterialTab(
    materials: List<StudyMaterialItem>,
    isLoading: Boolean,
    onMaterialClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }

    if (materials.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                stringResource(Res.string.topic_no_study_materials),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        return
    }

    LazyColumn(modifier = modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(materials) { material ->
            StudyMaterialCard(material = material, onClick = { onMaterialClick(material.id) })
        }
    }
}

@Composable
private fun StudyMaterialCard(material: StudyMaterialItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                if (material.isPremium) Icons.Default.Lock else Icons.AutoMirrored.Filled.MenuBook,
                contentDescription = null,
                tint = if (material.isPremium) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(40.dp)
            )

            Column(modifier = Modifier.weight(1f)) {
                Text(text = material.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(text = material.duration, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (material.isPremium) {
                AssistChip(
                    onClick = { },
                    label = { Text(stringResource(Res.string.premium_badge_label), style = MaterialTheme.typography.labelSmall) },
                    colors = AssistChipDefaults.assistChipColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)
                )
            }

            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
