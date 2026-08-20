package com.ssbmax.shared.ui.premium

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.premium_restore_purchases

/** Split out of `UpgradeScreen.kt` to keep it under this repo's 300-line Quality Limit. */
@Composable
internal fun RestorePurchasesRow(
    isRestoring: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    TextButton(onClick = onClick, enabled = !isRestoring, modifier = modifier.fillMaxWidth()) {
        if (isRestoring) {
            CircularProgressIndicator(modifier = Modifier.size(16.dp).padding(end = 8.dp))
        }
        Text(stringResource(Res.string.premium_restore_purchases), style = MaterialTheme.typography.labelLarge)
    }
}
