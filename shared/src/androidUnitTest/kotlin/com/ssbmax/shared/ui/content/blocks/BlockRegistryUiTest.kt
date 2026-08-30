package com.ssbmax.shared.ui.content.blocks

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.runComposeUiTest
import kotlin.test.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The @Composable-dispatch half of the parity gate (docs/plans/
 * write-the-phased-plan-wobbly-pancake.md): every block type in the frozen taxonomy
 * (content/SCHEMA.md) must render through [DocBlockView] without throwing, via its own
 * registered composable as of Phase 4 (only [UnknownBlock] still uses the D1
 * fallback-to-paragraph path). This is the Kotlin twin of web's `blockRegistry.parity.test.tsx`;
 * both walk the same taxonomy (content/__fixtures__/blocks.json documents one instance of each).
 * Needs `runComposeUiTest` -> Robolectric, hence `androidUnitTest` not `commonTest` -- see
 * [com.ssbmax.shared.ui.common.MarkdownTextUiTest].
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
class BlockRegistryUiTest {

    @Test
    fun `paragraph block renders its text`() = runComposeUiTest {
        setContent { DocBlockView(ParagraphBlock("hello paragraph")) }
        onNodeWithText("hello paragraph").assertExists()
    }

    @Test
    fun `list block renders each item`() = runComposeUiTest {
        setContent { DocBlockView(ListBlock(listOf("first", "second"))) }
        onNodeWithText("first").assertExists()
        onNodeWithText("second").assertExists()
    }

    @Test
    fun `subheading block renders its text`() = runComposeUiTest {
        setContent { DocBlockView(SubheadingBlock(level = 3, text = "A Subheading")) }
        onNodeWithText("A Subheading").assertExists()
    }

    @Test
    fun `specTable block renders label and value via its dedicated renderer`() = runComposeUiTest {
        setContent { DocBlockView(SpecTableBlock(listOf(LabelValue("Duration", "20-30 minutes")))) }
        onNodeWithText("Duration").assertExists()
        onNodeWithText("20-30 minutes").assertExists()
    }

    @Test
    fun `callout block renders marker and text via its dedicated renderer`() = runComposeUiTest {
        setContent { DocBlockView(CalloutBlock("Remember", "team player")) }
        onNodeWithText("REMEMBER").assertExists()
        onNodeWithText("team player").assertExists()
    }

    @Test
    fun `comparison block renders label and text via its dedicated renderer`() = runComposeUiTest {
        setContent { DocBlockView(ComparisonBlock(listOf(LabelValue("Wrong", "bad answer")))) }
        onNodeWithText("bad answer").assertExists()
    }

    @Test
    fun `timeline block renders label and text via its dedicated renderer`() = runComposeUiTest {
        setContent { DocBlockView(TimelineBlock(listOf(LabelValue("9:00 AM", "Reporting")))) }
        onNodeWithText("9:00 AM").assertExists()
        onNodeWithText("Reporting").assertExists()
    }

    @Test
    fun `table block renders each cell via its dedicated renderer`() = runComposeUiTest {
        setContent { DocBlockView(TableBlock(listOf(listOf("Week", "Focus")))) }
        onNodeWithText("Week").assertExists()
        onNodeWithText("Focus").assertExists()
    }

    @Test
    fun `an unrecognised block type never crashes the composable (D1)`() = runComposeUiTest {
        setContent { DocBlockView(UnknownBlock(type = "unknownFutureBlockType", fallbackText = "still readable")) }
        onNodeWithText("still readable").assertExists()
    }
}
