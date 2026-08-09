package com.ssbmax.detekt

import io.gitlab.arturbosch.detekt.api.CodeSmell
import io.gitlab.arturbosch.detekt.api.Config
import io.gitlab.arturbosch.detekt.api.Debt
import io.gitlab.arturbosch.detekt.api.Entity
import io.gitlab.arturbosch.detekt.api.Issue
import io.gitlab.arturbosch.detekt.api.Rule
import io.gitlab.arturbosch.detekt.api.Severity
import org.jetbrains.kotlin.psi.KtCallExpression

/** Requires an accessible Icon description inside statically detectable IconButton calls. */
class IconOnlyControlLabelRule(config: Config = Config.empty) : Rule(config) {
    override val issue = Issue(
        id = "IconOnlyControlLabel",
        severity = Severity.Defect,
        description = "IconButton content must include a non-empty contentDescription.",
        debt = Debt.FIVE_MINS
    )

    override fun visitCallExpression(expression: KtCallExpression) {
        super.visitCallExpression(expression)
        if (!expression.inSharedUi() || expression.calleeExpression?.text != "IconButton") return

        val source = expression.text
        val hasDescription = CONTENT_DESCRIPTION_PATTERN.containsMatchIn(source) ||
            POSITIONAL_ICON_DESCRIPTION_PATTERN.containsMatchIn(source)
        if (hasDescription) return

        report(
            CodeSmell(
                issue,
                Entity.from(expression),
                "Icon-only controls must provide a localized contentDescription on their Icon."
            )
        )
    }

    private fun KtCallExpression.inSharedUi(): Boolean =
        containingKtFile.packageFqName.asString().startsWith("com.ssbmax.shared.ui")

    private companion object {
        val CONTENT_DESCRIPTION_PATTERN = Regex("contentDescription\\s*=\\s*(?!null)(?!\\\"\\\")[^,}\\n]+")
        val POSITIONAL_ICON_DESCRIPTION_PATTERN = Regex(
            "Icon\\s*\\([^,]+,\\s*(?:stringResource|localizedContentDescription)",
            RegexOption.DOT_MATCHES_ALL
        )
    }
}
