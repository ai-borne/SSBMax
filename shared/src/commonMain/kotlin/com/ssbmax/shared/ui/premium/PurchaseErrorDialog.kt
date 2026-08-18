package com.ssbmax.shared.ui.premium

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.premium_dialog_action_got_it
import ssbmax.shared.generated.resources.premium_dialog_purchase_error_title

/** Split out of `UpgradePlanCard.kt` to keep both files under this repo's 300-line Quality Limit. */
@Composable
internal fun PurchaseErrorDialog(
    message: String,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(Icons.Default.Error, contentDescription = null, modifier = Modifier.size(48.dp))
        },
        title = {
            Text(stringResource(Res.string.premium_dialog_purchase_error_title), fontWeight = FontWeight.Bold)
        },
        text = {
            Text(message, textAlign = TextAlign.Center)
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(Res.string.premium_dialog_action_got_it))
            }
        }
    )
}
