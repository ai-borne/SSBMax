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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.progressSemantics
import com.ssbmax.shared.ui.common.timerSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.sdt_action_exit
import ssbmax.shared.generated.resources.sdt_action_next
import ssbmax.shared.generated.resources.sdt_action_review
import ssbmax.shared.generated.resources.sdt_action_skip
import ssbmax.shared.generated.resources.sdt_answer_label
import ssbmax.shared.generated.resources.sdt_char_count
import ssbmax.shared.generated.resources.sdt_progress_content_description
import ssbmax.shared.generated.resources.sdt_question_header
import ssbmax.shared.generated.resources.sdt_timer_content_description

/**
 * KMP port of `app/.../ui/tests/sdt/SDTTestScreen.kt`'s `QuestionInProgressView`
 * and its `TimerDisplay`. Unlike SRT (single countdown card in a plain
 * header), the Android original renders the timer directly in the
 * `TopAppBar`'s actions slot -- reproduced here unchanged. The exit
 * confirmation `AlertDialog` from the Android original is extracted to
 * [SDTExitDialog] (`SDTDialogs.kt`), matching TAT/WAT/SRT/PPDT's
 * dialog-extraction precedent; this composable renders only the top bar +
 * progress + question + answer body.
 */
@OptIn(ExperimentalMaterial3Api::class)
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
    timeRemaining: Int,
    canMoveNext: Boolean,
    onNext: () -> Unit,
    onSkip: () -> Unit,
    onShowExitDialog: () -> Unit
) {
    val progressDescription = stringResource(
        Res.string.sdt_progress_content_description,
        (questionNumber * 100 / totalQuestions).coerceIn(0, 100)
    )
    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(stringResource(Res.string.sdt_question_header, questionNumber, totalQuestions)) },
            navigationIcon = {
                IconButton(onClick = onShowExitDialog) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.sdt_action_exit))
                }
            },
            actions = { SDTTimerDisplay(timeRemaining) }
        )

        Column(
            modifier = Modifier
                .weight(1f)
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
}

@Composable
private fun SDTTimerDisplay(timeRemaining: Int) {
    val timerDescription = stringResource(Res.string.sdt_timer_content_description, timeRemaining)
    val minutes = timeRemaining / 60
    val seconds = timeRemaining % 60
    val secondsStr = if (seconds < 10) "0$seconds" else "$seconds"
    val color = when {
        timeRemaining > 300 -> MaterialTheme.colorScheme.primary
        timeRemaining > 60 -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.error
    }
    Text(
        "$minutes:$secondsStr",
        color = color,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .padding(end = 16.dp)
            .timerSemantics(
                description = timerDescription,
                remainingSeconds = timeRemaining,
                totalSeconds = 1800
            )
    )
}
