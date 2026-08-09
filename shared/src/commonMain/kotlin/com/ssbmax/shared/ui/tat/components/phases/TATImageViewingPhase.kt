package com.ssbmax.shared.ui.tat.components.phases

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.ssbmax.shared.ui.common.ensureCoilNetworkFetcherRegistered
import com.ssbmax.shared.ui.common.progressSemantics
import com.ssbmax.shared.ui.common.timerSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.tat_blank_slide_instruction
import ssbmax.shared.generated.resources.tat_image_number
import ssbmax.shared.generated.resources.tat_progress_content_description
import ssbmax.shared.generated.resources.tat_timer_content_description
import ssbmax.shared.generated.resources.tat_observe_carefully
import ssbmax.shared.generated.resources.tat_picture_content_description

/**
 * KMP port of `app/.../ui/tests/tat/components/phases/TATImageViewingPhase.kt`.
 *
 * Real change from the Android original, same reasoning as PPDT's own
 * `PPDTImageViewingPhase` port: `coil.compose.AsyncImage` (Coil 2,
 * Android-only, manual `ImageRequest.Builder(LocalContext.current)`) is
 * replaced by `coil3.compose.AsyncImage(model = imageUrl, ...)` -- Coil3's
 * Compose Multiplatform API takes the URL directly, no `LocalContext`
 * (no common `actual` on iOS) needed.
 *
 * TAT-specific difference from PPDT: card 12 is a programmatic blank slide
 * (no image at all -- see `docs/architecture/TAT_Pipeline.md` §1/§6), kept
 * as its own branch exactly like the Android original's
 * `if (sequenceNumber == 12) TATBlankSlideCard() else TATImageCard(...)`.
 */
@Composable
fun TATImageViewingPhase(
    imageUrl: String,
    timeRemaining: Int,
    sequenceNumber: Int,
    totalSeconds: Int = 30
) {
    val timerDescription = stringResource(Res.string.tat_timer_content_description, timeRemaining)
    val progressDescription = stringResource(
        Res.string.tat_progress_content_description,
        (timeRemaining * 100 / totalSeconds).coerceIn(0, 100)
    )
    ensureCoilNetworkFetcherRegistered()
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        stringResource(Res.string.tat_image_number, sequenceNumber, 12),
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(stringResource(Res.string.tat_observe_carefully), style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Timer, contentDescription = null)
                    Text(
                        "${timeRemaining}s",
                        style = MaterialTheme.typography.headlineSmall,
                        color = if (timeRemaining <= 10) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                        modifier = Modifier.timerSemantics(
                            description = timerDescription,
                            remainingSeconds = timeRemaining,
                            totalSeconds = totalSeconds
                        )
                    )
                }
            }
        }

        if (sequenceNumber == 12) {
            TATBlankSlideCard()
        } else {
            TATImageCard(imageUrl = imageUrl, sequenceNumber = sequenceNumber)
        }

        Spacer(Modifier.weight(1f))

        LinearProgressIndicator(
            progress = { timeRemaining / totalSeconds.toFloat() },
            modifier = Modifier
                .fillMaxWidth()
                .progressSemantics(
                    description = progressDescription,
                    current = timeRemaining.toFloat(),
                    maximum = totalSeconds.toFloat()
                ),
            color = if (timeRemaining < 10) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
private fun TATImageCard(imageUrl: String, sequenceNumber: Int) {
    Card(
        modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            AsyncImage(
                model = imageUrl,
                contentDescription = stringResource(Res.string.tat_picture_content_description, sequenceNumber),
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }
    }
}

/** Card 12 -- programmatic blank slide, no image (imagination-only card). */
@Composable
private fun TATBlankSlideCard() {
    Card(
        modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = stringResource(Res.string.tat_blank_slide_instruction),
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray.copy(alpha = 0.3f),
                textAlign = TextAlign.Center
            )
        }
    }
}
