package com.ssbmax.shared.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.InternalComposeUiApi
import androidx.compose.ui.backhandler.LocalCompatNavigationEventDispatcherOwner
import androidx.navigationevent.NavigationEventHandler
import androidx.navigationevent.NavigationEventInfo

@OptIn(InternalComposeUiApi::class)
@Composable
actual fun SsbBackHandler(enabled: Boolean, onBack: () -> Unit) {
    val owner = LocalCompatNavigationEventDispatcherOwner.current
        ?: error("No NavigationEventDispatcher was provided via LocalCompatNavigationEventDispatcherOwner")
    val dispatcher = owner.navigationEventDispatcher
    val handler = remember(onBack) { SsbBackEventHandler(enabled, onBack) }
    handler.isBackEnabled = enabled

    DisposableEffect(dispatcher, handler) {
        dispatcher.addHandler(handler)
        onDispose { handler.remove() }
    }
}

private class SsbBackEventHandler(
    enabled: Boolean,
    private val onBack: () -> Unit
) : NavigationEventHandler<NavigationEventInfo.None>(
    initialInfo = NavigationEventInfo.None,
    isBackEnabled = enabled,
) {
    override fun onBackCompleted() {
        onBack()
    }
}
