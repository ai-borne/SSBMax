package com.ssbmax.detekt

import io.gitlab.arturbosch.detekt.test.compileAndLint
import kotlin.test.Test
import kotlin.test.assertEquals

class IconOnlyControlLabelRuleTest {
    private val rule = IconOnlyControlLabelRule()

    @Test
    fun `flags icon button without a description`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.ui.components
            fun action() {
                IconButton(onClick = {}) { Icon(Icons.Default.Refresh, null) }
            }
            """.trimIndent()
        )
        assertEquals(1, findings.size)
    }

    @Test
    fun `allows localized named description`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.ui.components
            fun action() {
                IconButton(onClick = {}) {
                    Icon(Icons.Default.Refresh, contentDescription = stringResource(Res.string.refresh))
                }
            }
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }

    @Test
    fun `allows localized positional description`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.ui.components
            fun action() {
                IconButton(onClick = {}) { Icon(Icons.Default.Refresh, stringResource(Res.string.refresh)) }
            }
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }
}
