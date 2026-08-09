package com.ssbmax.detekt

import io.gitlab.arturbosch.detekt.api.Config
import io.gitlab.arturbosch.detekt.api.RuleSet
import io.gitlab.arturbosch.detekt.api.RuleSetProvider

class SSBMaxRuleSetProvider : RuleSetProvider {

    override val ruleSetId = "ssbmax"

    override fun instance(config: Config) = RuleSet(
        ruleSetId,
        listOf(
            HardcodedComposeTextRule(config),
            HardcodedComposeColorRule(config),
            IconOnlyControlLabelRule(config),
            MissingComposePreviewRule(config)
        )
    )
}
