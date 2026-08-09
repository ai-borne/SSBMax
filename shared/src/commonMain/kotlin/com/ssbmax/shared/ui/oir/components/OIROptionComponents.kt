package com.ssbmax.shared.ui.oir.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.ssbmax.shared.domain.model.OIROption
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.oir_correct
import ssbmax.shared.generated.resources.oir_incorrect
import ssbmax.shared.generated.resources.oir_option_correct
import ssbmax.shared.generated.resources.oir_option_incorrect
import ssbmax.shared.generated.resources.oir_option_selected

/**
 * Option-card + post-answer feedback-card composables for [com.ssbmax.shared.ui.oir.components.OIRQuestionView].
 * Split out of `OIRQuestionCard.kt` for the same 300-line Quality Limit
 * reason (see that file's doc comment).
 */
@Composable
internal fun OIROptionCard(
    option: OIROption,
    isSelected: Boolean,
    isCorrect: Boolean,
    isWrong: Boolean,
    onClick: () -> Unit,
    isMultiSelect: Boolean = false,
    isDimmed: Boolean = false
) {
    val backgroundColor = when {
        isCorrect -> MaterialTheme.colorScheme.tertiaryContainer
        isWrong -> MaterialTheme.colorScheme.errorContainer
        isSelected -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.surface
    }
    val borderColor = when {
        isCorrect -> MaterialTheme.colorScheme.tertiary
        isWrong -> MaterialTheme.colorScheme.error
        isSelected -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.outline
    }

    val semanticState = optionSemanticState(isCorrect, isWrong, isSelected)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (isDimmed) 0.4f else 1f)
            .border(2.dp, borderColor, MaterialTheme.shapes.medium)
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                role = if (isMultiSelect) Role.Checkbox else Role.RadioButton
                selected = isSelected
                if (semanticState != null) stateDescription = semanticState
            },
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            OIROptionContentInRow(option)
            OIROptionIndicator(isCorrect, isWrong, isSelected, isMultiSelect)
        }
    }
}

@Composable
private fun optionSemanticState(isCorrect: Boolean, isWrong: Boolean, isSelected: Boolean): String? = when {
    isCorrect -> stringResource(Res.string.oir_option_correct)
    isWrong -> stringResource(Res.string.oir_option_incorrect)
    isSelected -> stringResource(Res.string.oir_option_selected)
    else -> null
}

@Composable
private fun RowScope.OIROptionContentInRow(option: OIROption) {
    if (option.imageUrl != null) {
        AsyncImage(
            model = option.imageUrl,
            contentDescription = option.text,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 80.dp)
        )
    } else {
        Text(
            text = option.text,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun OIROptionIndicator(
    isCorrect: Boolean,
    isWrong: Boolean,
    isSelected: Boolean,
    isMultiSelect: Boolean
) {
    when {
        isCorrect -> Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.tertiary,
            modifier = Modifier.size(24.dp)
        )
        isWrong -> Icon(
            imageVector = Icons.Default.Cancel,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(24.dp)
        )
        isSelected -> OIRSelectionIndicator(isMultiSelect)
    }
}

@Composable
private fun OIRSelectionIndicator(isMultiSelect: Boolean) {
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(if (isMultiSelect) RoundedCornerShape(4.dp) else CircleShape)
            .background(MaterialTheme.colorScheme.primary),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Check,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onPrimary,
            modifier = Modifier.size(16.dp)
        )
    }
}

/**
 * Post-answer feedback card showing correct/incorrect verdict and explanation.
 */
@Composable
internal fun OIRFeedbackCard(isCorrect: Boolean, explanation: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isCorrect) {
                MaterialTheme.colorScheme.tertiaryContainer
            } else {
                MaterialTheme.colorScheme.errorContainer
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (isCorrect) Icons.Default.CheckCircle else Icons.Default.Cancel,
                    contentDescription = null,
                    tint = if (isCorrect) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error
                )
                Text(
                    text = if (isCorrect) {
                        stringResource(Res.string.oir_correct)
                    } else {
                        stringResource(Res.string.oir_incorrect)
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Text(text = explanation, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
