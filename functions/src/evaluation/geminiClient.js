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
 * quota re-check. Text-only (no image support) since Phase 4's first consumer
 * (WAT) has none; PPDT/TAT (Phases 9-10) will need to extend this.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL_NAME = 'gemini-2.5-flash';
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured.');
  }
  return new GoogleGenerativeAI(apiKey);
}

/** Real `generateContent` for injection into `core.js::runEvaluation`. */
async function generateContent(prompt) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: DEFAULT_TEMPERATURE,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS
    }
  });
  const result = await model.generateContent(prompt);
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
