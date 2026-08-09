package com.ssbmax.shared.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.backhandler.BackHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.EntryType
import com.ssbmax.shared.domain.model.Gender
import com.ssbmax.shared.presentation.profile.UserProfileUiState
import com.ssbmax.shared.presentation.profile.UserProfileViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.user_profile_age_label
import ssbmax.shared.generated.resources.user_profile_age_placeholder
import ssbmax.shared.generated.resources.user_profile_cd_back
import ssbmax.shared.generated.resources.user_profile_entry_type_label
import ssbmax.shared.generated.resources.user_profile_full_name_label
import ssbmax.shared.generated.resources.user_profile_full_name_placeholder
import ssbmax.shared.generated.resources.user_profile_gender_label
import ssbmax.shared.generated.resources.user_profile_save_button
import ssbmax.shared.generated.resources.user_profile_title
import ssbmax.shared.generated.resources.user_profile_title_onboarding

/**
 * KMP port of the Android `app/.../ui/profile/UserProfileScreen.kt` — the
 * profile create/edit form (used both standalone and during onboarding).
 *
 * Phase 3c (#12): the Android original's `androidx.activity.compose.BackHandler`
 * "block back press while onboarding and profile incomplete" guard is restored
 * here using Compose Multiplatform's own commonMain
 * `androidx.compose.ui.backhandler.BackHandler` (ships since 1.7.0; androidMain
 * delegates to the platform back dispatcher, iosMain to the predictive-back
 * gesture) — no custom expect/actual shim needed.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Suppress("DEPRECATION") // commonMain back-handler bridge; NavigationEventHandler has no Compose adapter yet.
@Composable
fun UserProfileScreen(
    onNavigateBack: () -> Unit,
    onProfileSaved: () -> Unit,
    isOnboarding: Boolean = false,
    viewModel: UserProfileViewModel = koinViewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    BackHandler(enabled = isOnboarding && uiState.profile == null) {
        // Do nothing -- prevent back press during onboarding until profile is complete.
    }

    LaunchedEffect(uiState.isSaved) {
        if (uiState.isSaved) {
            viewModel.resetSavedState()
            onProfileSaved()
        }
    }

    LaunchedEffect(uiState.profile) {
        uiState.profile?.let { profile ->
            viewModel.updateFullName(profile.fullName)
            viewModel.updateAge(profile.age.toString())
            viewModel.updateGender(profile.gender)
            viewModel.updateEntryType(profile.entryType)
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (isOnboarding) {
                            stringResource(Res.string.user_profile_title_onboarding)
                        } else {
                            stringResource(Res.string.user_profile_title)
                        }
                    )
                },
                navigationIcon = {
                    if (!isOnboarding || uiState.profile != null) {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(Res.string.user_profile_cd_back))
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                UserProfileForm(
                    uiState = uiState,
                    onFullNameChange = viewModel::updateFullName,
                    onAgeChange = viewModel::updateAge,
                    onGenderChange = viewModel::updateGender,
                    onEntryTypeChange = viewModel::updateEntryType,
                    onSave = viewModel::saveProfile
                )
            }
        }
    }
}

@Composable
private fun UserProfileForm(
    uiState: UserProfileUiState,
    onFullNameChange: (String) -> Unit,
    onAgeChange: (String) -> Unit,
    onGenderChange: (Gender) -> Unit,
    onEntryTypeChange: (EntryType) -> Unit,
    onSave: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        ProfilePicturePlaceholder(
            initials = if (uiState.fullName.isNotBlank()) {
                uiState.fullName.split(" ")
                    .take(2)
                    .mapNotNull { it.firstOrNull() }
                    .joinToString("")
                    .uppercase()
            } else {
                stringResource(Res.string.user_profile_title).take(1)
            }
        )

        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = uiState.fullName,
            onValueChange = onFullNameChange,
            label = { Text(stringResource(Res.string.user_profile_full_name_label)) },
            placeholder = { Text(stringResource(Res.string.user_profile_full_name_placeholder)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = uiState.age?.toString() ?: "",
            onValueChange = onAgeChange,
            label = { Text(stringResource(Res.string.user_profile_age_label)) },
            placeholder = { Text(stringResource(Res.string.user_profile_age_placeholder)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = stringResource(Res.string.user_profile_gender_label),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        GenderSelector(
            selectedGender = uiState.gender,
            onGenderSelected = onGenderChange
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = stringResource(Res.string.user_profile_entry_type_label),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))
        EntryTypeSelector(
            selectedEntryType = uiState.entryType,
            onEntryTypeSelected = onEntryTypeChange
        )

        Spacer(modifier = Modifier.height(32.dp))

        if (uiState.error != null) {
            Text(
                text = uiState.error,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
            onClick = onSave,
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isLoading
        ) {
            Text(stringResource(Res.string.user_profile_save_button))
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

// ProfilePicturePlaceholder/GenderSelector/EntryTypeSelector moved to
// UserProfileFormComponents.kt to keep this file under this repo's
// 300-line Quality Limit.
