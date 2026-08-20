package com.ssbmax.shared.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.SubscriptionTier
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.test_limit_maybe_later
import ssbmax.shared.generated.resources.test_limit_premium_subtitle
import ssbmax.shared.generated.resources.test_limit_premium_title
import ssbmax.shared.generated.resources.test_limit_pro_subtitle
import ssbmax.shared.generated.resources.test_limit_pro_title
import ssbmax.shared.generated.resources.test_limit_recommended
import ssbmax.shared.generated.resources.test_limit_resets_label
import ssbmax.shared.generated.resources.test_limit_title
import ssbmax.shared.generated.resources.test_limit_upgrade_heading
import ssbmax.shared.generated.resources.test_limit_upgrade_now
import ssbmax.shared.generated.resources.test_limit_usage_stats

/**
 * KMP port of `app/.../ui/tests/common/TestLimitReachedDialog.kt`. Shared by
 * every test-type screen that gates on subscription limits (first consumer:
 * OIR). Android original hardcoded all its strings — a pre-existing
 * "zero hardcoded strings" lint-rule violation — ported here as real
 * composeResources entries instead of carrying the violation forward.
 */
@Composable
fun TestLimitReachedDialog(
    tier: SubscriptionTier,
    testsLimit: Int,
    testsUsed: Int,
    resetsAt: String,
    onUpgrade: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            Button(onClick = onUpgrade) {
                Text(stringResource(Res.string.test_limit_upgrade_now))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(Res.string.test_limit_maybe_later))
            }
        },
        icon = {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text(
                text = stringResource(Res.string.test_limit_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = stringResource(Res.string.test_limit_usage_stats, testsUsed, testsLimit, tier.displayName),
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center
                )

                HorizontalDivider()

                Text(
                    text = stringResource(Res.string.test_limit_resets_label),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = resetsAt,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                HorizontalDivider()

                Text(
                    text = stringResource(Res.string.test_limit_upgrade_heading),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    UpgradeBenefit(
                        title = stringResource(Res.string.test_limit_pro_title),
                        subtitle = stringResource(Res.string.test_limit_pro_subtitle),
                        isRecommended = tier == SubscriptionTier.FREE
                    )
                    UpgradeBenefit(
                        title = stringResource(Res.string.test_limit_premium_title),
                        subtitle = stringResource(Res.string.test_limit_premium_subtitle),
                        isRecommended = tier == SubscriptionTier.PRO
                    )
                }
            }
        },
        modifier = modifier
    )
}

@Composable
private fun UpgradeBenefit(
    title: String,
    subtitle: String,
    isRecommended: Boolean,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = if (isRecommended) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surfaceVariant
        },
        shape = MaterialTheme.shapes.small
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                if (isRecommended) {
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = MaterialTheme.shapes.extraSmall
                    ) {
                        Text(
                            text = stringResource(Res.string.test_limit_recommended),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
