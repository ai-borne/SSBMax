package com.ssbmax.shared.ai

import com.ssbmax.shared.ai.prompts.SSBInterviewPrompts
import com.ssbmax.shared.domain.model.PPDTImageContext
import com.ssbmax.shared.domain.model.TATImageContext
import com.ssbmax.shared.domain.model.gto.GTOTestType
import com.ssbmax.shared.domain.model.interview.InterviewQuestion
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.service.AIService
import com.ssbmax.shared.domain.service.ResponseAnalysis
import com.ssbmax.shared.domain.util.DomainLogger
import kotlinx.coroutines.withTimeout

/**
 * KMP port of core:data's `GeminiAIService`, replacing the Android-only
 * `com.google.ai.client.generativeai.GenerativeModel` with [GeminiClient]'s
 * proxied calls. Full [AIService] implementation (12 methods) — supersedes
 * the Phase 2 narrower `InterviewResponseAnalysisService`/
 * `KtorInterviewResponseAnalysisService` slice, which is removed as part of
 * this port (nothing else depended on the narrower interface).
 *
 * Deviation from the Android original: that version constructs three separate
 * `GenerativeModel` instances (one per token tier) because the Android SDK
 * bakes `generationConfig` into the model at construction time. Here,
 * [GeminiClient.generateContent] takes `maxOutputTokens`/`temperature` as
 * call-site parameters, so one client instance serves all three tiers —
 * same tier semantics, no functional change, just a simpler shape enabled by
 * the call being stateless per-request.
 */
class KtorAIService(
    private val client: GeminiClient,
    private val logger: DomainLogger,
    private val ppdtAnalyzer: KtorPPDTAnalyzer,
    private val tatStoryAnalyzer: KtorTATStoryAnalyzer
) : AIService {

    override suspend fun generatePIQBasedQuestions(
        piqData: String,
        targetOLQs: List<OLQ>?,
        count: Int,
        difficulty: Int
    ): Result<List<InterviewQuestion>> = runCatching {
        withTimeout(QUESTION_GENERATION_TIMEOUT) {
            val prompt = SSBInterviewPrompts.buildQuestionGenerationPrompt(
                piqContext = piqData,
                count = count,
                difficulty = difficulty,
                targetOLQs = targetOLQs
            )
            // Tier 2: OLQ_DEFINITIONS + PIQ_TO_OLQ_MAPPING + PIQ context = ~3K tokens input
            val generated = generateOrThrow(prompt, MAX_LARGE_CONTEXT_TOKENS, "PIQ-based question generation")
            KtorGeminiResponseParser.parseQuestionResponse(generated).getOrThrow()
        }
    }.onFailure { logger.e(TAG, "Failed to generate PIQ-based questions", it) }

    override suspend fun generateAdaptiveQuestions(
        previousQuestions: List<InterviewQuestion>,
        previousResponses: List<String>,
        weakOLQs: List<OLQ>,
        count: Int
    ): Result<List<InterviewQuestion>> = runCatching {
        withTimeout(LARGE_CONTEXT_TIMEOUT) {
            val qaHistory = previousQuestions.zip(previousResponses).map { (q, a) -> q.questionText to a }
            val prompt = SSBInterviewPrompts.buildAdaptiveQuestionPrompt(
                piqContext = buildContextFromQA(previousQuestions),
                previousQA = qaHistory,
                weakOLQs = weakOLQs,
                count = count
            )
            // Tier 2: Q&A history grows to ~6K tokens for a 25-question session
            val generated = generateOrThrow(prompt, MAX_LARGE_CONTEXT_TOKENS, "adaptive question generation")
            KtorGeminiResponseParser.parseQuestionResponse(generated).getOrThrow()
        }
    }.onFailure { logger.e(TAG, "Failed to generate adaptive questions", it) }

    private fun buildContextFromQA(questions: List<InterviewQuestion>): String = buildString {
        appendLine("(Context derived from previous questions asked)")
        appendLine()
        appendLine("Topics covered so far:")
        questions.forEachIndexed { i, q -> appendLine("- Question ${i + 1}: ${q.questionText.take(100)}...") }
        appendLine()
        appendLine("OLQs assessed:")
        append(questions.flatMap { it.expectedOLQs }.distinct().joinToString(", ") { it.displayName })
    }

    override suspend fun analyzeResponse(
        question: InterviewQuestion,
        response: String,
        responseMode: String
    ): Result<ResponseAnalysis> = runCatching {
        withTimeout(RESPONSE_ANALYSIS_TIMEOUT) {
            val prompt = SSBInterviewPrompts.buildResponseAnalysisPrompt(
                questionText = question.questionText,
                responseText = response,
                expectedOLQs = question.expectedOLQs,
                responseMode = responseMode
            )
            val generated = generateOrThrow(prompt, MAX_TOKENS, "interview response analysis")
            KtorGeminiResponseParser.parseAnalysisResponse(generated).getOrThrow()
        }
    }.onFailure { logger.e(TAG, "Failed to analyze interview response", it) }

    override suspend fun generateFeedback(
        questions: List<InterviewQuestion>,
        responses: List<String>,
        olqScores: Map<OLQ, Float>
    ): Result<String> = runCatching {
        withTimeout(SYNTHESIS_TIMEOUT) {
            val qaHistory = questions.zip(responses).map { (q, a) -> q.questionText to a }
            val prompt = SSBInterviewPrompts.buildFeedbackPrompt(
                piqContext = "(Full PIQ context not available for feedback generation)",
                questionAnswerPairs = qaHistory,
                olqScores = olqScores
            )
            // Tier 3: full Q&A transcript — 25 questions = ~7.5K tokens input alone
            generateOrThrow(prompt, MAX_SYNTHESIS_TOKENS, "feedback generation").trim()
        }
    }.onFailure { logger.e(TAG, "Failed to generate feedback", it) }

    override suspend fun analyzeGTOResponse(prompt: String, testType: GTOTestType): Result<ResponseAnalysis> =
        runCatching {
            withTimeout(RESPONSE_ANALYSIS_TIMEOUT) {
                val generated = generateOrThrow(prompt, MAX_TOKENS, "GTO $testType analysis")
                KtorGeminiResponseParser.parseGTOAnalysisResponse(generated).getOrThrow()
            }
        }.onFailure { logger.e(TAG, "Failed to analyze GTO response", it) }

    override suspend fun analyzeTATResponse(prompt: String): Result<ResponseAnalysis> = runCatching {
        withTimeout(SYNTHESIS_TIMEOUT) {
            // Tier 3: 12-story synthesis
            val generated = generateOrThrow(prompt, MAX_SYNTHESIS_TOKENS, "TAT synthesis")
            KtorGeminiResponseParser.parseGTOAnalysisResponse(generated).getOrThrow()
        }
    }.onFailure { logger.e(TAG, "Failed to analyze TAT response", it) }

    override suspend fun analyzeWATResponse(prompt: String): Result<ResponseAnalysis> = runCatching {
        withTimeout(RESPONSE_ANALYSIS_TIMEOUT) {
            val generated = generateOrThrow(prompt, MAX_TOKENS, "WAT analysis")
            KtorGeminiResponseParser.parseGTOAnalysisResponse(generated).getOrThrow()
        }
    }.onFailure { logger.e(TAG, "Failed to analyze WAT response", it) }

    override suspend fun analyzeSRTResponse(prompt: String): Result<ResponseAnalysis> = runCatching {
        withTimeout(LARGE_CONTEXT_TIMEOUT) {
            // Tier 2: 60 situation+response pairs — verbose edge case pushes past 8K
            val generated = generateOrThrow(prompt, MAX_LARGE_CONTEXT_TOKENS, "SRT analysis")
            KtorGeminiResponseParser.parseGTOAnalysisResponse(generated).getOrThrow()
        }
    }.onFailure { logger.e(TAG, "Failed to analyze SRT response", it) }

    override suspend fun analyzeSDResponse(prompt: String): Result<ResponseAnalysis> = runCatching {
        withTimeout(RESPONSE_ANALYSIS_TIMEOUT) {
            val generated = generateOrThrow(prompt, MAX_TOKENS, "SD analysis")
            KtorGeminiResponseParser.parseGTOAnalysisResponse(generated).getOrThrow()
        }
    }.onFailure { logger.e(TAG, "Failed to analyze SD response", it) }

    override suspend fun analyzePPDTMultimodal(
        imageBytes: ByteArray,
        story: String,
        imageContext: PPDTImageContext,
        candidateGender: String
    ): Result<ResponseAnalysis> =
        ppdtAnalyzer.analyzePPDTMultimodal(imageBytes, story, imageContext, candidateGender)

    override suspend fun analyzeTATStoryMultimodal(
        imageBytes: ByteArray,
        story: String,
        imageContext: TATImageContext,
        candidateGender: String,
        storyIndex: Int,
        totalStories: Int,
        imageGenderTag: String
    ): Result<ResponseAnalysis> = tatStoryAnalyzer.analyzeTATStoryMultimodal(
        imageBytes, story, imageContext, candidateGender, storyIndex, totalStories, imageGenderTag
    )

    override suspend fun isAvailable(): Boolean = try {
        withTimeout(HEALTH_CHECK_TIMEOUT) {
            client.generateContent("Reply with OK").getOrNull()?.isNotEmpty() == true
        }
    } catch (e: Exception) {
        logger.e(TAG, "AI service health check failed", e)
        false
    }

    private suspend fun generateOrThrow(prompt: String, maxOutputTokens: Int, what: String): String =
        client.generateContent(prompt = prompt, maxOutputTokens = maxOutputTokens).getOrElse { error ->
            logger.e(TAG, "Gemini call failed for $what", error)
            throw error
        }

    private companion object {
        const val TAG = "KtorAIService"

        // Tier 1 — single-item analysis: TAT per-story, PPDT, WAT, SD, interview response
        const val MAX_TOKENS = 8192
        // Tier 2 — multi-item / growing context: SRT (60 situations), interview Q-gen,
        //          adaptive Q-gen (Q&A history grows to ~6K tokens for long sessions)
        const val MAX_LARGE_CONTEXT_TOKENS = 12288
        // Tier 3 — full-transcript synthesis: TAT synthesis (12 stories x thinking),
        //          interview feedback (full Q&A transcript + OLQ scores)
        const val MAX_SYNTHESIS_TOKENS = 16384

        const val RESPONSE_ANALYSIS_TIMEOUT = 60_000L
        const val QUESTION_GENERATION_TIMEOUT = 60_000L
        const val LARGE_CONTEXT_TIMEOUT = 90_000L
        const val SYNTHESIS_TIMEOUT = 120_000L
        const val HEALTH_CHECK_TIMEOUT = 10_000L
    }
}
