package com.ssbmax.detekt

import io.gitlab.arturbosch.detekt.api.CodeSmell
import io.gitlab.arturbosch.detekt.api.Config
import io.gitlab.arturbosch.detekt.api.Debt
import io.gitlab.arturbosch.detekt.api.Entity
import io.gitlab.arturbosch.detekt.api.Issue
import io.gitlab.arturbosch.detekt.api.Rule
import io.gitlab.arturbosch.detekt.api.Severity
import org.jetbrains.kotlin.psi.KtCallExpression
import org.jetbrains.kotlin.psi.KtLiteralStringTemplateEntry
import org.jetbrains.kotlin.psi.KtStringTemplateExpression

/**
 * Bans raw Firestore collection/document-path string literals in `.collection(...)` /
 * `.document(...)` calls under `com.ssbmax.shared.data` (data-firebase's GitLive
 * repositories). The only source of truth for a path is the generated
 * `SsbContracts.FirestorePaths` object (docs/plans/CrossPlatform_SSOT Phase 2) --
 * a raw literal here is exactly the kind of drift a fourth spelling of "submissions"
 * created before Phase 2.
 *
 * A literal built via string interpolation (e.g. `"$COLLECTION_TEST_CONTENT/$PATH_GTO"`)
 * is not flagged -- that's a caller passing an already-contract-derived value through,
 * not introducing a new one.
 */
class RawFirestorePathLiteralRule(config: Config = Config.empty) : Rule(config) {
    override val issue = Issue(
        id = "RawFirestorePathLiteral",
        severity = Severity.Defect,
        description = "Firestore collection/document paths must come from SsbContracts.FirestorePaths, not a raw string literal.",
        debt = Debt.FIVE_MINS
    )

    override fun visitCallExpression(expression: KtCallExpression) {
        super.visitCallExpression(expression)
        val calleeName = expression.calleeExpression?.text
        val firstArgument = expression.valueArguments.firstOrNull()?.getArgumentExpression()
        val template = firstArgument as? KtStringTemplateExpression

        val isBannedLiteral = expression.inScopedPackage() &&
            (calleeName == "collection" || calleeName == "document") &&
            template != null &&
            template.entries.isNotEmpty() &&
            template.entries.all { it is KtLiteralStringTemplateEntry }

        if (isBannedLiteral && firstArgument != null) {
            report(
                CodeSmell(
                    issue,
                    Entity.from(firstArgument),
                    "Raw Firestore path literal ${template!!.text} in .$calleeName(...) -- use SsbContracts.FirestorePaths instead."
                )
            )
        }
    }

    private fun KtCallExpression.inScopedPackage(): Boolean {
        val pkg = containingKtFile.packageFqName.asString()
        return pkg.startsWith("com.ssbmax.shared.data") && pkg != "com.ssbmax.shared.contracts"
    }
}
