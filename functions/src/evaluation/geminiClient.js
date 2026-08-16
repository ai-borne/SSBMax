/**
 * Gemini text-generation client for Tier-2 `evaluate*` callables (Phase 4, Web SSB
 * Test Flow Parity plan).
 *
 * Deliberately separate from `geminiProxy.js`: that function is the passthrough
 * `Firebase.functions.httpsCallable` path client SDKs call directly (with its own
 * per-user hourly abuse cap, since it accepts an arbitrary prompt from the client).
 * `evaluate*` callables never accept a prompt from the client -- they build it
 * server-side from a fetched submission -- so the same abuse surface doesn't apply
 * here; cost containment instead comes from `core.js::checkQuota`'s subscription
 * quota re-check.
 *
 * **Multimodal (Phase 9 addition):** `generateContent`'s optional `imageBytes`
 * param mirrors `GeminiClient.kt::generateContent`'s `imageBytes`/`imageMimeType`
 * params (same `image/jpeg` default) -- an inline base64 `inlineData` part
 * alongside the text prompt, not a separate call. `imageBytes` is always resolved
 * server-side by the caller (`ppdtEvaluate.js::resolveImage`, TAT in Phase 10) --
 * this function has no URL-fetching of its own, so it carries no SSRF surface
 * itself.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = 'gemini-2.5-flash';
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_IMAGE_MIME_TYPE = 'image/jpeg';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured.');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Real `generateContent` for injection into `core.js::runEvaluation` (text-only
 * callers) or direct use by bespoke wrappers (`ppdtEvaluate.js`) that need the
 * multimodal `imageBytes` param.
 *
 * @param prompt text prompt
 * @param imageBytes optional `Buffer`/`Uint8Array` -- when present, attached as an
 *   inline image part alongside the text
 * @param imageMimeType defaults to `image/jpeg`, matching the KMP client's default
 */
async function generateContent(prompt, imageBytes, imageMimeType = DEFAULT_IMAGE_MIME_TYPE) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: DEFAULT_TEMPERATURE,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS
    }
  });
  const parts = [{ text: prompt }];
  if (imageBytes && imageBytes.length > 0) {
    parts.push({
      inlineData: {
        data: Buffer.from(imageBytes).toString('base64'),
        mimeType: imageMimeType
      }
    });
  }
  const result = await model.generateContent(parts);
  const text = result.response.text();
  if (!text) {
    throw new Error('No response text from Gemini');
  }
  return text;
}

module.exports = {
  generateContent,
  MODEL_NAME
};
