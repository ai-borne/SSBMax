package com.ssbmax.detekt

import io.gitlab.arturbosch.detekt.test.compileAndLint
import kotlin.test.Test
import kotlin.test.assertEquals

class HardcodedComposeColorRuleTest {
    private val rule = HardcodedComposeColorRule()

    @Test
    fun `flags raw hex color in shared UI`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.ui.results
            fun badge() = Color(0xFF123456)
            """.trimIndent()
        )
        assertEquals(1, findings.size)
    }

    @Test
    fun `allows theme color scheme`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.ui.results
            fun badge() = MaterialTheme.colorScheme.error
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }

    @Test
    fun `allows centralized theme definitions`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.ui.theme
            val Navy = Color(0xFF123456)
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }
}
