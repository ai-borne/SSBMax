package com.ssbmax.shared.ui.common

import androidx.compose.runtime.Composable

@Composable
actual fun SsbBackHandler(enabled: Boolean, onBack: () -> Unit) =
    androidx.activity.compose.BackHandler(enabled, onBack)
