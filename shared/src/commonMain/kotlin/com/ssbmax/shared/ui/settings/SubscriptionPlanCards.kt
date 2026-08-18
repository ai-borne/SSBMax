package com.ssbmax.shared.ui.settings

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Diamond
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.presentation.settings.SubscriptionTierModel
import com.ssbmax.shared.presentation.settings.UsageInfo
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.subscription_mgmt_collapse_cd
import ssbmax.shared.generated.resources.subscription_mgmt_current_plan_label
import ssbmax.shared.generated.resources.subscription_mgmt_expand_cd
import ssbmax.shared.generated.resources.subscription_mgmt_na
import ssbmax.shared.generated.resources.subscription_mgmt_renews_on
import ssbmax.shared.generated.resources.subscription_mgmt_used_of_limit
import ssbmax.shared.generated.resources.subscription_mgmt_used_suffix
import ssbmax.shared.generated.resources.subscription_mgmt_usage_title

/**
 * Current-plan / monthly-usage / plan-comparison cards for
 * [SubscriptionManagementScreen], split into their own file to keep the main
 * screen file under this repo's 300-line Quality Limit.
 */
@Composable
internal fun CurrentPlanCard(
    tier: SubscriptionTierModel,
    expiresAt: String?,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when (tier) {
                SubscriptionTierModel.FREE -> MaterialTheme.colorScheme.surface
                SubscriptionTierModel.BASIC -> MaterialTheme.colorScheme.secondaryContainer
                SubscriptionTierModel.PRO -> MaterialTheme.colorScheme.primaryContainer
                SubscriptionTierModel.PREMIUM -> MaterialTheme.colorScheme.tertiaryContainer
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = when (tier) {
                        SubscriptionTierModel.FREE -> Icons.Default.AccountCircle
                        SubscriptionTierModel.BASIC -> Icons.Default.Star
                        SubscriptionTierModel.PRO -> Icons.Default.Star
                        SubscriptionTierModel.PREMIUM -> Icons.Default.Diamond
                    },
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.primary
                )

                Column {
                    Text(
                        text = stringResource(Res.string.subscription_mgmt_current_plan_label),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = tier.displayName,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (tier != SubscriptionTierModel.FREE) {
                        Text(
                            text = tier.price,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            if (expiresAt != null && tier != SubscriptionTierModel.FREE) {
                HorizontalDivider()
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = stringResource(Res.string.subscription_mgmt_renews_on, expiresAt),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
internal fun MonthlyUsageCard(
    usage: Map<String, UsageInfo>,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        modifier = modifier.fillMaxWidth(),
        onClick = { expanded = !expanded }
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.BarChart,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = stringResource(Res.string.subscription_mgmt_usage_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) {
                        stringResource(Res.string.subscription_mgmt_collapse_cd)
                    } else {
                        stringResource(Res.string.subscription_mgmt_expand_cd)
                    }
                )
            }

            AnimatedVisibility(visible = expanded) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HorizontalDivider()
                    usage.forEach { (testType, info) ->
                        UsageRow(testType = testType, info = info)
                    }
                }
            }
        }
    }
}

@Composable
private fun UsageRow(
    testType: String,
    info: UsageInfo,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = testType, style = MaterialTheme.typography.bodyMedium)

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            LinearProgressIndicator(
                progress = {
                    when {
                        info.limit <= 0 -> 1f
                        info.limit == Int.MAX_VALUE -> 0f
                        else -> (info.used.toFloat() / info.limit.toFloat()).coerceIn(0f, 1f)
                    }
                },
                modifier = Modifier.width(60.dp),
                color = if (info.used >= info.limit && info.limit > 0) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.primary
                }
            )

            Text(
                text = when {
                    info.limit == Int.MAX_VALUE || info.limit == -1 -> stringResource(Res.string.subscription_mgmt_used_suffix, info.used)
                    info.limit == 0 -> stringResource(Res.string.subscription_mgmt_na)
                    else -> stringResource(Res.string.subscription_mgmt_used_of_limit, info.used, info.limit)
                },
                style = MaterialTheme.typography.bodySmall,
                color = when {
                    info.limit == 0 -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    info.used >= info.limit && info.limit > 0 -> MaterialTheme.colorScheme.error
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                },
                modifier = Modifier.width(60.dp),
                textAlign = TextAlign.End
            )
        }
    }
}
