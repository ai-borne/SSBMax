package com.ssbmax.shared.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.update_required_body
import ssbmax.shared.generated.resources.update_required_title

/**
 * Phase 8 (Cross-Platform SSOT plan) remote kill-switch blocking state --
 * rendered by [com.ssbmax.shared.ui.SSBMaxRoot] in place of the normal nav
 * graph whenever [com.ssbmax.shared.domain.model.isAppVersionBelowMinimum]
 * is true for this build, so a broken release can be pulled back below the
 * live floor without an app-store re-approval. No retry/dismiss action --
 * this state cannot be escaped without an actual update.
 */
@Composable
fun UpdateRequiredScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp)
            .semantics { liveRegion = LiveRegionMode.Assertive },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text = stringResource(Res.string.update_required_title), style = MaterialTheme.typography.headlineSmall)
            Text(
                text = stringResource(Res.string.update_required_body),
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun UpdateRequiredScreenPreview() {
    UpdateRequiredScreen()
}
