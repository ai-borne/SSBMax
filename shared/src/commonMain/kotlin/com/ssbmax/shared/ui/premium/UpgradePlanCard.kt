package com.ssbmax.shared.ui.premium

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.model.BillingCycle
import com.ssbmax.shared.domain.model.SubscriptionTier
import com.ssbmax.shared.presentation.premium.PlanFeature
import com.ssbmax.shared.presentation.premium.SubscriptionPlan
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.premium_plan_action_current
import ssbmax.shared.generated.resources.premium_plan_action_downgrade
import ssbmax.shared.generated.resources.premium_plan_action_upgrade
import ssbmax.shared.generated.resources.premium_plan_badge_current
import ssbmax.shared.generated.resources.premium_plan_badge_popular
import ssbmax.shared.generated.resources.premium_plan_period_month
import ssbmax.shared.generated.resources.premium_plan_period_quarter
import ssbmax.shared.generated.resources.premium_plan_period_year
import ssbmax.shared.generated.resources.premium_plan_price_free

/**
 * Purchase-related state for one [AnimatedPlanCard], grouped into one parameter to stay under
 * this repo's detekt `LongParameterList` threshold (8) now that the dual-purchase gate (Phase 4
 * amendment) added a second purchase-gating flag alongside [isPurchasing].
 */
internal data class PlanCardPurchaseState(
    val isPurchasing: Boolean,
    /** RevenueCat's store-quoted MONTHLY price for this plan, if fetched successfully -- shown
     * instead of the generated pricing contract's number when present and MONTHLY is selected
     * (RC's Test Store only has monthly products right now). Null falls back to the contract. */
    val storeFormattedPrice: String?,
    /** True when the user already has an active tier from a Razorpay/web purchase (Phase 4
     * amendment, dual-purchase gate) -- see [com.ssbmax.shared.presentation.premium.UpgradeUiState.activeOnWebInstead]. */
    val purchaseBlocked: Boolean
)

/**
 * Per-plan animated card for [UpgradeScreen]. Split across this file, [PurchaseErrorDialog], and
 * [UpgradeScreen]'s own composables to keep every file under this repo's 300-line Quality Limit.
 */
@Composable
internal fun AnimatedPlanCard(
    plan: SubscriptionPlan,
    currentTier: SubscriptionTier,
    selectedBillingCycle: BillingCycle,
    isVisible: Boolean,
    purchaseState: PlanCardPurchaseState,
    onUpgradeClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scale by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0.8f,
        animationSpec = tween(durationMillis = 300),
        label = "scale"
    )
    val alpha by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = tween(durationMillis = 300),
        label = "alpha"
    )

    Card(
        modifier = modifier.fillMaxWidth().scale(scale).alpha(alpha),
        elevation = CardDefaults.cardElevation(defaultElevation = if (plan.isRecommended) 8.dp else 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (plan.tier == currentTier) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
            PlanCardHeader(plan, currentTier, selectedBillingCycle, purchaseState.storeFormattedPrice)
            Spacer(Modifier.height(16.dp))
            plan.features.forEach { feature ->
                PlanFeatureRow(feature)
            }
            Spacer(Modifier.height(16.dp))
            UpgradeButton(
                plan = plan,
                currentTier = currentTier,
                isPurchasing = purchaseState.isPurchasing,
                purchaseBlocked = purchaseState.purchaseBlocked,
                onClick = onUpgradeClick
            )
        }
    }
}

@Composable
private fun PlanFeatureRow(feature: PlanFeature) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            if (feature.isIncluded) Icons.Default.CheckCircle else Icons.Default.Cancel,
            contentDescription = null,
            tint = if (feature.isIncluded) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
            },
            modifier = Modifier.size(20.dp)
        )
        Spacer(Modifier.width(12.dp))
        Text(
            feature.description,
            style = MaterialTheme.typography.bodyMedium,
            color = if (feature.isIncluded) {
                MaterialTheme.colorScheme.onSurface
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            }
        )
    }
}

@Composable
private fun UpgradeButton(
    plan: SubscriptionPlan,
    currentTier: SubscriptionTier,
    isPurchasing: Boolean,
    purchaseBlocked: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        enabled = plan.tier != currentTier && !isPurchasing && !purchaseBlocked,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        if (isPurchasing) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp).padding(vertical = 4.dp),
                color = MaterialTheme.colorScheme.onPrimary
            )
        } else {
            Text(
                stringResource(
                    when {
                        plan.tier == currentTier -> Res.string.premium_plan_action_current
                        plan.tier < currentTier -> Res.string.premium_plan_action_downgrade
                        else -> Res.string.premium_plan_action_upgrade
                    }
                ),
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }
    }
}

@Composable
private fun PlanCardHeader(
    plan: SubscriptionPlan,
    currentTier: SubscriptionTier,
    selectedBillingCycle: BillingCycle,
    storeFormattedPrice: String?
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(brush = Brush.horizontalGradient(colors = plan.gradient), shape = RoundedCornerShape(12.dp))
            .padding(16.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(plan.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(plan.tagline, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.9f))
                }
                if (plan.isRecommended) PlanBadge(stringResource(Res.string.premium_plan_badge_popular))
                if (plan.tier == currentTier) PlanBadge(stringResource(Res.string.premium_plan_badge_current))
            }
            Spacer(Modifier.height(16.dp))

            Row(verticalAlignment = Alignment.Bottom) {
                if (plan.tier == SubscriptionTier.FREE) {
                    Text(
                        stringResource(Res.string.premium_plan_price_free),
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                } else {
                    val displayPrice = storeFormattedPrice.takeIf { selectedBillingCycle == BillingCycle.MONTHLY }
                        ?: "₹${plan.getPriceForCycle(selectedBillingCycle).toInt()}"
                    Text(displayPrice, style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = Color.White)
                    Text(
                        stringResource(
                            when (selectedBillingCycle) {
                                BillingCycle.MONTHLY -> Res.string.premium_plan_period_month
                                BillingCycle.QUARTERLY -> Res.string.premium_plan_period_quarter
                                BillingCycle.ANNUALLY -> Res.string.premium_plan_period_year
                            }
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f),
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }
            }
            plan.getSavingsForCycle(selectedBillingCycle)?.let { savings ->
                Text(
                    savings,
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White.copy(alpha = 0.9f),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun PlanBadge(text: String) {
    Surface(shape = RoundedCornerShape(8.dp), color = Color.White.copy(alpha = 0.3f)) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}
