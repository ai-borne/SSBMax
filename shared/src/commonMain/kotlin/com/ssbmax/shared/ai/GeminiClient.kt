package com.ssbmax.shared.ai

/**
 * Abstraction over "send a prompt (+ optional image) to Gemini, get text back."
 *
 * The concrete implementation is [GeminiProxyClient]
 * (`data-firebase/.../data/ai/GeminiProxyClient.kt`), not anything in this
 * module — `shared` carries no Firebase so its Kotlin/Native test binaries
 * link without CocoaPods (see `data-firebase`'s own module doc). Calling
 * Gemini requires an authenticated Cloud Function proxy (the API key must
 * never ship inside the app binary), and that call goes through GitLive's
 * Firebase Functions client, which only `data-firebase` may depend on.
 */
interface GeminiClient {
    suspend fun generateContent(
        prompt: String,
        imageBytes: ByteArray = ByteArray(0),
        imageMimeType: String = "image/jpeg",
        temperature: Float = 0.0f,
        maxOutputTokens: Int = 8192
    ): Result<String>
}
