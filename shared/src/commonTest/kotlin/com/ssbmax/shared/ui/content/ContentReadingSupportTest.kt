package com.ssbmax.shared.ui.content

import com.ssbmax.shared.domain.model.TestType
import com.ssbmax.shared.ui.content.blocks.DocSection
import com.ssbmax.shared.ui.content.blocks.ParagraphBlock
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Phase 7 (docs/plans/write-the-phased-plan-wobbly-pancake.md) reading-affordance helpers.
 * The exhaustive [TestType] loop below is the actual gate the plan's Phase 7 test bullet asks
 * for: "CTA target resolution asserted against the SSBPhase/TestType enum so a renamed test
 * type fails the build rather than producing a dead link." A `when` without an `else` branch in
 * [destinationForTestType] fails to *compile* on a renamed/removed member; this test additionally
 * proves every currently-reachable [TestType] (the ones [testTypeForTopicType] can actually
 * return) resolves to a real destination, not the [com.ssbmax.navigation.SSBMaxDestinations]
 * `NotYetPorted` placeholder.
 */
class ContentReadingSupportTest {

    @Test
    fun `testTypeForTopicType resolves the unambiguous single-test topics`() {
        assertEquals(TestType.OIR, testTypeForTopicType("OIR"))
        assertEquals(TestType.OIR, testTypeForTopicType("oir"))
        assertEquals(TestType.PPDT, testTypeForTopicType("PPDT"))
        assertEquals(TestType.PIQ, testTypeForTopicType("PIQ_FORM"))
        assertEquals(TestType.IO, testTypeForTopicType("INTERVIEW"))
    }

    @Test
    fun `testTypeForTopicType returns null for ambiguous or unmapped topics`() {
        assertNull(testTypeForTopicType("GTO"))
        assertNull(testTypeForTopicType("PSYCHOLOGY"))
        assertNull(testTypeForTopicType("CONFERENCE"))
        assertNull(testTypeForTopicType("SSB_OVERVIEW"))
        assertNull(testTypeForTopicType("MEDICALS"))
    }

    @Test
    fun `every TestType testTypeForTopicType can resolve maps to a real navigation destination`() {
        val reachable = TestType.entries.filter { testType ->
            testTypeForTopicType(reverseTopicTypeFor(testType)) == testType
        }

        // Guards against the mapping table silently going stale on either side: today only
        // OIR/PPDT/PIQ/IO are single-test topics (see testTypeForTopicType's doc comment).
        assertEquals(setOf(TestType.OIR, TestType.PPDT, TestType.PIQ, TestType.IO), reachable.toSet())

        reachable.forEach { testType ->
            val destination = com.ssbmax.navigation.destinationForTestType(testType)
            val isPlaceholder = destination is com.ssbmax.navigation.SSBMaxDestinations.NotYetPorted
            assertEquals(false, isPlaceholder, "TestType.$testType must not resolve to NotYetPorted")
        }
    }

    private fun reverseTopicTypeFor(testType: TestType): String = when (testType) {
        TestType.OIR -> "OIR"
        TestType.PPDT -> "PPDT"
        TestType.PIQ -> "PIQ_FORM"
        TestType.IO -> "INTERVIEW"
        else -> "UNMAPPED"
    }

    @Test
    fun `estimatedReadingMinutes rounds word count to the nearest minute with a one-minute floor`() {
        val shortSection = DocSection(
            id = "s1",
            slug = "s1",
            heading = "Short",
            level = 2,
            blocks = listOf(ParagraphBlock("just a few words here"))
        )
        assertEquals(1, estimatedReadingMinutes(shortSection))

        val longParagraph = List(600) { "word" }.joinToString(" ")
        val longSection = DocSection(
            id = "s2",
            slug = "s2",
            heading = "Long",
            level = 2,
            blocks = listOf(ParagraphBlock(longParagraph))
        )
        assertEquals(3, estimatedReadingMinutes(longSection))
    }
}
