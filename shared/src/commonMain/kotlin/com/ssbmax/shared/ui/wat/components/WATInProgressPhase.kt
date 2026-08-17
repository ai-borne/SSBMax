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
import androidx.compose.material3.Button
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
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.wat_response_placeholder
import ssbmax.shared.generated.resources.wat_skip
import ssbmax.shared.generated.resources.wat_submit

/**
 * KMP port of `app/.../ui/tests/wat/components/WATInProgressView.kt`. Unlike
 * TAT (image-viewing + writing as two separate phases/timers), WAT collapses
 * to a single phase: word display + response field + one 15s timer, matching
 * the real Android state machine read before porting -- there is no separate
 * viewing phase for WAT. The exit-confirmation `AlertDialog` from the Android
 * original is extracted to [WATExitDialog] (`WATDialogs.kt`) rather than
 * inlined here, matching TAT/PPDT's dialog-extraction precedent. The
 * progress/timer header now lives in [com.ssbmax.shared.ui.wat.WATTestScreen]'s
 * `Scaffold` topBar (so it gets proper status-bar insets, matching TAT/PPDT) --
 * this composable renders only the word + response body.
 */
@Composable
fun WATInProgressPhase(
    word: String,
    timeRemaining: Int,
    response: String,
    onResponseChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onSkip: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = if (timeRemaining <= 5) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surface
    ) {
        WATActiveContent(
            word = word,
            response = response,
            onResponseChange = onResponseChange,
            onSubmit = onSubmit,
            onSkip = onSkip,
            modifier = Modifier.fillMaxSize()
        )
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
