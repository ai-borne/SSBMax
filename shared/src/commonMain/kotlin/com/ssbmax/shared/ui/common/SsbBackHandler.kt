package com.ssbmax.shared.ui.common

import androidx.compose.runtime.Composable

/**
 * KMP `expect`/`actual` shim replacing the now-deprecated
 * `androidx.compose.ui.backhandler.BackHandler` ("Use NavigationEventHandler instead").
 * The official replacement's Compose wrapper, `androidx.navigationevent.compose.*`, has no
 * published iOS klib at the `navigationevent-compose` version Compose Multiplatform 1.10.3
 * resolves (`navigationevent-compose-iosarm64` skips straight from `1.0.0-alpha07` to
 * `1.1.0-alpha01`) -- so a direct swap doesn't compile for the iOS target.
 *
 * Android actual: delegates straight to `androidx.activity.compose.BackHandler`, the same
 * still-supported, non-deprecated function the deprecated `androidx.compose.ui.backhandler`
 * wrapper itself delegates to on Android.
 * iOS actual: reimplements the same small adapter Compose UI uses internally for its own
 * deprecated `BackHandler` (`BackHandler.jb.kt`'s private `BackEventHandler`) directly against
 * `androidx.navigationevent.NavigationEventHandler`, the base (non-Compose) artifact, which
 * *does* ship full iOS klibs -- no extra dependency needed.
 */
@Composable
expect fun SsbBackHandler(enabled: Boolean = true, onBack: () -> Unit)
