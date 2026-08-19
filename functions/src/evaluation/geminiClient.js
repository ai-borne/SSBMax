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
const functions = require('firebase-functions');

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
 * @param meta optional `{ testType, submissionId, callTag }` -- purely for cost
 *   observability (see `logGeminiUsage`). Never affects the Gemini call itself, so
 *   every existing caller that omits it keeps working unchanged.
 */
async function generateContent(prompt, imageBytes, imageMimeType = DEFAULT_IMAGE_MIME_TYPE, meta) {
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
  logGeminiUsage(result.response.usageMetadata, meta);
  const text = result.response.text();
  if (!text) {
    throw new Error('No response text from Gemini');
  }
  return text;
}

// gemini-2.5-flash rate card, USD per 1M tokens (text). APPROXIMATE -- verify against
// https://ai.google.dev/gemini-api/docs/pricing before trusting the cost figures in
// reports; this is a rough dashboard estimate, not a billing-accurate figure (actual
// Gemini billing also varies by cached-vs-uncached input and any image/audio token
// surcharge, neither of which this estimate accounts for).
const USD_PER_1M_INPUT_TOKENS = 0.3;
const USD_PER_1M_OUTPUT_TOKENS = 2.5;
const INR_PER_USD = 88; // approximate -- update periodically, or drop cost fields and compute in a sheet from raw tokens instead

function estimateCostInr(promptTokenCount, candidatesTokenCount) {
  const usd =
    (promptTokenCount / 1_000_000) * USD_PER_1M_INPUT_TOKENS +
    (candidatesTokenCount / 1_000_000) * USD_PER_1M_OUTPUT_TOKENS;
  return Math.round(usd * INR_PER_USD * 10000) / 10000;
}

/**
 * Structured Cloud Logging entry per Gemini call, tagged with `testType`/`submissionId`
 * so cost-per-test-type can be queried later without any extra Firestore writes (see
 * `docs/plans/...` cost-guardrails discussion -- there was previously no per-call
 * token/cost record anywhere, only the aggregate GCP bill). `jsonPayload.event ==
 * 'gemini_usage'` is the filter to use in Logs Explorer / a log-based metric.
 * Never throws -- a logging failure must not fail the evaluation it's observing.
 */
function logGeminiUsage(usageMetadata, meta = {}) {
  try {
    const promptTokenCount = usageMetadata?.promptTokenCount || 0;
    const candidatesTokenCount = usageMetadata?.candidatesTokenCount || 0;
    const totalTokenCount = usageMetadata?.totalTokenCount || promptTokenCount + candidatesTokenCount;
    functions.logger.info('gemini_usage', {
      event: 'gemini_usage',
      model: MODEL_NAME,
      testType: meta.testType || null,
      submissionId: meta.submissionId || null,
      callTag: meta.callTag || null,
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount,
      estimatedCostInr: estimateCostInr(promptTokenCount, candidatesTokenCount)
    });
  } catch (e) {
    console.warn(`gemini_usage logging failed (non-fatal): ${e.message}`);
  }
}

module.exports = {
  generateContent,
  MODEL_NAME
};
