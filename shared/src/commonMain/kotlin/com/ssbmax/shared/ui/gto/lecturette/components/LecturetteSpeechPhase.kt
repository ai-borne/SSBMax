package com.ssbmax.shared.ui.gto.lecturette.components

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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.lecturette_exit_cd
import ssbmax.shared.generated.resources.lecturette_review_speech
import ssbmax.shared.generated.resources.lecturette_speech_label
import ssbmax.shared.generated.resources.lecturette_speech_placeholder
import ssbmax.shared.generated.resources.lecturette_your_topic
import ssbmax.shared.generated.resources.gto_char_count_label
import ssbmax.shared.generated.resources.gto_char_range_label

/**
 * KMP port of `app/.../ui/tests/gto/lecturette/LecturetteTestPhases.kt`'s
 * `SpeechPhase`, unchanged behavior/layout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LecturetteSpeechPhase(
    selectedTopic: String,
    speechTranscript: String,
    charCount: Int,
    timeRemaining: String,
    isTimeLow: Boolean,
    onTranscriptChanged: (String) -> Unit,
    onProceedToReview: () -> Unit,
    onNavigateBack: () -> Unit
) {
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
                        Icon(Icons.Default.Close, stringResource(Res.string.lecturette_exit_cd))
                    }
                }
            )
        },
        bottomBar = {
            Surface(modifier = Modifier.fillMaxWidth(), shadowElevation = 8.dp) {
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            stringResource(Res.string.gto_char_count_label, charCount),
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (charCount < 50 || charCount > 1500) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                        )
                        Text(stringResource(Res.string.gto_char_range_label, 50, 1500), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(onClick = onProceedToReview, modifier = Modifier.fillMaxWidth(), enabled = charCount in 50..1500) {
                        Text(stringResource(Res.string.lecturette_review_speech))
                    }
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding()) {
            Card(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(stringResource(Res.string.lecturette_your_topic), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(selectedTopic, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                }
            }

            OutlinedTextField(
                value = speechTranscript,
                onValueChange = onTranscriptChanged,
                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 300.dp).padding(horizontal = 16.dp),
                placeholder = { Text(stringResource(Res.string.lecturette_speech_placeholder)) },
                textStyle = MaterialTheme.typography.bodyLarge,
                label = { Text(stringResource(Res.string.lecturette_speech_label)) },
                maxLines = Int.MAX_VALUE
            )

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
