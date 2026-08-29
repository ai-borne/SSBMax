package com.ssbmax.shared.ui.study

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.presentation.study.RelatedMaterial
import com.ssbmax.shared.presentation.study.StudyMaterialContent
import com.ssbmax.shared.presentation.study.StudyMaterialDetailUiState
import com.ssbmax.shared.ui.common.BreadcrumbBar
import com.ssbmax.shared.ui.common.BreadcrumbItem
import com.ssbmax.shared.ui.common.HtmlContentView
import com.ssbmax.shared.ui.common.MarkdownText
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.study_material_breadcrumb_root
import ssbmax.shared.generated.resources.study_material_related
import ssbmax.shared.generated.resources.study_material_tags

/**
 * The [StudyMaterialDetailScreen] `LazyColumn` body, extracted so the screen composable itself
 * stays under the repo's Quality Limit (max 80 lines per Detekt's `LongMethod`) -- Phase 7 (docs/
 * plans/write-the-phased-plan-wobbly-pancake.md) added the read-toggle/CTA wiring that pushed it
 * over. No behavior change from the pre-Phase-7 inline version.
 */
@Composable
internal fun StudyMaterialDetailContent(
    material: StudyMaterialContent,
    uiState: StudyMaterialDetailUiState,
    listState: LazyListState,
    onNavigateBack: () -> Unit,
    onNavigateToRelatedMaterial: (String) -> Unit,
    onNavigateToTest: (TestType) -> Unit,
    onToggleSectionRead: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        state = listState,
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            val breadcrumbRoot = stringResource(Res.string.study_material_breadcrumb_root)
            StudyMaterialBreadcrumb(
                root = breadcrumbRoot,
                category = material.category,
                title = material.title,
                onRootClick = onNavigateBack
            )
        }

        item {
            LinearProgressIndicator(
                progress = { uiState.readingProgress / 100f },
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary
            )
        }

        item { MaterialHeaderCard(material = material) }

        item {
            MaterialBodyContent(
                content = material.content,
                sections = material.sections,
                readSectionIds = uiState.readSectionIds,
                onToggleSectionRead = onToggleSectionRead,
                practiceTestType = material.practiceTestType,
                onPracticeClick = onNavigateToTest
            )
        }

        if (material.tags.isNotEmpty()) {
            item { TagsSection(tags = material.tags) }
        }

        if (material.relatedMaterials.isNotEmpty()) {
            item {
                Text(
                    stringResource(Res.string.study_material_related),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            items(material.relatedMaterials) { relatedMaterial ->
                RelatedMaterialCard(
                    material = relatedMaterial,
                    onClick = { onNavigateToRelatedMaterial(relatedMaterial.id) }
                )
            }
        }
    }
}

/**
 * Extracted private composables for [StudyMaterialDetailScreen], split out
 * purely to keep both files under the repo's 300-line Quality Limit -- no
 * behavior change from having them inline.
 */

@Composable
internal fun StudyMaterialBreadcrumb(
    root: String,
    category: String,
    title: String,
    onRootClick: () -> Unit
) {
    BreadcrumbBar(
        items = listOf(
            BreadcrumbItem(root, null, isClickable = true),
            BreadcrumbItem(category, null, isClickable = false),
            BreadcrumbItem(title, null, isClickable = false)
        ),
        onItemClick = { item -> if (item.title == root) onRootClick() }
    )
}

@Composable
internal fun MaterialHeaderCard(material: StudyMaterialContent, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = material.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(16.dp))
                Text(text = material.author, style = MaterialTheme.typography.bodyMedium)

                Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(16.dp))
                Text(text = material.readTime, style = MaterialTheme.typography.bodyMedium)
            }

            Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surface) {
                Text(
                    text = material.category,
                    style = MaterialTheme.typography.labelMedium,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }
    }
}

/**
 * Renders the HTML PIQ form (via [HtmlContentView]), the structured [sections] model (via
 * [com.ssbmax.shared.ui.content.DocumentSectionsColumn], Phase 5, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md -- same sections-over-markdown precedent as
 * [com.ssbmax.shared.ui.topic.IntroductionTab]), or plain markdown [content] (via
 * [MarkdownText]) as the fallback, matching the Android original's
 * `content.startsWith("<!DOCTYPE html>")`/`startsWith("<html")` branch for the HTML case.
 *
 * Uses `DocumentSectionsColumn` (a plain `Column`), not `DocumentView` (a `LazyColumn`) --
 * this composable is itself called from inside [StudyMaterialDetailScreen]'s own outer
 * `LazyColumn` `item {}`, and nesting a second `LazyColumn` there crashes at runtime
 * ("Vertically scrollable component was measured with an infinity maximum height
 * constraints"). Caught on a physical Pixel 9 once a real `study_material_sections` document
 * made `sections` non-null for the first time -- the crash is silent whenever `sections` is
 * null, so it never showed up while the D2 Firestore rules blocked every read.
 */
@Composable
internal fun MaterialBodyContent(
    content: String,
    sections: com.ssbmax.shared.ui.content.blocks.DocumentModel? = null,
    modifier: Modifier = Modifier,
    readSectionIds: Set<String> = emptySet(),
    onToggleSectionRead: (String) -> Unit = {},
    practiceTestType: TestType? = null,
    onPracticeClick: (TestType) -> Unit = {}
) {
    if (content.startsWith("<!DOCTYPE html>") || content.startsWith("<html")) {
        Card(modifier = modifier.fillMaxWidth()) {
            Box(modifier = Modifier.fillMaxWidth().height(2000.dp)) {
                HtmlContentView(htmlContent = content, modifier = Modifier.fillMaxSize())
            }
        }
    } else if (sections != null) {
        com.ssbmax.shared.ui.content.DocumentSectionsColumn(
            model = sections,
            modifier = modifier.fillMaxWidth(),
            readSectionIds = readSectionIds,
            onToggleSectionRead = onToggleSectionRead,
            practiceTestType = practiceTestType,
            onPracticeClick = onPracticeClick
        )
    } else {
        Card(modifier = modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                MarkdownText(content = content)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TagsSection(tags: List<String>, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(Res.string.study_material_tags), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            tags.filter { it.isNotBlank() }.forEach { tag ->
                AssistChip(
                    onClick = { /* Tag filtering isn't implemented in the Android original either. */ },
                    label = { Text(tag) },
                    leadingIcon = { Icon(Icons.Default.Tag, contentDescription = null, modifier = Modifier.size(16.dp)) }
                )
            }
        }
    }
}

@Composable
internal fun RelatedMaterialCard(
    material: RelatedMaterial,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(Icons.Default.Description, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Text(text = material.title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            }

            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
