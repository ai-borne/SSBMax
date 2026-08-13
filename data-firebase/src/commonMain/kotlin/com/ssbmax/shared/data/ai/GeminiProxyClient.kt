package com.ssbmax.shared.data.ai

import com.ssbmax.shared.ai.GeminiClient
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.functions.functions
import kotlinx.serialization.Serializable
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

@Serializable
private data class GeminiProxyRequest(
    val prompt: String,
    val imageBase64: String = "",
    val imageMimeType: String = "image/jpeg",
    val temperature: Float = 0.0f,
    val maxOutputTokens: Int = 8192
)

@Serializable
private data class GeminiProxyResponse(val text: String)

/**
 * [GeminiClient] backed by the `geminiGenerateContent` Cloud Function
 * (`functions/src/geminiProxy.js`) rather than a direct call to Gemini.
 *
 * This is what keeps the Gemini API key out of the app binary: the key lives
 * only in the Cloud Function's environment, never shipped to Android or iOS.
 * GitLive's `httpsCallable` attaches the signed-in user's Firebase Auth ID
 * token to the request automatically (same mechanism
 * [com.ssbmax.shared.data.repository.GitLiveTestUsageRecorder] already relies
 * on for `recordTestUsage`), so the function can reject unauthenticated
 * callers without this class doing any manual token plumbing.
 */
class GeminiProxyClient : GeminiClient {

    @OptIn(ExperimentalEncodingApi::class)
    override suspend fun generateContent(
        prompt: String,
        imageBytes: ByteArray,
        imageMimeType: String,
        temperature: Float,
        maxOutputTokens: Int
    ): Result<String> = try {
        val request = GeminiProxyRequest(
            prompt = prompt,
            imageBase64 = if (imageBytes.isNotEmpty()) Base64.encode(imageBytes) else "",
            imageMimeType = imageMimeType,
            temperature = temperature,
            maxOutputTokens = maxOutputTokens
        )
        val result = Firebase.functions.httpsCallable("geminiGenerateContent").invoke(request)
        val text = result.data<GeminiProxyResponse>().text
        if (text.isEmpty()) {
            Result.failure(IllegalStateException("No response text from Gemini"))
        } else {
            Result.success(text)
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
