package com.ssbmax.shared.ui.oir

import com.ssbmax.shared.domain.model.CategoryScore
import com.ssbmax.shared.domain.model.OIRQuestionType

internal fun visibleOIRCategoryScores(
    scores: Map<OIRQuestionType, CategoryScore>
): List<CategoryScore> = scores.values.filter { it.totalQuestions > 0 }
