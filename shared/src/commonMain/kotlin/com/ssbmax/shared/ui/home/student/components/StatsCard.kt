package com.ssbmax.shared.ui.home.student.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import com.ssbmax.shared.ui.theme.Spacing

/**
 * Stats Card - Gradient background with icon and horizontal layout
 * Displays a single stat with icon, value, and subtitle
 */
@Composable
fun StatsCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    gradient: Brush,
    modifier: Modifier = Modifier,
    contentColor: Color = MaterialTheme.colorScheme.onPrimaryContainer,
    iconContentDescription: String? = null
) {
    Card(
        modifier = modifier.height(Spacing.statsCardHeight),
        shape = RoundedCornerShape(Spacing.cardCornerRadiusLarge)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(gradient)
                .padding(Spacing.medium)
        ) {
            Column(
                verticalArrangement = Arrangement.Center
            ) {
                // Top row: Icon + Value + Unit
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.small)
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = iconContentDescription,
                        tint = contentColor,
                        modifier = Modifier.size(Spacing.iconSizeLarge)
                    )

                    Text(
                        value,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = contentColor
                    )

                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodyLarge,
                        color = contentColor.copy(alpha = 0.9f)
                    )
                }

                Spacer(modifier = Modifier.height(Spacing.extraSmall))

                // Bottom: Title
                Text(
                    title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = contentColor.copy(alpha = 0.85f)
                )
            }
        }
    }
}
