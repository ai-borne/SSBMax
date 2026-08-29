package com.ssbmax.shared.ui.common

import androidx.compose.ui.text.font.FontWeight
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Phase 0 of the readable-study-content plan: [MarkdownText] had zero coverage
 * despite being the most-shared long-form-content renderer on both platforms.
 * [parseInlineBold] is the one piece of its logic that is a pure function
 * (`internal`, not `@Composable`), so it is covered here in `commonTest` to
 * run on every KMP target including iOS. The block-dispatch logic (headings,
 * bullet/numbered lists) and the documented rendering gaps (`####`+, tables,
 * links, blockquotes, code) require actually rendering a `@Composable`, which
 * needs `runComposeUiTest` -- Android's implementation needs Robolectric's
 * `Build.FINGERPRINT` shadow, and `@RunWith(RobolectricTestRunner::class)` is
 * JUnit4-only with no Kotlin/Native equivalent (same constraint documented on
 * [com.ssbmax.shared.ui.theme.SSBMaxThemeUiTest]), so that coverage lives in
 * `androidUnitTest`'s `MarkdownTextUiTest` instead of here.
 */
class MarkdownTextTest {

    @Test
    fun `plain text with no bold markers is returned unstyled`() {
        val result = parseInlineBold("no bold here")

        assertEquals("no bold here", result.text)
        assertTrue(result.spanStyles.isEmpty())
    }

    @Test
    fun `single bold segment is styled bold and surrounding text is not`() {
        val result = parseInlineBold("before **bold** after")

        assertEquals("before bold after", result.text)
        assertEquals(1, result.spanStyles.size)
        val span = result.spanStyles.single()
        assertEquals(FontWeight.Bold, span.item.fontWeight)
        assertEquals("bold", result.text.substring(span.start, span.end))
    }

    @Test
    fun `multiple bold segments are each styled independently`() {
        val result = parseInlineBold("**one** middle **two**")

        assertEquals("one middle two", result.text)
        assertEquals(2, result.spanStyles.size)
        val (first, second) = result.spanStyles.sortedBy { it.start }
        assertEquals("one", result.text.substring(first.start, first.end))
        assertEquals("two", result.text.substring(second.start, second.end))
    }

    @Test
    fun `text entirely wrapped in bold markers is one bold span`() {
        val result = parseInlineBold("**everything**")

        assertEquals("everything", result.text)
        assertEquals(1, result.spanStyles.size)
        assertEquals(0, result.spanStyles.single().start)
        assertEquals("everything".length, result.spanStyles.single().end)
    }

    @Test
    fun `an unmatched trailing bold marker does not crash and drops no text`() {
        // Odd number of "**" delimiters: parseInlineBold splits on "**" and
        // alternates plain/bold by index, so an unterminated marker leaves a
        // dangling bold-styled remainder rather than throwing.
        val result = parseInlineBold("plain **dangling bold")

        assertEquals("plain dangling bold", result.text)
        assertEquals(1, result.spanStyles.size)
        assertEquals(FontWeight.Bold, result.spanStyles.single().item.fontWeight)
    }

    @Test
    fun `empty string produces empty annotated string with no spans`() {
        val result = parseInlineBold("")

        assertEquals("", result.text)
        assertTrue(result.spanStyles.isEmpty())
    }

    @Test
    fun `adjacent empty bold markers do not produce zero-length spans`() {
        val result = parseInlineBold("a****b")

        assertEquals("ab", result.text)
        assertTrue(result.spanStyles.isEmpty())
    }
}
