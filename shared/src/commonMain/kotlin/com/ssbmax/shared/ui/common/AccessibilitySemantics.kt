package com.ssbmax.shared.ui.common

import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics

/**
 * Shared semantics for time-based controls and progress indicators.
 * Callers provide localized descriptions because only the consuming screen
 * knows the meaning of the value and the correct user-facing wording.
 */
fun Modifier.timerSemantics(
    description: String,
    remainingSeconds: Int,
    totalSeconds: Int
): Modifier = semantics {
    contentDescription = description
    progressBarRangeInfo = ProgressBarRangeInfo(
        current = remainingSeconds.toFloat().coerceIn(0f, totalSeconds.toFloat()),
        range = 0f..totalSeconds.toFloat()
    )
}

fun Modifier.loadingSemantics(description: String): Modifier = semantics {
    contentDescription = description
    liveRegion = LiveRegionMode.Polite
}

fun Modifier.progressSemantics(
    description: String,
    current: Float,
    maximum: Float
): Modifier = semantics {
    contentDescription = description
    progressBarRangeInfo = ProgressBarRangeInfo(
        current = current.coerceIn(0f, maximum),
        range = 0f..maximum
    )
}
