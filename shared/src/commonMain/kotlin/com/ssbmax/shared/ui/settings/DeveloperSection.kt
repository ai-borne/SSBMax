package com.ssbmax.shared.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.SubscriptionOverride
import com.ssbmax.shared.presentation.settings.developer.DeveloperSettingsUiState
import com.ssbmax.shared.presentation.settings.developer.DeveloperSettingsViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.developer_bypass_interview_prerequisites_description
import ssbmax.shared.generated.resources.developer_bypass_interview_prerequisites_title
import ssbmax.shared.generated.resources.developer_known_limitation_note
import ssbmax.shared.generated.resources.developer_override_force_basic
import ssbmax.shared.generated.resources.developer_override_force_free
import ssbmax.shared.generated.resources.developer_override_force_premium
import ssbmax.shared.generated.resources.developer_override_force_pro
import ssbmax.shared.generated.resources.developer_override_follow_real
import ssbmax.shared.generated.resources.developer_override_offline_note
import ssbmax.shared.generated.resources.developer_section_description
import ssbmax.shared.generated.resources.developer_section_title

/**
 * Dev-only tier override + interview-prerequisite bypass section for [SettingsScreen] — KMP port
 * of Phase 5 of the dev-subscription-override plan, mirroring [ThemeSection]'s RadioButton-group
 * shape.
 *
 * Renders nothing when [DeveloperSettingsUiState.isVisible] is false (i.e. not a debug build) --
 * [SettingsScreen] always includes this in its `LazyColumn`, matching every other section there,
 * rather than gating at the call site.
 */
@Composable
fun DeveloperSection(modifier: Modifier = Modifier) {
    val viewModel: DeveloperSettingsViewModel = koinViewModel()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    if (!uiState.isVisible) return

    DeveloperSectionContent(
        uiState = uiState,
        onOverrideSelected = viewModel::updateOverride,
        onBypassChanged = viewModel::updateBypassInterviewPrerequisites,
        modifier = modifier
    )
}

@Composable
private fun DeveloperSectionContent(
    uiState: DeveloperSettingsUiState,
    onOverrideSelected: (SubscriptionOverride) -> Unit,
    onBypassChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.BugReport, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                Text(
                    text = stringResource(Res.string.developer_section_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Text(stringResource(Res.string.developer_section_description), style = MaterialTheme.typography.bodySmall)
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Column(modifier = Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SubscriptionOverride.entries.forEach { override ->
                    OverrideOption(
                        override = override,
                        isSelected = uiState.override == override,
                        onSelected = { onOverrideSelected(override) }
                    )
                }
            }
            Text(stringResource(Res.string.developer_override_offline_note), style = MaterialTheme.typography.bodySmall)
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            BypassInterviewPrerequisitesRow(uiState.bypassInterviewPrerequisites, onBypassChanged)
            Text(stringResource(Res.string.developer_known_limitation_note), style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun OverrideOption(
    override: SubscriptionOverride,
    isSelected: Boolean,
    onSelected: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = override.label(),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal
        )
        RadioButton(selected = isSelected, onClick = onSelected)
    }
}

@Composable
private fun BypassInterviewPrerequisitesRow(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stringResource(Res.string.developer_bypass_interview_prerequisites_title),
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = stringResource(Res.string.developer_bypass_interview_prerequisites_description),
                style = MaterialTheme.typography.bodySmall
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun SubscriptionOverride.label(): String = when (this) {
    SubscriptionOverride.FOLLOW_REAL -> stringResource(Res.string.developer_override_follow_real)
    SubscriptionOverride.FORCE_FREE -> stringResource(Res.string.developer_override_force_free)
    SubscriptionOverride.FORCE_BASIC -> stringResource(Res.string.developer_override_force_basic)
    SubscriptionOverride.FORCE_PRO -> stringResource(Res.string.developer_override_force_pro)
    SubscriptionOverride.FORCE_PREMIUM -> stringResource(Res.string.developer_override_force_premium)
}

// detekt's UnusedPrivateMember doesn't recognize @Preview-only call sites (tooling/reflection,
// not a real caller) -- this codebase's first real @Preview, so the first time this false
// positive has come up here.
@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun DeveloperSectionPreview() {
    DeveloperSectionContent(
        uiState = DeveloperSettingsUiState(isVisible = true, override = SubscriptionOverride.FORCE_PRO),
        onOverrideSelected = {},
        onBypassChanged = {}
    )
}
