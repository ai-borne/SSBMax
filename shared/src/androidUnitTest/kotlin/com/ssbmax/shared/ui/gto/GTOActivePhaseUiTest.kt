package com.ssbmax.shared.ui.gto

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import com.ssbmax.shared.domain.model.GPEQuestion
import com.ssbmax.shared.testing.ensureComposeResourcesContextInitialized
import com.ssbmax.shared.ui.gto.gd.components.GDDiscussionPhase
import com.ssbmax.shared.ui.gto.gpe.components.GPEPlanningPhase
import com.ssbmax.shared.ui.gto.lecturette.components.LecturetteSpeechPhase
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@OptIn(ExperimentalTestApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w360dp-h1600dp")
class GTOActivePhaseUiTest {

    @Before
    fun setup() {
        ensureComposeResourcesContextInitialized()
    }

    @Test
    fun groupDiscussion_closeAction_isLabeledAndNavigates() = runComposeUiTest {
        var navigatedBack = false
        setContent {
            GDDiscussionPhase(
                topic = "Leadership under pressure",
                response = "A valid discussion response that is long enough.",
                charCount = 60,
                timeRemaining = "10:00",
                isTimeLow = false,
                onResponseChanged = {},
                onProceedToReview = {},
                onNavigateBack = { navigatedBack = true }
            )
        }

        onNodeWithContentDescription("Exit group discussion").performClick()
        check(navigatedBack)
    }

    @Test
    fun gpe_closeAction_isLabeled_andInvalidPlanCannotProceed() = runComposeUiTest {
        var navigatedBack = false
        setContent {
            GPEPlanningPhase(
                question = GPEQuestion(
                    id = "gpe-1",
                    imageUrl = "",
                    scenario = "A river crossing scenario",
                    imageDescription = "River crossing scenario",
                    minCharacters = 500,
                    maxCharacters = 2000
                ),
                planningResponse = "Too short",
                charactersCount = 9,
                timeRemaining = "10:00",
                isTimeLow = false,
                onResponseChanged = {},
                onProceedToReview = {},
                onNavigateBack = { navigatedBack = true }
            )
        }

        onNodeWithContentDescription("Exit group planning exercise").performClick()
        check(navigatedBack)
        onNodeWithText("Review Response").assertIsNotEnabled()
    }

    @Test
    fun lecturette_closeAction_isLabeled_andValidSpeechCanProceed() = runComposeUiTest {
        var proceeded = false
        setContent {
            LecturetteSpeechPhase(
                selectedTopic = "National security",
                speechTranscript = "A valid speech transcript with enough content.",
                charCount = 60,
                timeRemaining = "10:00",
                isTimeLow = false,
                onTranscriptChanged = {},
                onProceedToReview = { proceeded = true },
                onNavigateBack = {}
            )
        }

        onNodeWithContentDescription("Exit lecturette").assertIsDisplayed()
        onNodeWithText("Review Speech").performClick()
        check(proceeded)
    }
}
