package com.ssbmax.shared.ai

import com.ssbmax.shared.ai.prompts.TATStoryAnalysisPrompts
import com.ssbmax.shared.domain.model.TATImageContext
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.util.DomainLogger
import kotlinx.coroutines.withTimeout

/**
 * Handles per-story TAT multimodal analysis (image bytes + story). KMP port
 * of core:data's `GeminiTATStoryAnalyzer`: same prompt + parser, but the
 * image is attached via [GeminiClient]'s `imageBytes` parameter instead
 * of the Android SDK's `content { blob(...) }` DSL.
 */
class KtorTATStoryAnalyzer(
    private val client: GeminiClient,
    private val logger: DomainLogger,
    private val responseTimeout: Long = 60_000L
) {
    suspend fun analyzeTATStoryMultimodal(
        imageBytes: ByteArray,
        story: String,
        imageContext: TATImageContext,
        candidateGender: String,
        storyIndex: Int,
        totalStories: Int,
        imageGenderTag: String = "MIXED"
    ): Result<ResponseAnalysis> {
        return try {
            withTimeout(responseTimeout) {
                val prompt = TATStoryAnalysisPrompts.generateTATStoryMultimodalPrompt(
                    story = story,
                    imageContext = imageContext,
                    candidateGender = candidateGender,
                    storyIndex = storyIndex,
                    totalStories = totalStories,
                    imageGenderTag = imageGenderTag
                )
                val generated = client.generateContent(prompt = prompt, imageBytes = imageBytes).getOrElse { error ->
                    logger.e(TAG, "Gemini call failed for TAT story multimodal analysis", error)
                    return@withTimeout Result.failure(error)
                }
                KtorGeminiResponseParser.parseGTOAnalysisResponse(generated)
            }
        } catch (e: Exception) {
            logger.e(TAG, "analyzeTATStoryMultimodal failed", e)
            Result.failure(e)
        }
    }

    private companion object {
        const val TAG = "KtorTATStoryAnalyzer"
    }
}
