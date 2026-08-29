package com.ssbmax.shared.ui.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.ui.content.blocks.DocBlockView
import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.content_estimated_minutes
import ssbmax.shared.generated.resources.content_practice_now_cta
import ssbmax.shared.generated.resources.content_section_isread_cd
import ssbmax.shared.generated.resources.content_section_unread_cd
import ssbmax.shared.generated.resources.content_takeaways_heading
import ssbmax.shared.generated.resources.content_toc_heading

/**
 * Renders a parsed [DocumentModel] as a real `LazyColumn` of section items -- the Phase 2
 * structural slice (docs/plans/write-the-phased-plan-wobbly-pancake.md), fixing the single-item
 * `LazyColumn` composition this replaces (was `TopicComponents.kt`'s `IntroductionTab`, which
 * put the entire introduction into one `item {}`). Sections render expanded by default (D3) --
 * no per-section collapse here, that's a later reading-affordance phase.
 */
@Composable
fun DocumentView(
    model: DocumentModel,
    modifier: Modifier = Modifier,
    takeaways: List<String> = emptyList(),
    practiceTestType: TestType? = null,
    onPracticeClick: (TestType) -> Unit = {}
) {
    val headedSections = model.sections.filter { it.heading != null }

    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (takeaways.isNotEmpty()) {
            item(key = "takeaways") { TakeawaysCard(takeaways) }
        }
        if (headedSections.size > 1) {
            item(key = "toc") { TableOfContentsCard(headedSections) }
        }
        if (practiceTestType != null) {
            item(key = "practice_cta") { PracticeNowCard(practiceTestType, onPracticeClick) }
        }
        items(model.sections, key = { it.id }) { section ->
            SectionCard(section)
        }
    }
}


/**
 * Same rendering as [DocumentView], as a plain [Column] instead of a `LazyColumn` -- for a
 * caller that is itself already inside a `LazyColumn` item (e.g. `StudyMaterialDetailScreen`'s
 * `MaterialBodyContent`), where nesting a second `LazyColumn` crashes at runtime
 * ("Vertically scrollable component was measured with an infinity maximum height constraints").
 * A material's own body is a bounded, single-screen-ish list of sections, so losing lazy
 * virtualization here is not the tradeoff [DocumentView]'s own doc comment warns about for a
 * whole topic introduction.
 */
@Composable
fun DocumentSectionsColumn(
    model: DocumentModel,
    modifier: Modifier = Modifier,
    takeaways: List<String> = emptyList(),
    readSectionIds: Set<String> = emptySet(),
    onToggleSectionRead: (String) -> Unit = {},
    practiceTestType: TestType? = null,
    onPracticeClick: (TestType) -> Unit = {}
) {
    val headedSections = model.sections.filter { it.heading != null }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (takeaways.isNotEmpty()) TakeawaysCard(takeaways)
        if (headedSections.size > 1) TableOfContentsCard(headedSections)
        if (practiceTestType != null) PracticeNowCard(practiceTestType, onPracticeClick)
        model.sections.forEach { section ->
            SectionCard(
                section = section,
                isRead = readSectionIds.contains(section.id),
                onToggleRead = { onToggleSectionRead(section.id) }
            )
        }
    }
}

@Composable
private fun TakeawaysCard(takeaways: List<String>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(Res.string.content_takeaways_heading),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
            takeaways.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

@Composable
private fun TableOfContentsCard(headedSections: List<DocSection>) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(Res.string.content_toc_heading),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
            headedSections.forEach { section ->
                Text(section.heading.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
private fun PracticeNowCard(testType: TestType, onPracticeClick: (TestType) -> Unit) {
    Button(onClick = { onPracticeClick(testType) }, modifier = Modifier.fillMaxWidth()) {
        Text(stringResource(Res.string.content_practice_now_cta))
    }
}

@Composable
private fun SectionCard(
    section: DocSection,
    isRead: Boolean = false,
    onToggleRead: () -> Unit = {}
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    section.heading?.let {
                        Text(it, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    Text(
                        stringResource(Res.string.content_estimated_minutes, estimatedReadingMinutes(section)),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                val readCd = stringResource(Res.string.content_section_unread_cd)
                val readDoneCd = stringResource(Res.string.content_section_isread_cd)
                IconButton(onClick = onToggleRead) {
                    if (isRead) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = readDoneCd, tint = MaterialTheme.colorScheme.primary)
                    } else {
                        Icon(Icons.Filled.RadioButtonUnchecked, contentDescription = readCd)
                    }
                }
            }
            section.blocks.forEach { block -> DocBlockView(block) }
        }
    }
}
