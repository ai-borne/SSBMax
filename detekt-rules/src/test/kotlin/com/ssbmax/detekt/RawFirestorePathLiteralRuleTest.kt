package com.ssbmax.detekt

import io.gitlab.arturbosch.detekt.test.compileAndLint
import kotlin.test.Test
import kotlin.test.assertEquals

class RawFirestorePathLiteralRuleTest {
    private val rule = RawFirestorePathLiteralRule()

    @Test
    fun `flags a raw literal passed to collection`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.data.repository
            class Repo {
                val c = Firebase.firestore.collection("submissions")
            }
            """.trimIndent()
        )
        assertEquals(1, findings.size)
    }

    @Test
    fun `flags a raw literal passed to document`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.data.repository
            class Repo {
                fun get() = collection.document("users")
            }
            """.trimIndent()
        )
        assertEquals(1, findings.size)
    }

    @Test
    fun `allows a reference to SsbContracts FirestorePaths`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.data.repository
            class Repo {
                val c = Firebase.firestore.collection(SsbContracts.FirestorePaths.SUBMISSIONS)
            }
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }

    @Test
    fun `allows a document call with a variable id, not a literal`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.data.repository
            class Repo {
                fun get(id: String) = collection.document(id)
            }
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }

    @Test
    fun `allows an interpolated literal built from contract-derived path segments`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.data.repository
            class Repo {
                fun get() = Firebase.firestore.collection("${'$'}COLLECTION_TEST_CONTENT/${'$'}PATH_GTO")
            }
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }

    @Test
    fun `does not flag calls outside com ssbmax shared data`() {
        val findings = rule.compileAndLint(
            """
            package com.ssbmax.shared.contracts
            class Repo {
                val c = Firebase.firestore.collection("submissions")
            }
            """.trimIndent()
        )
        assertEquals(0, findings.size)
    }
}
