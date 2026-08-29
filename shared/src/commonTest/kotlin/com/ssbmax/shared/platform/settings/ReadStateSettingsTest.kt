package com.ssbmax.shared.platform.settings

import com.ssbmax.shared.presentation.testing.FakeSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Persistence round-trip for per-section read state (Phase 7, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md) -- the "why" this matters: a fresh
 * [ReadStateSettings] backed by the same underlying [FakeSettings] must see marks made by a
 * previous instance, the same guarantee a real app relies on across process death.
 */
class ReadStateSettingsTest {

    @Test
    fun `a section is unread by default`() {
        val settings = ReadStateSettings(FakeSettings())

        assertFalse(settings.isSectionRead("intro-section"))
        assertEquals(emptySet(), settings.readSectionIdsFlow.value)
    }

    @Test
    fun `setSectionRead true round-trips through get, the flow, and a fresh instance`() {
        val backing = FakeSettings()
        val settings = ReadStateSettings(backing)

        settings.setSectionRead("intro-section", true)

        assertTrue(settings.isSectionRead("intro-section"))
        assertEquals(setOf("intro-section"), settings.readSectionIdsFlow.value)

        val reloaded = ReadStateSettings(backing)
        assertTrue(reloaded.isSectionRead("intro-section"))
        assertEquals(setOf("intro-section"), reloaded.readSectionIdsFlow.value)
    }

    @Test
    fun `setSectionRead false clears a previously read section`() {
        val settings = ReadStateSettings(FakeSettings())
        settings.setSectionRead("intro-section", true)

        settings.setSectionRead("intro-section", false)

        assertFalse(settings.isSectionRead("intro-section"))
        assertEquals(emptySet(), settings.readSectionIdsFlow.value)
    }

    @Test
    fun `toggleSectionRead flips independently per section id`() {
        val settings = ReadStateSettings(FakeSettings())

        settings.toggleSectionRead("section-a")
        settings.toggleSectionRead("section-b")
        settings.toggleSectionRead("section-a")

        assertFalse(settings.isSectionRead("section-a"))
        assertTrue(settings.isSectionRead("section-b"))
        assertEquals(setOf("section-b"), settings.readSectionIdsFlow.value)
    }
}
