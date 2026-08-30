package com.ssbmax.shared.ui.content.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.ssbmax.shared.ui.common.parseInlineBold

/** `Warning` gets the tertiary (amber-like) container tint; every other marker
 * (Remember/Key Insight/Tip/Note) shares the secondary container tint -- mirrors
 * CalloutBlock.tsx's amber-vs-sky split with Material's own tonal roles. */
@Composable
fun CalloutBlockView(block: CalloutBlock, modifier: Modifier = Modifier) {
    val isWarning = block.marker.equals("Warning", ignoreCase = true)
    val containerColor = if (isWarning) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.secondaryContainer
    val contentColor = if (isWarning) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSecondaryContainer

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(containerColor, RoundedCornerShape(8.dp))
            .padding(12.dp)
    ) {
        Text(block.marker.uppercase(), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = contentColor)
        Text(parseInlineBold(block.text), style = MaterialTheme.typography.bodyMedium, color = contentColor)
    }
}

@Suppress("UnusedPrivateMember")
@Preview
@Composable
private fun CalloutBlockViewPreview() {
    CalloutBlockView(CalloutBlock("Remember", "GTO wants to see a team player, not a solo hero."))
}
