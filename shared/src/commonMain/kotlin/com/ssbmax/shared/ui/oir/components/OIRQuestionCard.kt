package com.ssbmax.shared.ui.oir.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.ssbmax.shared.domain.model.OIRQuestion
import com.ssbmax.shared.ui.common.AnswerFeedbackEffect
import com.ssbmax.shared.ui.common.ensureCoilNetworkFetcherRegistered
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.oir_multi_select_hint
import ssbmax.shared.generated.resources.oir_multi_select_selections_complete
import ssbmax.shared.generated.resources.oir_question_figure_description
import ssbmax.shared.generated.resources.oir_question_figure_error
import ssbmax.shared.generated.resources.oir_question_figure_loading

/**
 * KMP port of `app/.../ui/tests/oir/components/OIRQuestionCard.kt`.
 *
 * Two real changes from the Android original:
 * - `coil.compose.AsyncImage` (Coil 2, Android-only) -> `coil3.compose.AsyncImage`
 *   (Coil3, Compose Multiplatform). The manual `ImageRequest.Builder(LocalContext.current)`
 *   + `CachePolicy.ENABLED` wrapping is dropped: Coil3's `AsyncImage(model = url, ...)`
 *   takes the URL directly and uses its own (already memory+disk caching)
 *   `SingletonImageLoader` — see [ensureCoilNetworkFetcherRegistered].
 * - `R.string.oir_*` (Android resource IDs) -> `stringResource(Res.string.oir_*)`
 *   (composeResources), same string values.
 *
 * Split from a single 344-line file into this file (question/figure/hint
 * cards) plus `OIROptionComponents.kt` (option card + feedback card) to stay
 * under this repo's 300-line-per-file Quality Limit.
 */
@Composable
internal fun OIRQuestionView(
    question: OIRQuestion,
    selectedOptionIds: Set<String>,
    onOptionSelected: (String) -> Unit,
    showFeedback: Boolean,
    isCorrect: Boolean,
    modifier: Modifier = Modifier
) {
    ensureCoilNetworkFetcherRegistered()
    val hapticFeedback = LocalHapticFeedback.current

    AnswerFeedbackEffect(
        showFeedback = showFeedback,
        isCorrect = isCorrect,
        hapticFeedback = hapticFeedback
    )

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item(key = "type-badge") {
            OIRTypeBadge(question.type.displayName)
        }

        item(key = "question-text") {
            OIRQuestionTextCard(question.questionText)
        }

        question.questionImageUrl?.let { imageUrl ->
            item(key = "figure") {
                OIRQuestionFigureCard(imageUrl)
            }
        }

        if (question.isMultiSelect) {
            item(key = "multi-select-hint") {
                OIRMultiSelectHint(selectedOptionIds.size)
            }
        }

        items(question.options, key = { it.id }) { option ->
            val isDimmed = question.isMultiSelect && !showFeedback &&
                selectedOptionIds.size >= 2 && option.id !in selectedOptionIds
            OIROptionCard(
                option = option,
                isSelected = option.id in selectedOptionIds,
                isCorrect = showFeedback && (if (question.isMultiSelect) {
                    option.id in question.correctAnswerIds
                } else {
                    option.id == question.correctAnswerId
                }),
                isWrong = showFeedback && option.id in selectedOptionIds &&
                    (if (question.isMultiSelect) {
                        option.id !in question.correctAnswerIds
                    } else {
                        option.id != question.correctAnswerId
                    }),
                isMultiSelect = question.isMultiSelect,
                isDimmed = isDimmed,
                onClick = { if (!showFeedback) onOptionSelected(option.id) }
            )
        }

        if (showFeedback) {
            item(key = "feedback") {
                OIRFeedbackCard(isCorrect = isCorrect, explanation = question.explanation)
            }
        }
    }
}

@Composable
private fun OIRTypeBadge(displayName: String) {
    AssistChip(
        onClick = { },
        label = {
            Text(displayName, style = MaterialTheme.typography.labelMedium)
        },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    )
}

@Composable
private fun OIRQuestionTextCard(questionText: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Text(
            text = questionText,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.padding(20.dp)
        )
    }
}

@Composable
private fun OIRQuestionFigureCard(imageUrl: String) {
    var isLoading by remember(imageUrl) { mutableStateOf(true) }
    var hasError by remember(imageUrl) { mutableStateOf(false) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 200.dp),
            contentAlignment = Alignment.Center
        ) {
            AsyncImage(
                model = imageUrl,
                contentDescription = stringResource(Res.string.oir_question_figure_description),
                contentScale = ContentScale.Fit,
                onLoading = { isLoading = true; hasError = false },
                onSuccess = { isLoading = false; hasError = false },
                onError = { isLoading = false; hasError = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
            )
            when {
                isLoading -> Text(stringResource(Res.string.oir_question_figure_loading))
                hasError -> Text(stringResource(Res.string.oir_question_figure_error))
            }
        }
    }
}

@Composable
private fun OIRMultiSelectHint(selectionCount: Int) {
    val hintRes = if (selectionCount >= 2) {
        Res.string.oir_multi_select_selections_complete
    } else {
        Res.string.oir_multi_select_hint
    }
    SuggestionChip(
        onClick = { },
        label = { Text(stringResource(hintRes), style = MaterialTheme.typography.labelMedium) }
    )
}
