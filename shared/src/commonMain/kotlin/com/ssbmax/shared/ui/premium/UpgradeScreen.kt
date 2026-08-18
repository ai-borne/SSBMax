package com.ssbmax.shared.ui.premium

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.BillingCycle
import com.ssbmax.shared.presentation.premium.UpgradeViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.premium_billing_cycle_annually
import ssbmax.shared.generated.resources.premium_billing_cycle_monthly
import ssbmax.shared.generated.resources.premium_billing_cycle_quarterly
import ssbmax.shared.generated.resources.premium_billing_save_annually
import ssbmax.shared.generated.resources.premium_billing_save_quarterly
import ssbmax.shared.generated.resources.premium_cd_back
import ssbmax.shared.generated.resources.premium_info_cancel
import ssbmax.shared.generated.resources.premium_info_secure
import ssbmax.shared.generated.resources.premium_info_support
import ssbmax.shared.generated.resources.premium_upgrade_header
import ssbmax.shared.generated.resources.premium_upgrade_subtitle
import ssbmax.shared.generated.resources.premium_upgrade_title
import ssbmax.shared.generated.resources.premium_web_subscription_active

/**
 * KMP port of the Android `app/.../ui/premium/UpgradeScreen.kt` -- the LIVE
 * upgrade/subscription-tier-comparison screen (route "premium/upgrade").
 * See [UpgradeViewModel]'s class doc for why the sibling Android
 * `com.ssbmax.ui.upgrade`/`com.ssbmax.ui.payment` packages were NOT ported
 * (dead code, unreachable from any Android nav graph).
 *
 * Split across this file (screen shell + billing-cycle selector + info/footer),
 * `UpgradePlanCard.kt` (the per-plan animated card), `PurchaseErrorDialog.kt`,
 * and `RestorePurchasesRow.kt` to stay under this repo's 300-line-per-file
 * Quality Limit -- the Android original was a single 463-line file.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UpgradeScreen(
    onNavigateBack: () -> Unit,
    viewModel: UpgradeViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var isVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        isVisible = true
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.premium_upgrade_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.premium_cd_back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                UpgradeHeader()
            }

            item {
                BillingCycleSelector(
                    selectedCycle = uiState.selectedBillingCycle,
                    onCycleSelected = { viewModel.selectBillingCycle(it) },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            if (uiState.activeOnWebInstead) {
                item {
                    WebSubscriptionActiveBanner()
                }
            }

            items(uiState.availablePlans) { plan ->
                AnimatedPlanCard(
                    plan = plan,
                    currentTier = uiState.currentTier,
                    selectedBillingCycle = uiState.selectedBillingCycle,
                    isVisible = isVisible,
                    purchaseState = PlanCardPurchaseState(
                        isPurchasing = uiState.isPurchasing && uiState.selectedPlanForUpgrade == plan.tier,
                        storeFormattedPrice = uiState.storeFormattedPrices[plan.tier],
                        purchaseBlocked = uiState.activeOnWebInstead
                    ),
                    onUpgradeClick = { viewModel.upgradeToPlan(plan.tier) }
                )
            }

            item {
                RestorePurchasesRow(isRestoring = uiState.isRestoring, onClick = { viewModel.restorePurchases() })
            }

            item {
                InfoSection()
            }
        }
    }

    uiState.purchaseError?.let { message ->
        PurchaseErrorDialog(
            message = message,
            onDismiss = { viewModel.dismissPurchaseError() }
        )
    }
}

/** Shown above the plan grid when [UpgradeUiState.activeOnWebInstead] is true -- see
 * [UpgradeViewModel.upgradeToPlan]'s dual-purchase gate. */
@Composable
private fun WebSubscriptionActiveBanner(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Filled.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Spacer(Modifier.width(12.dp))
            Text(
                stringResource(Res.string.premium_web_subscription_active),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}

@Composable
private fun UpgradeHeader(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            stringResource(Res.string.premium_upgrade_header),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(Res.string.premium_upgrade_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun BillingCycleSelector(
    selectedCycle: BillingCycle,
    onCycleSelected: (BillingCycle) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            BillingCycle.entries.forEach { cycle ->
                FilterChip(
                    selected = selectedCycle == cycle,
                    onClick = { onCycleSelected(cycle) },
                    label = {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                stringResource(
                                    when (cycle) {
                                        BillingCycle.MONTHLY -> Res.string.premium_billing_cycle_monthly
                                        BillingCycle.QUARTERLY -> Res.string.premium_billing_cycle_quarterly
                                        BillingCycle.ANNUALLY -> Res.string.premium_billing_cycle_annually
                                    }
                                ),
                                style = MaterialTheme.typography.labelLarge
                            )
                            if (cycle != BillingCycle.MONTHLY) {
                                Text(
                                    stringResource(
                                        when (cycle) {
                                            BillingCycle.QUARTERLY -> Res.string.premium_billing_save_quarterly
                                            BillingCycle.ANNUALLY -> Res.string.premium_billing_save_annually
                                            else -> Res.string.premium_billing_cycle_monthly
                                        }
                                    ),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    },
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun InfoSection(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Security, contentDescription = null)
                Spacer(Modifier.width(12.dp))
                Text(stringResource(Res.string.premium_info_secure), style = MaterialTheme.typography.bodyMedium)
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Refresh, contentDescription = null)
                Spacer(Modifier.width(12.dp))
                Text(stringResource(Res.string.premium_info_cancel), style = MaterialTheme.typography.bodyMedium)
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.SupportAgent, contentDescription = null)
                Spacer(Modifier.width(12.dp))
                Text(stringResource(Res.string.premium_info_support), style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
