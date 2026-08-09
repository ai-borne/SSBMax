package com.ssbmax.shared.ui.oir

import com.ssbmax.shared.domain.model.CategoryScore

import com.ssbmax.shared.domain.model.OIRQuestionType

import kotlin.test.Test
import kotlin.test.assertEquals



class OIRResultPresentationTest {

    @Test
    fun zeroQuestionCategoriesAreHiddenFromResultBreakdown() {
        val scores = OIRQuestionType.values().associateWith { type ->
            CategoryScore(type, if (type == OIRQuestionType.SPATIAL_REASONING) 0 else 10, 2, 20f, 1)
        }

        val visible = visibleOIRCategoryScores(scores)

        assertEquals(
            listOf(
                OIRQuestionType.VERBAL_REASONING,
                OIRQuestionType.NON_VERBAL_REASONING,
                OIRQuestionType.NUMERICAL_ABILITY
            ),
            visible.map { it.category }
        )
    }

}
