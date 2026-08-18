package com.ssbmax.shared.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.SubscriptionTier
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.subscription_badge_basic
import ssbmax.shared.generated.resources.subscription_badge_free
import ssbmax.shared.generated.resources.subscription_badge_premium
import ssbmax.shared.generated.resources.subscription_badge_pro

/**
 * KMP port of `app/.../ui/components/SubscriptionBadge.kt` -- displays a
 * subscription tier badge, used on [ProfileAvatarWithBadge].
 */
@Composable
fun SubscriptionBadge(
    subscriptionType: SubscriptionTier,
    modifier: Modifier = Modifier
) {
    val (label, containerColor, contentColor) = when (subscriptionType) {
        SubscriptionTier.FREE -> Triple(
            stringResource(Res.string.subscription_badge_free),
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer
        )
        SubscriptionTier.BASIC -> Triple(
            stringResource(Res.string.subscription_badge_basic),
            MaterialTheme.colorScheme.secondaryContainer,
            MaterialTheme.colorScheme.onSecondaryContainer
        )
        SubscriptionTier.PRO -> Triple(
            stringResource(Res.string.subscription_badge_pro),
            MaterialTheme.colorScheme.primaryContainer,
            MaterialTheme.colorScheme.onPrimaryContainer
        )
        SubscriptionTier.PREMIUM -> Triple(
            stringResource(Res.string.subscription_badge_premium),
            MaterialTheme.colorScheme.tertiaryContainer,
            MaterialTheme.colorScheme.onTertiaryContainer
        )
    }

    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
        color = contentColor,
        modifier = modifier
            .background(color = containerColor, shape = RoundedCornerShape(12.dp))
            .border(width = 1.dp, color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(12.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    )
}
