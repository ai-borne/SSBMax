package com.ssbmax.shared.ui.common

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.runComposeUiTest
import kotlin.test.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Phase 0 of the readable-study-content plan: covers [MarkdownText]'s block
 * dispatch (headings, bullet lists, numbered lists, paragraphs) and the
 * rendering gaps the plan's "structured document model" is meant to remove
 * (`####`+, tables, links, blockquotes, code all render as literal text
 * today). Pure-function coverage of [parseInlineBold] lives in `commonTest`'s
 * `MarkdownTextTest` instead; this class needs `runComposeUiTest`, which on
 * Android needs Robolectric's `Build.FINGERPRINT` shadow -- see
 * [com.ssbmax.shared.ui.theme.SSBMaxThemeUiTest] for why that keeps this out
 * of a source set iOS also compiles.
 */
@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
class MarkdownTextUiTest {

    @Test
    fun `h1 h2 h3 headings all render their text`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "# Heading One\n\n## Heading Two\n\n### Heading Three")
        }

        onNodeWithText("Heading One").assertExists()
        onNodeWithText("Heading Two").assertExists()
        onNodeWithText("Heading Three").assertExists()
    }

    @Test
    fun `dash asterisk bullet and check-mark markers all render as bullet items`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "- dash item\n* asterisk item\n• bullet item\n✓ check item")
        }

        onNodeWithText("dash item").assertExists()
        onNodeWithText("asterisk item").assertExists()
        onNodeWithText("bullet item").assertExists()
        onNodeWithText("check item").assertExists()
    }

    @Test
    fun `numbered list items render without their original digit prefix`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "1. first step\n2. second step")
        }

        onNodeWithText("first step").assertExists()
        onNodeWithText("second step").assertExists()
    }

    @Test
    fun `plain prose renders as a paragraph with inline bold parsed`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "plain prose with **emphasis** inside")
        }

        onNodeWithText("plain prose with emphasis inside").assertExists()
    }

    @Test
    fun `gap - four-hash heading renders as literal text, not a heading`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "#### Not A Real Heading")
        }

        // Documented gap: only #, ##, ### are recognized. A #### line falls
        // through to the paragraph branch with the hashes still in the text.
        onNodeWithText("#### Not A Real Heading").assertExists()
    }

    @Test
    fun `gap - pipe table syntax renders as literal text, not a table`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "| Col A | Col B |")
        }

        onNodeWithText("| Col A | Col B |").assertExists()
    }

    @Test
    fun `gap - markdown link syntax renders as literal text, not a link`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "see [the docs](https://example.com) for more")
        }

        onNodeWithText("see [the docs](https://example.com) for more").assertExists()
    }

    @Test
    fun `gap - blockquote marker renders as literal text, not a blockquote`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "> quoted line")
        }

        onNodeWithText("> quoted line").assertExists()
    }

    @Test
    fun `gap - fenced code block markers render as literal text, not code`() = runComposeUiTest {
        setContent {
            MarkdownText(content = "```\nval x = 1\n```")
        }

        // Both fence lines render as literal, separate paragraph text (no
        // code-block merging or styling), so the marker appears twice.
        onAllNodesWithText("```").assertCountEquals(2)
        onNodeWithText("val x = 1").assertExists()
    }
}
