package com.ssbmax.shared.ui.gto.gpe.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.ssbmax.shared.domain.model.GPEQuestion
import com.ssbmax.shared.ui.common.ensureCoilNetworkFetcherRegistered
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.gpe_exit_cd
import ssbmax.shared.generated.resources.gpe_planning_guidelines
import ssbmax.shared.generated.resources.gpe_planning_response_label
import ssbmax.shared.generated.resources.gpe_planning_response_placeholder
import ssbmax.shared.generated.resources.gpe_continue_to_review
import ssbmax.shared.generated.resources.gpe_guideline_1
import ssbmax.shared.generated.resources.gpe_guideline_2
import ssbmax.shared.generated.resources.gpe_guideline_3
import ssbmax.shared.generated.resources.gpe_resources_available
import ssbmax.shared.generated.resources.gpe_scenario_label
import ssbmax.shared.generated.resources.gpe_test_image
import ssbmax.shared.generated.resources.gto_char_count_label
import ssbmax.shared.generated.resources.gto_char_range_label

/**
 * KMP port of `app/.../ui/tests/gpe/components/phases/GPEPlanningPhase.kt`.
 * Same Coil3 [ensureCoilNetworkFetcherRegistered] + direct-URL `AsyncImage`
 * swap as [com.ssbmax.shared.ui.ppdt.components.phases.PPDTImageViewingPhase]
 * (see that file's doc comment) -- the Android original's manual
 * `coil.compose.AsyncImage` + `ImageRequest.Builder(LocalContext.current)` has
 * no `LocalContext` equivalent on iOS.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GPEPlanningPhase(
    question: GPEQuestion,
    planningResponse: String,
    charactersCount: Int,
    timeRemaining: String,
    isTimeLow: Boolean,
    onResponseChanged: (String) -> Unit,
    onProceedToReview: () -> Unit,
    onNavigateBack: () -> Unit
) {
    ensureCoilNetworkFetcherRegistered()
    val canProceed = charactersCount in question.minCharacters..question.maxCharacters

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Timer, null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(timeRemaining, color = if (isTimeLow) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.Close, stringResource(Res.string.gpe_exit_cd))
                    }
                }
            )
        },
        bottomBar = {
            Surface(modifier = Modifier.fillMaxWidth(), shadowElevation = 8.dp) {
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            stringResource(Res.string.gto_char_count_label, charactersCount),
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (canProceed) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                        )
                        Text(
                            stringResource(Res.string.gto_char_range_label, question.minCharacters, question.maxCharacters),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(onClick = onProceedToReview, modifier = Modifier.fillMaxWidth(), enabled = canProceed) {
                        Text(stringResource(Res.string.gpe_continue_to_review))
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp).imePadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (question.imageUrl.isNotEmpty()) {
                Card(modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f), elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        AsyncImage(
                            model = question.imageUrl,
                            contentDescription = stringResource(Res.string.gpe_test_image),
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                }
            }

            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(Res.string.gpe_scenario_label), style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSecondaryContainer)
                    Text(question.scenario, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)

                    if (question.resources.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(stringResource(Res.string.gpe_resources_available), style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSecondaryContainer)
                        question.resources.forEach { resource ->
                            Text("• $resource", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSecondaryContainer)
                        }
                    }
                }
            }

            OutlinedTextField(
                value = planningResponse,
                onValueChange = onResponseChanged,
                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 200.dp),
                label = { Text(stringResource(Res.string.gpe_planning_response_label)) },
                placeholder = { Text(stringResource(Res.string.gpe_planning_response_placeholder)) },
                isError = charactersCount > question.maxCharacters,
                maxLines = Int.MAX_VALUE
            )

            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(Res.string.gpe_planning_guidelines),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                    Text("• " + stringResource(Res.string.gpe_guideline_1), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                    Text("• " + stringResource(Res.string.gpe_guideline_2), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                    Text("• " + stringResource(Res.string.gpe_guideline_3), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
                }
            }
        }
    }
}
