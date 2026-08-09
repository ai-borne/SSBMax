package com.ssbmax.shared.presentation.oir

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlin.time.Clock

internal fun startOIRTimer(
    scope: CoroutineScope,
    uiState: MutableStateFlow<OIRTestUiState>,
    onExpired: () -> Unit
): Job = scope.launch {
    try {
        while (isActive && uiState.value.isTimerActive && !uiState.value.isCompleted) {
            delay(1000)
            if (!isActive || !uiState.value.isTimerActive) break
            val session = uiState.value.session ?: return@launch
            val remaining = ((session.expiresAt - Clock.System.now().toEpochMilliseconds()) / 1000L)
                .toInt().coerceAtLeast(0)
            uiState.update { state ->
                state.copy(
                    timeRemainingSeconds = remaining,
                    session = state.session?.copy(timeRemainingSeconds = remaining)
                )
            }
            if (remaining == 0 && isActive && uiState.value.isTimerActive) onExpired()
        }
    } finally {
        uiState.update { it.copy(isTimerActive = false) }
    }
}
