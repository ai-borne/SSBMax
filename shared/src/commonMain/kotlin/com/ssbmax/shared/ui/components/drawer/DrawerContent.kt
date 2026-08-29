package com.ssbmax.shared.ui.components.drawer

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.cd_collapse
import ssbmax.shared.generated.resources.cd_expand
import ssbmax.shared.generated.resources.drawer_account
import ssbmax.shared.generated.resources.drawer_cancel_deletion
import ssbmax.shared.generated.resources.drawer_conference
import ssbmax.shared.generated.resources.drawer_delete_account
import ssbmax.shared.generated.resources.drawer_gto_tests
import ssbmax.shared.generated.resources.drawer_interview
import ssbmax.shared.generated.resources.drawer_medicals
import ssbmax.shared.generated.resources.drawer_oir_test
import ssbmax.shared.generated.resources.drawer_phase1_title
import ssbmax.shared.generated.resources.drawer_phase2_title
import ssbmax.shared.generated.resources.drawer_piq_form
import ssbmax.shared.generated.resources.drawer_ppdt
import ssbmax.shared.generated.resources.drawer_psychology_tests
import ssbmax.shared.generated.resources.drawer_quick_access
import ssbmax.shared.generated.resources.drawer_settings
import ssbmax.shared.generated.resources.drawer_sign_out
import ssbmax.shared.generated.resources.drawer_ssb_overview
import ssbmax.shared.generated.resources.drawer_ssb_tests
import ssbmax.shared.generated.resources.drawer_my_batches
import ssbmax.shared.generated.resources.nav_home
import ssbmax.shared.generated.resources.version_footer

/**
 * KMP port of the Android `app/.../ui/components/drawer/DrawerContent.kt` --
 * the drawer's scrollable navigation list (Home / Phase 1 & 2 expandable
 * sub-menus / Medicals / Quick Access / Account). All strings externalized
 * to `composeResources` (the Android original hardcoded them via
 * `stringResource(R.string.*)` against `app`'s own resource set -- reused
 * verbatim wording here, moved to `shared`'s resource set instead of a new
 * `LocalContext.getString` shim, which isn't multiplatform-safe anyway).
 *
 * Sub-menu items (OIR/PPDT/PIQ/Psychology/GTO/Interview/Conference/Medicals)
 * navigate via `onNavigateToTopic(topicId)`, matching
 * [com.ssbmax.shared.presentation.topic.TopicViewModel.getTestsForTopic]'s
 * supported id set exactly (`"medicals"`/`"conference"` intentionally
 * resolve to an empty test list there too -- informational topics, not a
 * gap introduced by this port).
 */
@Composable
fun DrawerContent(
    currentRoute: String,
    phase1Expanded: Boolean,
    phase2Expanded: Boolean,
    onNavigateToHome: () -> Unit,
    onNavigateToTopic: (topicId: String) -> Unit,
    onNavigateToSSBOverview: () -> Unit,
    onNavigateToMyBatches: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onTogglePhase1: () -> Unit,
    onTogglePhase2: () -> Unit,
    onSignOut: () -> Unit,
    onDeleteAccount: () -> Unit,
    isDeletionPending: Boolean = false,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        DrawerMenuItem(
            icon = Icons.Default.Home,
            title = stringResource(Res.string.nav_home),
            onClick = onNavigateToHome,
            isSelected = currentRoute.contains("home"),
            isHomeButton = true
        )

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        DrawerSectionHeader(stringResource(Res.string.drawer_ssb_tests))

        DrawerExpandableSection(
            icon = Icons.Default.CheckCircle,
            title = stringResource(Res.string.drawer_phase1_title),
            expanded = phase1Expanded,
            onToggle = onTogglePhase1
        ) {
            DrawerSubMenuItem(
                title = stringResource(Res.string.drawer_oir_test),
                icon = "🎯",
                onClick = { onNavigateToTopic("oir") }
            )
            DrawerSubMenuItem(
                title = stringResource(Res.string.drawer_ppdt),
                icon = "🖼️",
                onClick = { onNavigateToTopic("ppdt") }
            )
        }

        DrawerExpandableSection(
            icon = Icons.Default.Psychology,
            title = stringResource(Res.string.drawer_phase2_title),
            expanded = phase2Expanded,
            onToggle = onTogglePhase2
        ) {
            DrawerSubMenuItem(
                title = stringResource(Res.string.drawer_piq_form),
                icon = "📝",
                onClick = { onNavigateToTopic("piq_form") }
            )
            DrawerSubMenuItem(
                title = stringResource(Res.string.drawer_psychology_tests),
                icon = "🧪",
                onClick = { onNavigateToTopic("psychology") }
            )
            DrawerSubMenuItem(
                title = stringResource(Res.string.drawer_gto_tests),
                icon = "👥",
                onClick = { onNavigateToTopic("gto") }
            )
            DrawerSubMenuItem(
                title = stringResource(Res.string.drawer_interview),
                icon = "🎤",
                onClick = { onNavigateToTopic("interview") }
            )
            DrawerSubMenuItem(
                title = stringResource(Res.string.drawer_conference),
                icon = "🤝",
                onClick = { onNavigateToTopic("conference") }
            )
        }

        DrawerMenuItem(
            icon = Icons.Default.MedicalServices,
            title = stringResource(Res.string.drawer_medicals),
            onClick = { onNavigateToTopic("medicals") }
        )

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        DrawerSectionHeader(stringResource(Res.string.drawer_quick_access))

        DrawerMenuItem(
            icon = Icons.Default.Info,
            title = stringResource(Res.string.drawer_ssb_overview),
            onClick = onNavigateToSSBOverview
        )

        DrawerMenuItem(
            icon = Icons.Default.Group,
            title = stringResource(Res.string.drawer_my_batches),
            onClick = onNavigateToMyBatches
        )

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        DrawerSectionHeader(stringResource(Res.string.drawer_account))

        DrawerMenuItem(
            icon = Icons.Default.Settings,
            title = stringResource(Res.string.drawer_settings),
            onClick = onNavigateToSettings,
            isSelected = currentRoute.contains("settings")
        )

        DrawerMenuItem(
            icon = Icons.AutoMirrored.Filled.Logout,
            title = stringResource(Res.string.drawer_sign_out),
            onClick = onSignOut
        )

        DrawerMenuItem(
            icon = Icons.Default.DeleteForever,
            title = stringResource(
                if (isDeletionPending) Res.string.drawer_cancel_deletion else Res.string.drawer_delete_account
            ),
            onClick = onDeleteAccount
        )

        Spacer(modifier = Modifier.size(1.dp))
        Text(
            text = stringResource(Res.string.version_footer),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            textAlign = TextAlign.Center
        )
    }
}
