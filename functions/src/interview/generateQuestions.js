/**
 * Server-side port of `shared/.../data/repository/InterviewQuestionGenerator.kt`'s 3-tier
 * strategy: (1) cache-first (`question_cache`/`generic_questions`, 70/25 PIQ/generic split),
 * (2) Gemini-generated from PIQ context for whatever's still missing, (3) static fallback
 * (`./olqData.js::FALLBACK_QUESTIONS`) if Gemini also comes up short.
 *
 * Firestore reads/writes for tiers 1-2 are injectable (`deps.getCachedPIQQuestionsFn` etc.)
 * so `createInterviewSession.test.js` can exercise the full 3-tier fallthrough without a real
 * Firestore query engine -- same injectable-dependency shape as `interviewEvaluate.js`'s
 * `generateContentFn`/`retryDelayFn`.
 */

const crypto = require('crypto');
const { generateContent } = require('../evaluation/geminiClient');
const { FALLBACK_QUESTIONS, OLQ_NAMES } = require('./olqData');
const { FirestorePaths } = require('../generated/contracts.cjs');

const PIQ_QUESTION_RATIO = 0.7;
const GENERIC_QUESTION_RATIO = 0.25;
const MEDIUM_DIFFICULTY = 3;
const CACHE_EXPIRATION_DAYS = 30;

function newId() {
  return crypto.randomUUID();
}

async function getCachedPIQQuestions(db, piqSnapshotId, limit) {
  if (limit <= 0) return [];
  const now = Date.now();
  const snap = await db
    .collection(FirestorePaths.QUESTION_CACHE)
    .where('cacheKey', '==', piqSnapshotId)
    .where('cacheType', '==', 'PIQ_BASED')
    .where('expiresAt', '>', now)
    .orderBy('expiresAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data().question);
}

async function getGenericQuestions(db, limit) {
  if (limit <= 0) return [];
  const snap = await db.collection(FirestorePaths.GENERIC_QUESTIONS).where('difficulty', '==', MEDIUM_DIFFICULTY).orderBy('usageCount', 'asc').limit(limit).get();
  return snap.docs.map((d) => d.data());
}

async function cachePIQQuestions(db, piqSnapshotId, questions) {
  if (questions.length === 0) return;
  const expiresAt = Date.now() + CACHE_EXPIRATION_DAYS * 86400000;
  await Promise.all(
    questions.map((q) =>
      db
        .collection(FirestorePaths.QUESTION_CACHE)
        .doc(newId())
        .set({ question: q, cacheKey: piqSnapshotId, cacheType: 'PIQ_BASED', createdAt: Date.now(), usageCount: 0, lastUsedAt: null, expiresAt })
    )
  );
}

function buildQuestionGenerationPrompt(piqContext, count) {
  return `You are a senior SSB (Services Selection Board) psychologist with 20+ years of interview experience.

PIQ CONTEXT:
${piqContext}

Generate exactly ${count} personalized interview questions targeting the candidate's Officer Like Qualities (OLQs). Each question must:
- Reference specific details from the PIQ context above (not generic)
- Target 2-3 OLQs each
- Not be answerable with yes/no or a single sentence
- Avoid clichés like "Tell me about yourself"

Respond ONLY with a JSON array, no markdown, each item shaped exactly as:
{"questionText": string, "targetOLQs": [OLQ_ENUM_NAME, ...]}

Valid OLQ_ENUM_NAME values: ${Array.from(OLQ_NAMES).join(', ')}`;
}

async function generateAIQuestions(piqContext, count, generateContentFn) {
  if (!piqContext || count <= 0) return [];
  try {
    const raw = await generateContentFn(buildQuestionGenerationPrompt(piqContext, count));
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q) => q && typeof q.questionText === 'string' && Array.isArray(q.targetOLQs))
      .map((q) => ({
        id: newId(),
        questionText: q.questionText,
        targetOLQs: q.targetOLQs.filter((olq) => OLQ_NAMES.has(olq)),
        context: null,
        source: 'AI_GENERATED'
      }));
  } catch (e) {
    return [];
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param db Firestore (Admin SDK or test fake)
 * @param piqSnapshotId submission id the candidate's PIQ questions are keyed on
 * @param count total questions wanted
 * @param piqContext pre-built PIQ text context for the Gemini prompt (server-side
 *   equivalent of `PIQContextBuilder.buildComprehensivePIQContext` -- caller resolves
 *   this from the PIQ submission before calling in, mirroring
 *   `InterviewQuestionGenerator.generateAIQuestions`)
 */
async function generateQuestions(db, piqSnapshotId, count, piqContext, deps = {}) {
  const {
    generateContentFn = generateContent,
    getCachedPIQQuestionsFn = getCachedPIQQuestions,
    getGenericQuestionsFn = getGenericQuestions,
    cachePIQQuestionsFn = cachePIQQuestions
  } = deps;

  const piqCount = Math.trunc(count * PIQ_QUESTION_RATIO);
  const genericCount = Math.trunc(count * GENERIC_QUESTION_RATIO);

  const [piqQuestions, genericQuestions] = await Promise.all([getCachedPIQQuestionsFn(db, piqSnapshotId, piqCount), getGenericQuestionsFn(db, genericCount)]);

  let all = [...piqQuestions, ...genericQuestions];

  if (all.length < count) {
    const missing = count - all.length;
    const aiQuestions = await generateAIQuestions(piqContext, missing, generateContentFn);
    if (aiQuestions.length > 0) {
      await cachePIQQuestionsFn(db, piqSnapshotId, aiQuestions);
    }
    all = all.concat(aiQuestions);
  }

  if (all.length < count) {
    const stillMissing = count - all.length;
    all = all.concat(FALLBACK_QUESTIONS.slice(0, stillMissing).map((q) => ({ ...q, id: newId() })));
  }

  return shuffle(all).slice(0, count);
}

module.exports = {
  generateQuestions,
  generateAIQuestions,
  buildQuestionGenerationPrompt,
  getCachedPIQQuestions,
  getGenericQuestions,
  cachePIQQuestions
};
