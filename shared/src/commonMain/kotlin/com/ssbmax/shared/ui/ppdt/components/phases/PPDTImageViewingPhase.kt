package com.ssbmax.shared.ui.ppdt.components.phases

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale

import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.ssbmax.shared.ui.common.ensureCoilNetworkFetcherRegistered
import com.ssbmax.shared.ui.common.progressSemantics
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.ppdt_image_content_description
import ssbmax.shared.generated.resources.ppdt_image_observe_instruction
import ssbmax.shared.generated.resources.ppdt_progress_content_description

/**
 * KMP port of `app/.../ui/tests/ppdt/components/phases/PPDTImageViewingPhase.kt`.
 *
 * Real change from the Android original (same as `OIRQuestionCard`'s
 * documented precedent): `coil.compose.AsyncImage` (Coil 2, Android-only)
 * with a manual `ImageRequest.Builder(LocalContext.current)` is replaced by
 * `coil3.compose.AsyncImage(model = imageUrl, ...)` -- Coil3's Compose
 * Multiplatform API takes the URL directly and uses its own
 * `SingletonImageLoader` (already memory+disk caching), so no
 * `LocalContext`/`ImageRequest` construction is needed at all. `LocalContext`
 * itself has no common actual on iOS, which is the real reason the manual
 * builder can't be ported as-is.
 */
@Composable
fun PPDTImageViewingPhase(
    imageUrl: String,
    timeRemainingSeconds: Int,
    totalSeconds: Int = 30
) {
    ensureCoilNetworkFetcherRegistered()
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        ) {
            Text(
                text = stringResource(Res.string.ppdt_image_observe_instruction),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.padding(16.dp),
                textAlign = TextAlign.Center
            )
        }
        Spacer(Modifier.height(16.dp))
        PPDTImageCard(imageUrl)
        Spacer(Modifier.weight(1f))
        PPDTTimerProgressBar(timeRemainingSeconds = timeRemainingSeconds, totalSeconds = totalSeconds)
    }
}

@Composable
private fun PPDTImageCard(imageUrl: String) {
    Card(
        modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            AsyncImage(
                model = imageUrl,
                contentDescription = stringResource(Res.string.ppdt_image_content_description),
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }
    }
}

@Composable
private fun PPDTTimerProgressBar(timeRemainingSeconds: Int, totalSeconds: Int) {
    val progressDescription = stringResource(
        Res.string.ppdt_progress_content_description,
        (timeRemainingSeconds * 100 / totalSeconds).coerceIn(0, 100)
    )
    LinearProgressIndicator(
        progress = { timeRemainingSeconds / totalSeconds.toFloat() },
        modifier = Modifier
            .fillMaxWidth()
            .progressSemantics(
                description = progressDescription,
                current = timeRemainingSeconds.toFloat(),
                maximum = totalSeconds.toFloat()
            ),
        color = MaterialTheme.colorScheme.primary
    )
}
