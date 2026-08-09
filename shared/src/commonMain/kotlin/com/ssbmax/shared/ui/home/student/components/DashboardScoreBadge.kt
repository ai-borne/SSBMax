package com.ssbmax.shared.ui.home.student.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.util.formatOneDecimal

/**
 * Large score badge for overall average display
 * Color-coded: Green (≤5), Amber (6-7), Red (≥8)
 *
 * @param score Overall OLQ score (1-10 scale, lower is better)
 */
@Composable
fun ScoreBadge(score: Float) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = when {
            score <= 5f -> MaterialTheme.colorScheme.tertiary
            score <= 7f -> MaterialTheme.colorScheme.secondary
            else -> MaterialTheme.colorScheme.error
        }
    ) {
        Text(
            text = formatOneDecimal(score),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = when {
                score <= 5f -> MaterialTheme.colorScheme.onTertiary
                score <= 7f -> MaterialTheme.colorScheme.onSecondary
                else -> MaterialTheme.colorScheme.onError
            },
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)
        )
    }
}
