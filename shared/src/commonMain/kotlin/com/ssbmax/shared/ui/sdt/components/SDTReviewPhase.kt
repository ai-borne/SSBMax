package com.ssbmax.shared.ui.sdt.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.SDTQuestion
import com.ssbmax.shared.domain.model.SDTQuestionResponse
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.sdt_action_submit_test
import ssbmax.shared.generated.resources.sdt_char_count_label
import ssbmax.shared.generated.resources.sdt_edit
import ssbmax.shared.generated.resources.sdt_review_question_number
import ssbmax.shared.generated.resources.sdt_review_skipped

/**
 * KMP port of `app/.../ui/tests/sdt/SDTTestScreen.kt`'s `ReviewScreen`. Same
 * shape as [com.ssbmax.shared.ui.srt.components.SRTReviewPhase]: candidate
 * can revisit and edit any prior answer before a final explicit submit,
 * confirmed by reading the real Android `SDTTestViewModel`
 * (`editQuestion(index)` jumps back to `IN_PROGRESS` at that index).
 *
 * Renders body content only -- no own `TopAppBar`. [SDTTestScreen] hosts a
 * single `Scaffold`-level `TopAppBar` shared by every
 * [com.ssbmax.shared.domain.model.SDTPhase], with [SDTReviewBottomBar]
 * supplying this phase's submit button to that Scaffold's `bottomBar` slot
 * (same consolidation as [com.ssbmax.shared.ui.srt.components.SRTReviewPhase]).
 */
@Composable
fun SDTReviewPhase(
    questions: List<SDTQuestion>,
    responses: List<SDTQuestionResponse>,
    onEdit: (Int) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        itemsIndexed(questions) { index, question ->
            val response = responses.getOrNull(index)
            SDTReviewCard(index = index, question = question, response = response, onEdit = { onEdit(index) })
        }
    }
}

@Composable
fun SDTReviewBottomBar(onSubmit: () -> Unit) {
    Surface(tonalElevation = 3.dp) {
        Button(onClick = onSubmit, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Text(stringResource(Res.string.sdt_action_submit_test))
        }
    }
}

@Composable
private fun SDTReviewCard(
    index: Int,
    question: SDTQuestion,
    response: SDTQuestionResponse?,
    onEdit: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(Res.string.sdt_review_question_number, index + 1),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                IconButton(onClick = onEdit) {
                    Icon(Icons.Default.Edit, contentDescription = stringResource(Res.string.sdt_edit))
                }
            }
            Text(question.question, style = MaterialTheme.typography.bodyMedium)
            HorizontalDivider()
            if (response != null && !response.isSkipped) {
                Text(response.answer, style = MaterialTheme.typography.bodySmall)
                Text(
                    stringResource(Res.string.sdt_char_count_label, response.charCount),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            } else {
                Text(
                    stringResource(Res.string.sdt_review_skipped),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
