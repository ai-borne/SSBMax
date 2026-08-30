package com.ssbmax.shared.ui.components.account

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.ACCOUNT_DELETION_GRACE_PERIOD_DAYS
import com.ssbmax.shared.ui.theme.SSBMaxTheme
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.delete_account_cancel_button
import ssbmax.shared.generated.resources.delete_account_confirm_body
import ssbmax.shared.generated.resources.delete_account_confirm_button
import ssbmax.shared.generated.resources.delete_account_confirm_checkbox
import ssbmax.shared.generated.resources.delete_account_confirm_title
import ssbmax.shared.generated.resources.deletion_pending_banner
import ssbmax.shared.generated.resources.drawer_cancel_deletion

/**
 * KMP mirror of web's `DeleteAccountModal.tsx` (docs/plans/AccountDeletion.md Phase 4) -- second,
 * explicit confirmation step for the irreversible-after-grace-period delete flow. The confirm
 * button stays disabled until the checkbox is ticked, same irreversibility guard as web.
 */
@Composable
fun DeleteAccountConfirmDialog(
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    var acknowledged by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(Res.string.delete_account_confirm_title)) },
        text = {
            Column {
                Text(stringResource(Res.string.delete_account_confirm_body, ACCOUNT_DELETION_GRACE_PERIOD_DAYS))
                Spacer(modifier = Modifier.height(12.dp))
                Row {
                    Checkbox(checked = acknowledged, onCheckedChange = { acknowledged = it })
                    Text(
                        text = stringResource(
                            Res.string.delete_account_confirm_checkbox,
                            ACCOUNT_DELETION_GRACE_PERIOD_DAYS
                        ),
                        modifier = Modifier.padding(top = 12.dp)
                    )
                }
                if (isLoading) {
                    Spacer(modifier = Modifier.height(12.dp))
                    CircularProgressIndicator()
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                enabled = acknowledged && !isLoading,
                colors = ButtonDefaults.textButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) { Text(stringResource(Res.string.delete_account_confirm_button)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isLoading) {
                Text(stringResource(Res.string.delete_account_cancel_button))
            }
        }
    )
}

/**
 * Shown after [DeleteAccountConfirmDialog] succeeds (mirrors web's `deletionPendingBanner`) --
 * lets the user cancel within the grace period, same [drawer_cancel_deletion] action the drawer
 * entry itself switches to while a deletion is pending.
 */
@Composable
fun DeletionPendingDialog(
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onCancelDeletion: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(Res.string.deletion_pending_banner)) },
        text = { if (isLoading) CircularProgressIndicator() },
        confirmButton = {
            TextButton(onClick = onCancelDeletion, enabled = !isLoading) {
                Text(stringResource(Res.string.drawer_cancel_deletion))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isLoading) {
                Text(stringResource(Res.string.delete_account_cancel_button))
            }
        }
    )
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun DeleteAccountConfirmDialogPreview() {
    SSBMaxTheme {
        DeleteAccountConfirmDialog(isLoading = false, onDismiss = {}, onConfirm = {})
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun DeletionPendingDialogPreview() {
    SSBMaxTheme {
        DeletionPendingDialog(isLoading = false, onDismiss = {}, onCancelDeletion = {})
    }
}
