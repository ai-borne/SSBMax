package com.ssbmax.shared.ai

import com.ssbmax.shared.ai.prompts.PPDTPrompts
import com.ssbmax.shared.domain.model.PPDTImageContext
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.util.DomainLogger
import kotlinx.coroutines.withTimeout

/**
 * Handles PPDT multimodal analysis (image bytes + story). KMP port of
 * core:data's `GeminiPPDTAnalyzer`: same prompt + parser, but the image is
 * attached via [GeminiClient]'s `imageBytes` parameter instead of the
 * Android SDK's `content { blob(...) }` DSL.
 */
class KtorPPDTAnalyzer(
    private val client: GeminiClient,
    private val logger: DomainLogger,
    private val responseTimeout: Long = 60_000L
) {
    suspend fun analyzePPDTMultimodal(
        imageBytes: ByteArray,
        story: String,
        imageContext: PPDTImageContext,
        candidateGender: String
    ): Result<ResponseAnalysis> {
        return try {
            withTimeout(responseTimeout) {
                val prompt = PPDTPrompts.generatePPDTMultimodalPrompt(
                    story = story,
                    imageContext = imageContext,
                    candidateGender = candidateGender
                )
                val generated = client.generateContent(prompt = prompt, imageBytes = imageBytes).getOrElse { error ->
                    logger.e(TAG, "Gemini call failed for PPDT multimodal analysis", error)
                    return@withTimeout Result.failure(error)
                }
                KtorGeminiResponseParser.parseGTOAnalysisResponse(generated)
            }
        } catch (e: Exception) {
            logger.e(TAG, "analyzePPDTMultimodal failed", e)
            Result.failure(e)
        }
    }

    private companion object {
        const val TAG = "KtorPPDTAnalyzer"
    }
}
