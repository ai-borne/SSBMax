package com.ssbmax.shared.platform.settings

import com.russhwolf.settings.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Per-section "read" tracking for structured study content (Phase 7, docs/plans/
 * write-the-phased-plan-wobbly-pancake.md). One boolean key per section id, same
 * `Settings`-backed shape as [DeveloperSettings] -- there is no `androidx.datastore` usage
 * anywhere in this codebase (`gradle/libs.versions.toml`'s `datastore-preferences` entry is an
 * unused declaration), so this follows the established multiplatform-settings pattern instead
 * of introducing a second local-KV mechanism for one feature.
 *
 * Web's twin is `useSectionReadState.ts` (localStorage, same per-section-id key shape).
 */
class ReadStateSettings(private val settings: Settings) {

    private val _readSectionIdsFlow = MutableStateFlow(loadReadSectionIds())
    val readSectionIdsFlow: StateFlow<Set<String>> = _readSectionIdsFlow.asStateFlow()

    fun isSectionRead(sectionId: String): Boolean = settings.getBoolean(key(sectionId), false)

    fun setSectionRead(sectionId: String, read: Boolean) {
        if (read) {
            settings.putBoolean(key(sectionId), true)
        } else {
            settings.remove(key(sectionId))
        }
        _readSectionIdsFlow.value = loadReadSectionIds()
    }

    fun toggleSectionRead(sectionId: String) {
        setSectionRead(sectionId, !isSectionRead(sectionId))
    }

    private fun loadReadSectionIds(): Set<String> =
        settings.keys.filter { it.startsWith(KEY_PREFIX) }.map { it.removePrefix(KEY_PREFIX) }.toSet()

    private fun key(sectionId: String) = KEY_PREFIX + sectionId

    private companion object {
        const val KEY_PREFIX = "read_section_"
    }
}
