package com.ssbmax.shared.ui.oir

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ssbmax.shared.domain.model.OIRAnsweredQuestion
import com.ssbmax.shared.presentation.oirresult.OirResultViewModel
import org.jetbrains.compose.resources.stringResource
import org.koin.compose.viewmodel.koinViewModel
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.oir_result_load_failed
import ssbmax.shared.generated.resources.oir_result_loading
import ssbmax.shared.generated.resources.oir_review_answer
import ssbmax.shared.generated.resources.oir_review_correct_answer
import ssbmax.shared.generated.resources.oir_review_explanation
import ssbmax.shared.generated.resources.oir_review_not_answered
import ssbmax.shared.generated.resources.oir_review_selected_answer
import ssbmax.shared.generated.resources.oir_review_cd_back
import ssbmax.shared.generated.resources.oir_review_title

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OIRAnswerReviewScreen(
    submissionId: String,
    onNavigateBack: () -> Unit,
    viewModel: OirResultViewModel = koinViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(submissionId) { viewModel.loadSubmission(submissionId) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(Res.string.oir_review_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(Res.string.oir_review_cd_back))
                    }
                }
            )
        }
    ) { padding ->
        when {
            state.isLoading -> Text(
                text = stringResource(Res.string.oir_result_loading),
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)
            )
            state.error != null -> Text(
                text = state.error ?: stringResource(Res.string.oir_result_load_failed),
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)
            )
            state.result != null -> ReviewList(
                questions = state.result?.answeredQuestions.orEmpty(),
                padding = padding
            )
        }
    }
}

@Composable
private fun ReviewList(questions: List<OIRAnsweredQuestion>, padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(questions, key = { it.question.id }) { question -> ReviewCard(question) }
    }
}

@Composable
private fun ReviewCard(answered: OIRAnsweredQuestion) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(Res.string.oir_review_answer, answered.question.questionNumber),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(answered.question.questionText, style = MaterialTheme.typography.bodyLarge)
            Text(
                text = stringResource(
                    Res.string.oir_review_selected_answer,
                    answered.selectedOption?.text ?: stringResource(Res.string.oir_review_not_answered)
                ),
                color = if (answered.isCorrect) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error
            )
            Text(
                text = stringResource(Res.string.oir_review_correct_answer, answered.correctOption.text),
                color = MaterialTheme.colorScheme.tertiary
            )
            Text(
                text = stringResource(Res.string.oir_review_explanation, answered.question.explanation),
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}
