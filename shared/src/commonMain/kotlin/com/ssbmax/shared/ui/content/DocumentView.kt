package com.ssbmax.shared.ui.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.content.blocks.DocBlockView
import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.DocumentModel
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
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
fun DocumentView(model: DocumentModel, modifier: Modifier = Modifier, takeaways: List<String> = emptyList()) {
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
        items(model.sections, key = { it.id }) { section ->
            SectionCard(section)
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
private fun SectionCard(section: DocSection) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            section.heading?.let {
                Text(it, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            section.blocks.forEach { block -> DocBlockView(block) }
        }
    }
}
