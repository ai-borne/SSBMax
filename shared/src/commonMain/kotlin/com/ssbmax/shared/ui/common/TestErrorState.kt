package com.ssbmax.shared.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.presentation.common.TestError
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.test_error_auth_required
import ssbmax.shared.generated.resources.test_error_cloud_required
import ssbmax.shared.generated.resources.test_error_load_failed
import ssbmax.shared.generated.resources.test_error_login_to_submit
import ssbmax.shared.generated.resources.test_error_network_unavailable
import ssbmax.shared.generated.resources.test_error_retry_button
import ssbmax.shared.generated.resources.test_error_submit_failed

/**
 * Shared replacement for the 5 copy-pasted private `ErrorState` composables
 * (TAT/WAT/SRT/SDT/PPDT screens), which duplicated both the layout and a
 * per-screen `*_retry_button` string. [testErrorMessageRes] is exposed
 * separately so screens that don't use this full-screen layout (PIQ's
 * `AlertDialog`) can still resolve the same one-site enum->string mapping.
 */
@Composable
fun TestErrorState(error: TestError, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .semantics { liveRegion = LiveRegionMode.Polite },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(text = testErrorMessage(error), style = MaterialTheme.typography.bodyMedium)
            Button(onClick = onRetry) { Text(stringResource(Res.string.test_error_retry_button)) }
        }
    }
}

@Composable
fun testErrorMessage(error: TestError): String = stringResource(testErrorMessageRes(error))

fun testErrorMessageRes(error: TestError): StringResource = when (error) {
    TestError.AUTH_REQUIRED -> Res.string.test_error_auth_required
    TestError.NETWORK_UNAVAILABLE -> Res.string.test_error_network_unavailable
    TestError.CLOUD_REQUIRED -> Res.string.test_error_cloud_required
    TestError.LOGIN_TO_SUBMIT -> Res.string.test_error_login_to_submit
    TestError.SUBMIT_FAILED -> Res.string.test_error_submit_failed
    TestError.LOAD_FAILED -> Res.string.test_error_load_failed
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun TestErrorStatePreview() {
    TestErrorState(error = TestError.CLOUD_REQUIRED, onRetry = {})
}
