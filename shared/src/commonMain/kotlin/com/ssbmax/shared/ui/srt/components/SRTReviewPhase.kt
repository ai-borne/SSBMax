package com.ssbmax.shared.ui.srt.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.SRTSituationResponse
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.srt_edit
import ssbmax.shared.generated.resources.srt_review_completed
import ssbmax.shared.generated.resources.srt_review_title
import ssbmax.shared.generated.resources.srt_situation_prefix
import ssbmax.shared.generated.resources.srt_skipped
import ssbmax.shared.generated.resources.srt_submit_test

/**
 * KMP port of `app/.../ui/tests/srt/components/SRTReviewView.kt`. This phase
 * has no direct WAT/TAT equivalent -- SRT is the first ported test where the
 * candidate can revisit and edit any prior response before a final explicit
 * submit, confirmed by reading the real Android `SRTTestViewModel`
 * (`editResponse(index)` jumps back to `IN_PROGRESS` at that index).
 *
 * Renders body content only -- no own `Scaffold`/top bar. [SRTTestScreen]
 * hosts a single `Scaffold` shared by every [com.ssbmax.shared.domain.model.SRTPhase],
 * with [SRTReviewBottomBar] supplying this phase's submit button to that
 * Scaffold's `bottomBar` slot; nesting a second `Scaffold` here would apply
 * `WindowInsets.safeDrawing`'s top inset a second time on top of the outer
 * one, double-padding the content under the app bar.
 */
@Composable
fun SRTReviewPhase(
    responses: List<SRTSituationResponse>,
    totalSituations: Int,
    onEdit: (Int) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            SRTReviewHeader(
                validResponseCount = responses.count { it.isValidResponse },
                totalSituations = totalSituations
            )
        }
        items(responses.size) { index ->
            val response = responses[index]
            SRTResponseReviewCard(
                number = index + 1,
                situation = response.situation,
                response = response.response,
                isSkipped = response.isSkipped,
                onEdit = { onEdit(index) }
            )
        }
    }
}

@Composable
fun SRTReviewBottomBar(onSubmit: () -> Unit) {
    Surface(tonalElevation = 3.dp) {
        Button(onClick = onSubmit, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(stringResource(Res.string.srt_submit_test))
        }
    }
}

@Composable
private fun SRTReviewHeader(validResponseCount: Int, totalSituations: Int) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(stringResource(Res.string.srt_review_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(stringResource(Res.string.srt_review_completed, validResponseCount, totalSituations))
        }
    }
}

@Composable
private fun SRTResponseReviewCard(
    number: Int,
    situation: String,
    response: String,
    isSkipped: Boolean,
    onEdit: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(stringResource(Res.string.srt_situation_prefix, number), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (isSkipped) {
                    AssistChip(
                        onClick = { },
                        label = { Text(stringResource(Res.string.srt_skipped)) },
                        leadingIcon = { Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(18.dp)) },
                        colors = AssistChipDefaults.assistChipColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                    )
                }
            }

            Text(situation, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

            if (!isSkipped) {
                HorizontalDivider()
                Text(response, style = MaterialTheme.typography.bodyLarge)
            }

            OutlinedButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(Res.string.srt_edit))
            }
        }
    }
}
