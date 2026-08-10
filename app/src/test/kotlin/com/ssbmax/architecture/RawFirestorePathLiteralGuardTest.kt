package com.ssbmax.architecture

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * Phase 2 guard test (docs/plans/CrossPlatform_SSOT): a raw Firestore
 * collection/document-path literal must never reappear in `shared` or
 * `data-firebase` outside the generated `SsbContracts` file itself. This is
 * a fast, source-grep backstop to `RawFirestorePathLiteralRule` in
 * `:detekt-rules` (the ssbmax detekt ruleset) -- text-based rather than
 * AST-based, so it also catches drift if detekt is ever skipped locally.
 */
class RawFirestorePathLiteralGuardTest {

    private val projectRoot: File =
        File(System.getProperty("user.dir") ?: ".").parentFile ?: File(".")

    @Test
    fun `no raw Firestore collection or document literal outside SsbContracts`() {
        val rawLiteralCall = Regex("""\.(collection|document)\(\s*"[^"$]*"\s*\)""")
        val exemptFiles = setOf(
            "shared/src/commonMain/kotlin/com/ssbmax/shared/contracts/SsbContracts.kt"
        )

        val offenders = listOf(
            File(projectRoot, "shared/src/commonMain"),
            File(projectRoot, "data-firebase/src/commonMain")
        ).flatMap { root ->
            root.walkTopDown()
                .filter { it.isFile && it.extension == "kt" }
                .filter { file ->
                    val relativePath = file.relativeTo(projectRoot).path.replace(File.separatorChar, '/')
                    relativePath !in exemptFiles && rawLiteralCall.containsMatchIn(file.readText())
                }
                .map { it.relativeTo(projectRoot).path.replace(File.separatorChar, '/') }
        }

        assertEquals(
            "Raw Firestore path literal(s) found -- use SsbContracts.FirestorePaths instead: $offenders",
            emptyList<String>(),
            offenders
        )
    }
}
