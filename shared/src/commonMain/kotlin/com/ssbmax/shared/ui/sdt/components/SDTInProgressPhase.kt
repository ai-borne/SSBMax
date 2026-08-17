package com.ssbmax.shared.ui.sdt.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.progressSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.sdt_action_next
import ssbmax.shared.generated.resources.sdt_action_review
import ssbmax.shared.generated.resources.sdt_action_skip
import ssbmax.shared.generated.resources.sdt_answer_label
import ssbmax.shared.generated.resources.sdt_char_count
import ssbmax.shared.generated.resources.sdt_progress_content_description
import ssbmax.shared.generated.resources.sdt_question_header

/**
 * KMP port of `app/.../ui/tests/sdt/SDTTestScreen.kt`'s `QuestionInProgressView`
 * body (minus its top bar). The top bar lives in
 * [com.ssbmax.shared.ui.sdt.SDTTestScreen]'s single `Scaffold`-level
 * `TopAppBar`, shared across all [com.ssbmax.shared.domain.model.SDTPhase]
 * values (same consolidation as [com.ssbmax.shared.ui.wat.WATTestScreen]) --
 * a per-phase `TopAppBar` duplicated in each phase composable is how the
 * `INSTRUCTIONS` phase ended up with no top bar/status-bar inset at all in
 * the first place, so this composable renders only the progress + question +
 * answer body. The exit confirmation `AlertDialog` from the Android original
 * is extracted to [SDTExitDialog] (`SDTDialogs.kt`), matching TAT/WAT/SRT/PPDT's
 * dialog-extraction precedent.
 */
@Composable
fun SDTInProgressPhase(
    question: String,
    questionNumber: Int,
    totalQuestions: Int,
    answer: String,
    onAnswerChange: (String) -> Unit,
    charCount: Int,
    minChars: Int,
    maxChars: Int,
    canMoveNext: Boolean,
    onNext: () -> Unit,
    onSkip: () -> Unit
) {
    val progressDescription = stringResource(
        Res.string.sdt_progress_content_description,
        (questionNumber * 100 / totalQuestions).coerceIn(0, 100)
    )
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 16.dp)
            .imePadding(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        LinearProgressIndicator(
            progress = { questionNumber.toFloat() / totalQuestions },
            modifier = Modifier
                .fillMaxWidth()
                .progressSemantics(
                    description = progressDescription,
                    current = questionNumber.toFloat(),
                    maximum = totalQuestions.toFloat()
                )
        )

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(question, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
        }

        OutlinedTextField(
            value = answer,
            onValueChange = onAnswerChange,
            modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 180.dp),
            label = { Text(stringResource(Res.string.sdt_answer_label)) },
            supportingText = {
                val isError = charCount < minChars || charCount > maxChars
                Text(
                    stringResource(Res.string.sdt_char_count, charCount, maxChars, minChars),
                    color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                )
            },
            isError = charCount < minChars || charCount > maxChars,
            maxLines = Int.MAX_VALUE
        )

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onSkip, modifier = Modifier.weight(1f)) {
                Text(stringResource(Res.string.sdt_action_skip))
            }
            Button(onClick = onNext, enabled = canMoveNext, modifier = Modifier.weight(1f)) {
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(if (questionNumber < totalQuestions) Res.string.sdt_action_next else Res.string.sdt_action_review))
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
    }
}
