/**
 * Gemini AI Analysis Handlers
 *
 * Implements secure interview response analysis and personalized question generation.
 * Defends against prompt injection via XML escaping and boundary tags.
 * Limits maxInstances: 10 to defend against Denial-of-Wallet (DoW).
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OLQ_DEFINITIONS, PIQ_TO_OLQ_MAPPING } = require('./olqDefinitions');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Escapes XML entities to prevent prompt injection attacks
 */
function escapeXml(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured.');
  }
  return new GoogleGenerativeAI(apiKey);
};

function buildAnalysisPrompt(question, rawResponse, expectedOLQs, responseMode) {
  const safeResponse = escapeXml(rawResponse);
  const olqList = expectedOLQs.join(', ') || 'all 15 Officer-Like Qualities';

  return `
You are an SSB PSYCHOLOGIST analyzing a candidate's interview response.

QUESTION ASKED: ${question}
TARGET OLQs: ${olqList}
RESPONSE MODE: ${responseMode}

CANDIDATE RESPONSE (Enclosed in XML boundary tags for security):
<candidate_response>
${safeResponse}
</candidate_response>

OLQ DEFINITIONS:
${OLQ_DEFINITIONS}

SCORING SCALE (SSB Convention - LOWER IS BETTER):
1-2 = Exceptional | 3 = Excellent | 4 = Very Good | 5 = Good | 6 = Average | 7 = Below Average | 8-10 = Poor

OUTPUT FORMAT (Return ONLY valid JSON):
{
  "olqScores": [
    { "olq": "OLQ_NAME", "score": 5.5, "reasoning": "Reasoning text", "evidence": ["Quote"] }
  ],
  "overallConfidence": 75,
  "keyInsights": ["Insight text"],
  "suggestedFollowUp": "Follow-up question"
}
`.trim();
}

function parseAnalysisResponse(responseText) {
  const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleanJson);
  if (!parsed.olqScores || !Array.isArray(parsed.olqScores)) {
    throw new Error('Invalid response structure from Gemini');
  }
  return parsed;
}

// Function options for DoW protection
const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60
};

exports.analyzeInterviewResponse = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const { responseId, sessionId } = data;
  if (!responseId || !sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'responseId and sessionId are required');
  }

  const responseRef = db.collection('interview_responses').doc(responseId);

  try {
    const responseDoc = await responseRef.get();
    if (!responseDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Response ${responseId} not found`);
    }

    const sessionDoc = await db.collection('interview_sessions').doc(sessionId).get();
    if (!sessionDoc.exists || sessionDoc.data().userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Permission denied');
    }

    const responseData = responseDoc.data();

    // Transactional lock
    await responseRef.update({
      isEvaluating: true,
      evaluationStartedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = buildAnalysisPrompt(
      responseData.questionText || 'Question',
      responseData.responseText || '',
      responseData.expectedOLQs || [],
      responseData.responseMode || 'text'
    );

    const result = await model.generateContent(prompt);
    const analysis = parseAnalysisResponse(result.response.text());

    await responseRef.update({
      isEvaluating: false,
      olqScores: analysis.olqScores,
      overallConfidence: analysis.overallConfidence,
      keyInsights: analysis.keyInsights,
      suggestedFollowUp: analysis.suggestedFollowUp || null,
      analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
      analyzedBy: 'gemini-2.5-flash'
    });

    return { success: true, responseId, analysis };
  } catch (error) {
    console.error('Error analyzing response:', error);
    await responseRef.update({ isEvaluating: false }).catch(() => {});
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.analyzeResponseInline = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { questionText, responseText, expectedOLQs, responseMode } = data;
  if (!questionText || !responseText) {
    throw new functions.https.HttpsError('invalid-argument', 'questionText and responseText required');
  }

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = buildAnalysisPrompt(questionText, responseText, expectedOLQs || [], responseMode || 'text');
    const result = await model.generateContent(prompt);
    const analysis = parseAnalysisResponse(result.response.text());
    return { success: true, analysis };
  } catch (error) {
    console.error('Error analyzing inline response:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.escapeXml = escapeXml;
