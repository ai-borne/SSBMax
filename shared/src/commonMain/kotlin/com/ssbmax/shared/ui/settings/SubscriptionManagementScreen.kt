package com.ssbmax.shared.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.presentation.settings.SubscriptionManagementUiState
import com.ssbmax.shared.presentation.settings.SubscriptionManagementViewModel
import com.ssbmax.shared.presentation.settings.SubscriptionTierModel
import com.ssbmax.shared.ui.common.loadingSemantics
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.subscription_mgmt_cd_back
import ssbmax.shared.generated.resources.subscription_mgmt_loading
import ssbmax.shared.generated.resources.subscription_mgmt_compare_plans
import ssbmax.shared.generated.resources.subscription_mgmt_error_generic
import ssbmax.shared.generated.resources.subscription_mgmt_retry
import ssbmax.shared.generated.resources.subscription_mgmt_title

/**
 * KMP port of the Android `app/.../ui/settings/SubscriptionManagementScreen.kt`
 * — shows current plan, monthly usage, and plan-comparison/upgrade options.
 *
 * Split across this file (screen shell + error/loading states) and
 * [SubscriptionPlanCards] (current-plan card, monthly-usage card, FAQ) to
 * stay under this repo's 300-line-per-file Quality Limit — the Android
 * original was a single 573-line file. Plan comparison itself lives only in
 * [com.ssbmax.shared.ui.premium.UpgradeScreen] (this screen's "Compare Plans"
 * button navigates there) — kept as the single tier-comparison surface
 * instead of duplicating it here.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionManagementScreen(
    onNavigateBack: () -> Unit,
    onUpgrade: () -> Unit,
    viewModel: SubscriptionManagementViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadSubscriptionData()
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.subscription_mgmt_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.subscription_mgmt_cd_back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .loadingSemantics(stringResource(Res.string.subscription_mgmt_loading)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.error != null -> {
                ErrorState(
                    error = uiState.error ?: stringResource(Res.string.subscription_mgmt_error_generic),
                    onRetry = { viewModel.loadSubscriptionData() },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                )
            }
            else -> {
                SubscriptionContent(
                    uiState = uiState,
                    onUpgrade = onUpgrade,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                )
            }
        }
    }
}

@Composable
private fun SubscriptionContent(
    uiState: SubscriptionManagementUiState,
    onUpgrade: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        CurrentPlanCard(
            tier = uiState.currentTier,
            expiresAt = uiState.subscriptionExpiresAt,
            willRenew = uiState.subscriptionWillRenew
        )

        if (uiState.currentTier != SubscriptionTierModel.PREMIUM) {
            MonthlyUsageCard(usage = uiState.monthlyUsage)
        }

        Button(
            onClick = onUpgrade,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
        ) {
            Text(text = stringResource(Res.string.subscription_mgmt_compare_plans))
        }

        SubscriptionFAQ()
    }
}

@Composable
private fun ErrorState(
    error: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = error,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text(stringResource(Res.string.subscription_mgmt_retry))
        }
    }
}
