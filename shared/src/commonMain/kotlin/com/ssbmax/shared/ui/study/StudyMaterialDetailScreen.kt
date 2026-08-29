package com.ssbmax.shared.ui.study

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.presentation.study.StudyMaterialDetailViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.study_material_back
import ssbmax.shared.generated.resources.study_material_breadcrumb_root
import ssbmax.shared.generated.resources.study_material_detail_title
import ssbmax.shared.generated.resources.study_material_error_loading
import ssbmax.shared.generated.resources.study_material_related

/**
 * KMP port of the Android `app/.../ui/study/StudyMaterialDetailScreen.kt` --
 * rich study material content with reading-progress tracking (via scroll
 * position). Header/content/tags/related-material composables extracted
 * into [StudyMaterialDetailComponents] to stay under the 300-line Quality
 * Limit. See [StudyMaterialDetailViewModel] for the ViewModel-level porting
 * notes.
 *
 * The Android original's share button (`android.content.Intent.ACTION_SEND`)
 * is Android-only with no KMP-portable sharing shim built yet in this
 * migration -- dropped rather than faked; a real cross-platform share sheet
 * is out of this screen-porting session's scope (would need its own
 * `expect`/`actual`, same class of work as Phase 4's platform shims).
 *
 * `StudyMaterialDetailViewModel` is a real `androidx.lifecycle.ViewModel`
 * (Phase 1 of the KMP-convergence plan) via `koinViewModel()`, but this
 * screen keeps one `DisposableEffect` that Phase 1's mechanical
 * `close()` -> `onCleared()` conversion can't replace: see
 * [StudyMaterialDetailViewModel]'s class doc for why
 * [StudyMaterialDetailViewModel.endStudySession] must still be called
 * explicitly on dispose rather than from `onCleared()`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudyMaterialDetailScreen(
    categoryId: String,
    onNavigateBack: () -> Unit,
    onNavigateToRelatedMaterial: (String) -> Unit = {},
    viewModel: StudyMaterialDetailViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    DisposableEffect(Unit) {
        onDispose { viewModel.endStudySession() }
    }

    LaunchedEffect(categoryId) {
        viewModel.loadMaterial(categoryId)
    }

    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    LaunchedEffect(listState.firstVisibleItemIndex, listState.firstVisibleItemScrollOffset) {
        if (listState.layoutInfo.totalItemsCount > 0) {
            val progress = (listState.firstVisibleItemIndex.toFloat() / listState.layoutInfo.totalItemsCount.toFloat()) * 100f
            viewModel.updateProgress(progress)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.study_material_detail_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.study_material_back))
                    }
                }
            )
        }
    ) { paddingValues ->
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (uiState.error != null) {
            Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                Text(
                    text = uiState.error ?: stringResource(Res.string.study_material_error_loading),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error
                )
            }
        } else {
            uiState.material?.let { material ->
                LazyColumn(
                    state = listState,
                    modifier = modifier.fillMaxSize().padding(paddingValues),
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

                    item { MaterialBodyContent(content = material.content, sections = material.sections) }

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
        }
    }
}
