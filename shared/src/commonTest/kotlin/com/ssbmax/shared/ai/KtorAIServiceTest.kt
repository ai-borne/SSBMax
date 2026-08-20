package com.ssbmax.shared.ai

import com.ssbmax.shared.domain.model.PPDTImageContext
import com.ssbmax.shared.domain.model.TATImageContext
import com.ssbmax.shared.domain.model.interview.InterviewQuestion
import com.ssbmax.shared.domain.model.interview.OLQ
import com.ssbmax.shared.domain.model.interview.QuestionSource
import com.ssbmax.shared.domain.util.NoOpLogger
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Validates [KtorAIService] end-to-end against a fake [GeminiClient]: which
 * tier (`maxOutputTokens`) each method uses, that the multimodal image bytes
 * are forwarded/omitted correctly, and response parsing for every distinct
 * parser the interface exercises.
 *
 * Uses [FakeGeminiClient] rather than a mocked HTTP transport (as this test
 * did before the Gemini-proxy security fix) because [GeminiClient]'s real
 * implementation now calls an authenticated Cloud Function via GitLive's
 * Firebase Functions client, not raw Ktor -- there is no HTTP request to mock
 * from `shared`'s commonTest anymore. Capturing the arguments passed to
 * [GeminiClient.generateContent] directly is both simpler and a closer test
 * of this class's actual contract with its dependency.
 */
class KtorAIServiceTest {

    private class FakeGeminiClient(
        private val respond: () -> Result<String> = { Result.success("ok") }
    ) : GeminiClient {
        var lastPrompt: String = ""
        var lastImageBytes: ByteArray = ByteArray(0)
        var lastTemperature: Float = -1f
        var lastMaxOutputTokens: Int = -1

        override suspend fun generateContent(
            prompt: String,
            imageBytes: ByteArray,
            imageMimeType: String,
            temperature: Float,
            maxOutputTokens: Int
        ): Result<String> {
            lastPrompt = prompt
            lastImageBytes = imageBytes
            lastTemperature = temperature
            lastMaxOutputTokens = maxOutputTokens
            return respond()
        }
    }

    private fun serviceWith(client: FakeGeminiClient): KtorAIService {
        val logger = NoOpLogger()
        return KtorAIService(
            client = client,
            logger = logger,
            ppdtAnalyzer = KtorPPDTAnalyzer(client, logger),
            tatStoryAnalyzer = KtorTATStoryAnalyzer(client, logger)
        )
    }

    private val question = InterviewQuestion(
        id = "q1",
        questionText = "Tell me about a time you led a team.",
        expectedOLQs = listOf(OLQ.INFLUENCE_GROUP),
        source = QuestionSource.GENERIC_POOL
    )

    // ---- Token-tier request shape ----

    @Test
    fun `analyzeResponse uses tier-1 maxOutputTokens of 8192`() = runTest {
        val client = FakeGeminiClient {
            Result.success(
                """{"olqScores": [{"olq": "INFLUENCE_GROUP", "score": 5.0, "reasoning": "ok"}], "overallConfidence": 70, "keyInsights": []}"""
            )
        }
        serviceWith(client).analyzeResponse(question, "I organized the team.", "text").getOrThrow()
        assertEquals(8192, client.lastMaxOutputTokens)
    }

    @Test
    fun `generatePIQBasedQuestions uses tier-2 maxOutputTokens of 12288`() = runTest {
        val client = FakeGeminiClient {
            Result.success("""[{"id":"q1","questionText":"Why defense?","targetOLQs":["COURAGE"]}]""")
        }
        serviceWith(client).generatePIQBasedQuestions(piqData = "PIQ context", count = 1).getOrThrow()
        assertEquals(12288, client.lastMaxOutputTokens)
    }

    @Test
    fun `generateFeedback uses tier-3 maxOutputTokens of 16384`() = runTest {
        val client = FakeGeminiClient { Result.success("Great performance overall.") }
        val result = serviceWith(client).generateFeedback(
            questions = listOf(question),
            responses = listOf("I led the team."),
            olqScores = mapOf(OLQ.INFLUENCE_GROUP to 5f)
        )
        assertEquals("Great performance overall.", result.getOrThrow())
        assertEquals(16384, client.lastMaxOutputTokens)
    }

    // ---- Response parsing per parser type ----

    @Test
    fun `generatePIQBasedQuestions parses the question array response`() = runTest {
        val client = FakeGeminiClient {
            Result.success("""[{"id":"q1","questionText":"Why defense?","targetOLQs":["COURAGE"]}]""")
        }
        val result = serviceWith(client).generatePIQBasedQuestions(piqData = "PIQ context", count = 1).getOrThrow()
        assertEquals(1, result.size)
        assertEquals("Why defense?", result.first().questionText)
        assertEquals(listOf(OLQ.COURAGE), result.first().expectedOLQs)
    }

    @Test
    fun `analyzeWATResponse parses the GTO analysis object response`() = runTest {
        val client = FakeGeminiClient {
            Result.success("""{"olqScores": {"COURAGE": {"score": 6.0, "confidence": 80, "reasoning": "steady"}}}""")
        }
        val result = serviceWith(client).analyzeWATResponse("prompt").getOrThrow()
        assertEquals(1, result.olqScores.size)
        assertEquals(80, result.overallConfidence)
    }

    // ---- Multimodal request shape ----

    @Test
    fun `analyzePPDTMultimodal forwards imageBytes when non-empty`() = runTest {
        val client = FakeGeminiClient {
            Result.success("""{"olqScores": {"COURAGE": {"score": 6.0, "confidence": 80, "reasoning": "ok"}}}""")
        }
        serviceWith(client).analyzePPDTMultimodal(
            imageBytes = byteArrayOf(1, 2, 3, 4),
            story = "A story",
            imageContext = PPDTImageContext(),
            candidateGender = "male"
        ).getOrThrow()

        assertTrue(client.lastImageBytes.contentEquals(byteArrayOf(1, 2, 3, 4)))
    }

    @Test
    fun `analyzePPDTMultimodal forwards empty imageBytes as text-only`() = runTest {
        val client = FakeGeminiClient {
            Result.success("""{"olqScores": {"COURAGE": {"score": 6.0, "confidence": 80, "reasoning": "ok"}}}""")
        }
        serviceWith(client).analyzePPDTMultimodal(
            imageBytes = ByteArray(0),
            story = "A story",
            imageContext = PPDTImageContext(),
            candidateGender = "male"
        ).getOrThrow()

        assertTrue(client.lastImageBytes.isEmpty())
    }

    @Test
    fun `analyzeTATStoryMultimodal forwards imageBytes when non-empty`() = runTest {
        val client = FakeGeminiClient {
            Result.success("""{"olqScores": {"COURAGE": {"score": 6.0, "confidence": 80, "reasoning": "ok"}}}""")
        }
        serviceWith(client).analyzeTATStoryMultimodal(
            imageBytes = byteArrayOf(5, 6, 7),
            story = "A story",
            imageContext = TATImageContext(),
            candidateGender = "female",
            storyIndex = 0,
            totalStories = 11
        ).getOrThrow()

        assertTrue(client.lastImageBytes.contentEquals(byteArrayOf(5, 6, 7)))
    }

    @Test
    fun `isAvailable returns false not an exception when the call fails`() = runTest {
        val client = FakeGeminiClient { Result.failure(IllegalStateException("boom")) }
        assertEquals(false, serviceWith(client).isAvailable())
    }

    // ---- Ported from core:data's GeminiAIServiceTest (Phase 9.0, when KtorAIService
    // became the only AIService). Not ported: `analyzePPDTMultimodal falls back
    // gracefully when image bytes are empty`, which guarded an Android
    // GenerativeModel/Bitmap NPE on zero-length arrays -- this implementation
    // base64-encodes the raw ByteArray with no Bitmap step, and the empty-bytes
    // request shape is already asserted above.

    @Test
    fun `every request is temperature zero so identical submissions score identically`() = runTest {
        // WHY: SSB grading must be reproducible -- a candidate re-submitting the same
        // story must not get a different OLQ profile. Temperature drift is invisible
        // in output but breaks that guarantee.
        val client = FakeGeminiClient {
            Result.success("""{"olqScores": {"COURAGE": {"score": 6.0, "confidence": 80, "reasoning": "ok"}}}""")
        }
        serviceWith(client).analyzeWATResponse("prompt").getOrThrow()
        assertEquals(0.0f, client.lastTemperature)
    }

    @Test
    fun `generateAdaptiveQuestions returns a failure Result when the call fails`() = runTest {
        // WHY: this runs mid-interview; an escaping exception would kill the session
        // rather than let the caller fall back to the generic question pool.
        val client = FakeGeminiClient { Result.failure(IllegalStateException("boom")) }

        val result = serviceWith(client).generateAdaptiveQuestions(
            previousQuestions = listOf(question),
            previousResponses = listOf("I led the team."),
            weakOLQs = listOf(OLQ.COURAGE),
            count = 2
        )

        assertTrue(result.isFailure)
    }

    @Test
    fun `analyzePPDTMultimodal parses all 15 OLQ scores from a full response`() = runTest {
        // WHY: PPDT grading is only valid on the complete OLQ set -- a parser that
        // silently returns a subset produces a plausible-looking but wrong assessment.
        val fullOlqJson = OLQ.entries.joinToString(",") { olq ->
            """"${olq.name}": {"score": 6.0, "confidence": 80, "reasoning": "n/a"}"""
        }
        val client = FakeGeminiClient { Result.success("""{"olqScores": {$fullOlqJson}}""") }

        val result = serviceWith(client).analyzePPDTMultimodal(
            imageBytes = byteArrayOf(1, 2, 3),
            story = "A story",
            imageContext = PPDTImageContext(),
            candidateGender = "male"
        ).getOrThrow()

        assertEquals(OLQ.entries.size, result.olqScores.size)
    }

    @Test
    fun `analyzePPDTMultimodal returns a failure Result when the call fails`() = runTest {
        // WHY: PPDT analysis runs in a background worker whose retry/error handling
        // depends on a failed Result; an escaping exception would crash the worker.
        val client = FakeGeminiClient { Result.failure(IllegalStateException("boom")) }

        val result = serviceWith(client).analyzePPDTMultimodal(
            imageBytes = byteArrayOf(1, 2, 3),
            story = "A story",
            imageContext = PPDTImageContext(),
            candidateGender = "male"
        )

        assertTrue(result.isFailure)
    }
}
