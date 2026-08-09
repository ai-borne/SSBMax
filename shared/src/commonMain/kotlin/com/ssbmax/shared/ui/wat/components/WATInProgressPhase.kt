package com.ssbmax.shared.ui.wat.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ssbmax.shared.ui.common.timerSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.wat_back_cd
import ssbmax.shared.generated.resources.wat_progress_format
import ssbmax.shared.generated.resources.wat_response_placeholder
import ssbmax.shared.generated.resources.wat_skip
import ssbmax.shared.generated.resources.wat_submit
import ssbmax.shared.generated.resources.wat_timer_content_description
import ssbmax.shared.generated.resources.wat_timer_format

/**
 * KMP port of `app/.../ui/tests/wat/components/WATInProgressView.kt`. Unlike
 * TAT (image-viewing + writing as two separate phases/timers), WAT collapses
 * to a single phase: word display + response field + one 15s timer, matching
 * the real Android state machine read before porting -- there is no separate
 * viewing phase for WAT. The exit-confirmation `AlertDialog` from the Android
 * original is extracted to [WATExitDialog] (`WATDialogs.kt`) rather than
 * inlined here, matching TAT/PPDT's dialog-extraction precedent; this
 * composable renders only the header + word + response body.
 */
@Composable
fun WATInProgressPhase(
    word: String,
    wordNumber: Int,
    totalWords: Int,
    timeRemaining: Int,
    response: String,
    onResponseChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onSkip: () -> Unit,
    onShowExitDialog: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = if (timeRemaining <= 5) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surface
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            WATHeader(wordNumber, totalWords, timeRemaining, onShowExitDialog)
            WATActiveContent(
                word = word,
                response = response,
                onResponseChange = onResponseChange,
                onSubmit = onSubmit,
                onSkip = onSkip,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun WATHeader(
    wordNumber: Int,
    totalWords: Int,
    timeRemaining: Int,
    onShowExitDialog: () -> Unit
) {
    val timerDescription = stringResource(Res.string.wat_timer_content_description, timeRemaining)
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onShowExitDialog) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.wat_back_cd))
        }
        Text(
            stringResource(Res.string.wat_progress_format, wordNumber, totalWords),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Card(
            modifier = Modifier.timerSemantics(
                description = timerDescription,
                remainingSeconds = timeRemaining,
                totalSeconds = 15
            ),
            colors = CardDefaults.cardColors(
                containerColor = if (timeRemaining <= 5) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
            )
        ) {
            Text(
                stringResource(Res.string.wat_timer_format, timeRemaining),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimary
            )
        }
    }
}

@Composable
private fun WATActiveContent(
    word: String,
    response: String,
    onResponseChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .imePadding(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Spacer(Modifier.height(16.dp))

        AnimatedContent(
            targetState = word,
            transitionSpec = { fadeIn() + scaleIn() togetherWith fadeOut() + scaleOut() },
            label = "word_animation"
        ) { currentWord ->
            Text(
                text = currentWord,
                style = MaterialTheme.typography.displayLarge.copy(fontSize = 36.sp),
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp)
            )
        }

        OutlinedTextField(
            value = response,
            onValueChange = onResponseChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(stringResource(Res.string.wat_response_placeholder)) },
            singleLine = true,
            textStyle = MaterialTheme.typography.titleLarge.copy(textAlign = TextAlign.Center)
        )

        Spacer(Modifier.height(16.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onSkip, modifier = Modifier.weight(1f)) {
                Text(stringResource(Res.string.wat_skip))
            }
            Button(onClick = onSubmit, modifier = Modifier.weight(1f), enabled = response.isNotBlank()) {
                Text(stringResource(Res.string.wat_submit))
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}
