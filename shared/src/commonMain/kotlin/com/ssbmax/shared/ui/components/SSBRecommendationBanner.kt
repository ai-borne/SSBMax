package com.ssbmax.shared.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.ReportProblem
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.domain.validation.RecommendationOutcome
import com.ssbmax.shared.domain.validation.SSBRecommendationUIModel
import com.ssbmax.shared.ui.theme.semanticColors
import org.jetbrains.compose.resources.stringResource
import ssbmax.shared.generated.resources.Res
import ssbmax.shared.generated.resources.ssb_banner_collapse_cd
import ssbmax.shared.generated.resources.ssb_banner_critical_label
import ssbmax.shared.generated.resources.ssb_banner_critical_weaknesses_label
import ssbmax.shared.generated.resources.ssb_banner_expand_cd
import ssbmax.shared.generated.resources.ssb_banner_factor_consistency_label
import ssbmax.shared.generated.resources.ssb_banner_factor_consistency_value
import ssbmax.shared.generated.resources.ssb_banner_factor_ii_label
import ssbmax.shared.generated.resources.ssb_banner_limitations_label
import ssbmax.shared.generated.resources.ssb_banner_scale_note

/**
 * KMP port of `app/.../ui/components/SSBRecommendationBanner.kt`, unchanged
 * layout/behavior. The Android original hardcoded its strings (a
 * pre-existing lint-rule violation, same class already ported-around
 * elsewhere this phase) -- ported here as real composeResources entries.
 */
@Composable
fun SSBRecommendationBanner(
    model: SSBRecommendationUIModel,
    modifier: Modifier = Modifier,
    showExpandedDetails: Boolean = false
) {
    var isExpanded by remember { mutableStateOf(showExpandedDetails) }

    val style = when (model.recommendation) {
        RecommendationOutcome.RECOMMENDED -> BannerStyle(
            background = MaterialTheme.semanticColors.success,
            content = MaterialTheme.semanticColors.onSuccess,
            icon = Icons.Default.CheckCircle
        )
        RecommendationOutcome.BORDERLINE -> BannerStyle(
            background = MaterialTheme.semanticColors.warning,
            content = MaterialTheme.semanticColors.onWarning,
            icon = Icons.Default.Warning
        )
        RecommendationOutcome.NOT_RECOMMENDED -> BannerStyle(
            background = MaterialTheme.semanticColors.error,
            content = MaterialTheme.semanticColors.onError,
            icon = Icons.Default.Cancel
        )
    }
    val gradientColors = listOf(style.background, style.background.copy(alpha = 0.85f))

    BannerCard(model, style, isExpanded, gradientColors, modifier) { isExpanded = !isExpanded }
}

@Composable
private fun BannerCard(
    model: SSBRecommendationUIModel,
    style: BannerStyle,
    isExpanded: Boolean,
    gradientColors: List<Color>,
    modifier: Modifier,
    onClick: () -> Unit
) {
    val expansionDescription = stringResource(
        if (isExpanded) Res.string.ssb_banner_collapse_cd else Res.string.ssb_banner_expand_cd
    )
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { stateDescription = expansionDescription },
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        colors = CardDefaults.cardColors(containerColor = style.background)
    ) {
        Box(modifier = Modifier.fillMaxWidth().background(Brush.verticalGradient(gradientColors))) {
            Column(modifier = Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Icon(style.icon, contentDescription = null, tint = style.content, modifier = Modifier.size(36.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            model.recommendationText,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = style.content
                        )
                        Text(
                            model.subtitleText,
                            style = MaterialTheme.typography.bodyMedium,
                            color = style.content.copy(alpha = 0.9f),
                            textAlign = TextAlign.Center
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    QuickStatChip(
                        stringResource(Res.string.ssb_banner_limitations_label),
                        "${model.limitationCount}/${model.maxLimitations}",
                        style.content
                    )
                    QuickStatChip(
                        stringResource(Res.string.ssb_banner_critical_label),
                        if (model.hasCriticalWeakness) "⚠" else "✓",
                        style.content
                    )
                    QuickStatChip(
                        stringResource(Res.string.ssb_banner_factor_ii_label),
                        if (model.factorIIAutoReject) "⚠" else "✓",
                        style.content
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Icon(
                    if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = style.content.copy(alpha = 0.7f), modifier = Modifier.size(20.dp)
                )
                BannerDetails(model, style, isExpanded)
            }
        }
    }
}

@Composable
private fun BannerDetails(model: SSBRecommendationUIModel, style: BannerStyle, isExpanded: Boolean) {
    AnimatedVisibility(visible = isExpanded, enter = expandVertically(), exit = shrinkVertically()) {
        Column(modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
            HorizontalDivider(color = style.content.copy(alpha = 0.3f), modifier = Modifier.padding(vertical = 8.dp))
            if (model.hasCriticalWeakness && model.criticalWeaknessNames.isNotEmpty()) {
                DetailRow(
                    Icons.Default.ReportProblem,
                    stringResource(Res.string.ssb_banner_critical_weaknesses_label),
                    model.criticalWeaknessNames.joinToString(", "),
                    style.content
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
            if (model.hasFactorInconsistency) {
                DetailRow(
                    Icons.Default.Warning,
                    stringResource(Res.string.ssb_banner_factor_consistency_label),
                    stringResource(Res.string.ssb_banner_factor_consistency_value),
                    style.content
                )
                Spacer(modifier = Modifier.height(8.dp))
            }
            Text(
                stringResource(Res.string.ssb_banner_scale_note),
                style = MaterialTheme.typography.bodySmall,
                color = style.content.copy(alpha = 0.8f),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun QuickStatChip(label: String, value: String, iconTint: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = iconTint)
        Text(text = label, style = MaterialTheme.typography.labelSmall, color = iconTint.copy(alpha = 0.8f))
    }
}

@Composable
private fun DetailRow(icon: ImageVector, label: String, value: String, contentColor: Color) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Icon(imageVector = icon, contentDescription = null, tint = contentColor.copy(alpha = 0.8f), modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(text = "$label $value", style = MaterialTheme.typography.bodySmall, color = contentColor.copy(alpha = 0.9f))
    }
}

private data class BannerStyle(
    val background: Color,
    val content: Color,
    val icon: ImageVector
)
