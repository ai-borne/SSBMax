/**
 * Gemini Proxy
 *
 * The only authorized path from Android/iOS to Gemini. The API key lives
 * only in this function's environment -- it never ships inside the app
 * binary (the previous client-side direct-to-Gemini call did exactly that,
 * via a key embedded in BuildConfig/Info.plist, extractable from any built
 * APK/IPA). Auth required. Per-user hourly rate cap defends against a
 * compromised auth session running up the bill; it is not a subscription
 * quota (that's eligibility.js's job).
 *
 * Passthrough only: prompt construction and response parsing stay entirely
 * client-side in KtorAIService/KtorPPDTAnalyzer/KtorTATStoryAnalyzer -- there
 * is no secret in that logic, only in the API key, so this function forwards
 * whatever prompt/image it's given and returns raw text back.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { FirestorePaths } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured.');
  }
  return new GoogleGenerativeAI(apiKey);
};

// Generous ceiling above the largest legitimate prompt tier (KtorAIService's own
// MAX_SYNTHESIS_TOKENS is 16384 tokens in, full TAT/feedback transcripts) -- this guards
// against a genuinely abusive payload, not normal traffic.
const MAX_PROMPT_CHARACTERS = 200_000;
// ~7.5MB of raw image bytes, base64-inflated (~4/3x) -- below Cloud Functions v1's own
// 10MB callable request ceiling, as a defensive backstop.
const MAX_IMAGE_BASE64_CHARACTERS = 10_000_000;
const HOURLY_REQUEST_LIMIT = 60;

/** Server owns the hour boundary -- UTC, matches eligibility.js's currentYearMonth() convention. */
function currentHourKey() {
  const now = new Date();
  return (
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}`
  );
}

/**
 * Atomically checks and increments a per-user hourly call counter. Mirrors
 * eligibility.js's recordAndEnforce transaction shape (same fake-db test
 * pattern applies), scoped to abuse containment rather than subscription
 * quota -- caps cost blast radius from a compromised auth session.
 *
 * Reuses the existing USER_SUBSCRIPTION_SUBCOLLECTION ("subscription") rather
 * than introducing a new generated FirestorePaths entry for this one counter
 * doc -- an `ai_usage_{hourKey}` doc id keeps it distinct from eligibility.js's
 * `usage_{month}` docs in the same subcollection.
 */
async function enforceRateLimit(firestoreDb, userId) {
  const hourKey = currentHourKey();
  const docRef = firestoreDb
    .collection(FirestorePaths.USERS)
    .doc(userId)
    .collection(FirestorePaths.USER_SUBSCRIPTION_SUBCOLLECTION)
    .doc(`ai_usage_${hourKey}`);

  return firestoreDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    const currentCount = snapshot.exists ? snapshot.data().count || 0 : 0;
    if (currentCount >= HOURLY_REQUEST_LIMIT) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Hourly AI request limit reached (${currentCount}/${HOURLY_REQUEST_LIMIT})`
      );
    }
    tx.set(docRef, { count: currentCount + 1, lastUpdated: Date.now() }, { merge: true });
    return currentCount + 1;
  });
}

function validateRequest(data) {
  const { prompt, imageBase64 } = data || {};
  if (!prompt || typeof prompt !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'prompt is required');
  }
  if (prompt.length > MAX_PROMPT_CHARACTERS) {
    throw new functions.https.HttpsError('invalid-argument', 'prompt exceeds maximum allowed length');
  }
  if (imageBase64 !== undefined && imageBase64 !== '') {
    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_IMAGE_BASE64_CHARACTERS) {
      throw new functions.https.HttpsError('invalid-argument', 'imageBase64 exceeds maximum allowed size');
    }
  }
}

// Same DoW-defense shape as aiAnalysis.js's runtimeOptions.
const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60,
  secrets: ['GEMINI_API_KEY']
};

exports.geminiGenerateContent = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  if (!context.app) {
    // App Check isn't wired client-side yet (tracked as a fast-follow) -- log instead of
    // blocking, so this doesn't break every existing AI call site the moment this deploys.
    // Once App Check is enforced client-side, this should become a hard failed-precondition.
    console.warn(`geminiGenerateContent: no App Check token, uid=${context.auth.uid}`);
  }

  validateRequest(data);
  await enforceRateLimit(db, context.auth.uid);

  const { prompt, imageBase64, imageMimeType, temperature, maxOutputTokens } = data;

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : 0.0,
        maxOutputTokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : 8192
      }
    });

    const parts = [];
    if (imageBase64) {
      parts.push({ inlineData: { data: imageBase64, mimeType: imageMimeType || 'image/jpeg' } });
    }
    parts.push({ text: prompt });

    const result = await model.generateContent(parts);
    const text = result.response.text();
    if (!text) {
      throw new functions.https.HttpsError('internal', 'No response text from Gemini');
    }
    return { text };
  } catch (error) {
    console.error('geminiGenerateContent error:', { userId: context.auth.uid, error: error.message });
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.currentHourKey = currentHourKey;
exports.enforceRateLimit = enforceRateLimit;
exports.validateRequest = validateRequest;
exports.HOURLY_REQUEST_LIMIT = HOURLY_REQUEST_LIMIT;
exports.MAX_PROMPT_CHARACTERS = MAX_PROMPT_CHARACTERS;
