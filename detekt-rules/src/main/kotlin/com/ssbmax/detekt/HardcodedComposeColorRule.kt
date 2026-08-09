package com.ssbmax.detekt

import io.gitlab.arturbosch.detekt.api.CodeSmell
import io.gitlab.arturbosch.detekt.api.Config
import io.gitlab.arturbosch.detekt.api.Debt
import io.gitlab.arturbosch.detekt.api.Entity
import io.gitlab.arturbosch.detekt.api.Issue
import io.gitlab.arturbosch.detekt.api.Rule
import io.gitlab.arturbosch.detekt.api.Severity
import org.jetbrains.kotlin.psi.KtCallExpression

/** Prevents raw hex/RGB colors in shared UI; theme definitions are the approved exception. */
class HardcodedComposeColorRule(config: Config = Config.empty) : Rule(config) {
    override val issue = Issue(
        id = "HardcodedComposeColor",
        severity = Severity.Defect,
        description = "Raw hex/RGB colors in Compose UI must use MaterialTheme or semantic tokens.",
        debt = Debt.FIVE_MINS
    )

    override fun visitCallExpression(expression: KtCallExpression) {
        super.visitCallExpression(expression)
        if (!expression.inSharedUi() || expression.calleeExpression?.text != "Color") return
        if (expression.containingKtFile.packageFqName.asString().contains(".ui.theme")) return

        val firstArgument = expression.valueArguments.firstOrNull()?.getArgumentExpression() ?: return
        if (!firstArgument.text.matches(HEX_OR_RGB_LITERAL)) return

        report(
            CodeSmell(
                issue,
                Entity.from(firstArgument),
                "Raw color ${firstArgument.text} must use MaterialTheme.colorScheme or an approved semantic token."
            )
        )
    }

    private fun KtCallExpression.inSharedUi(): Boolean =
        containingKtFile.packageFqName.asString().startsWith("com.ssbmax.shared.ui")

    private companion object {
        val HEX_OR_RGB_LITERAL = Regex("0[xX][0-9a-fA-F]+|[0-9]{1,3}([, ]+[0-9]{1,3}){2,3}")
    }
}
