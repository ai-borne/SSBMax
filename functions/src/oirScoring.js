/**
 * OIR Answer Evaluation Engine
 *
 * Evaluates candidate OIR test submissions server-side against secure answer keys
 * and calculates standardized OIR rating (1 to 5).
 */

// Pinned to v1 -- see eligibility.js's identical comment: the handler below uses the v1
// two-arg `(data, context)` onCall signature (`context.auth`), and bare
// `require('firebase-functions')` resolves to the v2 API by default on this project's
// installed firebase-functions@7, which would silently make `context.auth` always
// undefined and this function always reject as unauthenticated.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { FirestorePaths } = require('./generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Calculate standardized OIR rating from percentage
 */
function calculateOIRRating(percentage) {
  if (percentage >= 85) return 1;
  if (percentage >= 70) return 2;
  if (percentage >= 55) return 3;
  if (percentage >= 40) return 4;
  return 5;
}

/**
 * Fetch OIR batch questions from the KMP-authoritative path
 * `test_content/oir/batches/{batchId}`. Returns null if the batch doesn't exist.
 */
async function fetchOIRBatchQuestions(firestoreDb, batchId) {
  const doc = await firestoreDb
    .collection(FirestorePaths.TestContent.OIR_BATCHES)
    .doc(batchId)
    .get();

  if (!doc.exists) {
    return null;
  }
  const data = doc.data();
  return data.questions || data.items || [];
}

/**
 * True if `selected` (a single id, or an array of ids for a multi-select
 * question) matches `question`'s correct answer(s). Multi-select is compared
 * as a set (order-independent, exact match); single-select falls back to the
 * legacy index-or-id equality check.
 */
function isAnswerCorrect(question, selected) {
  if (selected === undefined || selected === null) {
    return false;
  }
  if (Array.isArray(question.correctAnswerIds) && question.correctAnswerIds.length > 0) {
    const selectedArr = Array.isArray(selected) ? selected : [selected];
    const correctSet = new Set(question.correctAnswerIds);
    const selectedSet = new Set(selectedArr);
    return correctSet.size === selectedSet.size && [...correctSet].every((id) => selectedSet.has(id));
  }
  const single = Array.isArray(selected) ? (selected.length === 1 ? selected[0] : undefined) : selected;
  return single === question.correctAnswerIndex || single === question.correctAnswerId;
}

/**
 * Scores answers against a known question set. A question with no matching
 * answer is simply not counted correct -- there is no fallback that credits
 * an unanswered question. `results` carries the per-question verdict so a
 * caller (KMP's server-authoritative scoring, Phase 2) can build its own
 * richer breakdown without ever trusting a client-supplied `isCorrect`.
 */
function scoreOIRSubmission(questions, userAnswers) {
  const results = questions.map((q) => {
    const qId = q.id || `q_${q.questionNumber}`;
    const selected = userAnswers[qId] !== undefined ? userAnswers[qId] : userAnswers[q.questionNumber];
    return { questionId: qId, isCorrect: isAnswerCorrect(q, selected) };
  });
  const score = results.filter((r) => r.isCorrect).length;
  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  return { score, total, percentage, oirRating: calculateOIRRating(percentage), results };
}

/**
 * Evaluates a submission against a required batchId. A missing batch fails
 * loudly (`not-found`) rather than falling back to scoring everything correct.
 */
async function evaluateOIRSubmission(firestoreDb, batchId, userAnswers) {
  const questions = await fetchOIRBatchQuestions(firestoreDb, batchId);
  if (!questions || questions.length === 0) {
    throw new functions.https.HttpsError('not-found', `OIR batch ${batchId} not found`);
  }
  return scoreOIRSubmission(questions, userAnswers);
}

/**
 * Scores only the questions the caller actually asked about (the keys of
 * `answersForBatch`), not every question in the fetched batch doc. Required
 * for KMP (Phase 2, Web SSB Test Flow Parity plan): its OIR sessions draw a
 * shuffled subset of questions from a local cache pool spanning many
 * Firestore batches, so a whole-batch-is-the-test assumption (which the
 * single-batch `scoreOIRSubmission` above correctly makes for web) would
 * silently count every *other* question in that batch as wrong.
 */
/**
 * KMP's `GitLiveOIREvaluationClient` sends each answer wrapped as
 * `{ selectedOptionId, selectedOptionIds }` (`OIRAnswerWire`, `selectedOptionIds` always present,
 * possibly empty), not the bare id/array `isAnswerCorrect` compares against -- unwrap it here, the
 * one place `scoreOIRQuestionSubset` (the KMP-only multi-batch path) reads a raw answer value.
 * Without this every KMP OIR answer compared an object to a string/array and was always wrong.
 */
function unwrapOIRAnswer(raw) {
  if (raw && typeof raw === 'object' && ('selectedOptionId' in raw || 'selectedOptionIds' in raw)) {
    return Array.isArray(raw.selectedOptionIds) && raw.selectedOptionIds.length > 0
      ? raw.selectedOptionIds
      : raw.selectedOptionId;
  }
  return raw;
}

function scoreOIRQuestionSubset(questions, answersForBatch) {
  const byId = new Map(questions.map((q) => [q.id || `q_${q.questionNumber}`, q]));
  const results = Object.keys(answersForBatch).map((qId) => {
    const q = byId.get(qId);
    if (!q) {
      throw new functions.https.HttpsError('invalid-argument', `Unknown OIR question id '${qId}' for its batch`);
    }
    return { questionId: qId, isCorrect: isAnswerCorrect(q, unwrapOIRAnswer(answersForBatch[qId])) };
  });
  return { score: results.filter((r) => r.isCorrect).length, total: results.length, results };
}

/**
 * Multi-batch evaluation for KMP sessions: `batches` maps each source
 * `batchId` to the subset of that batch's questions actually presented in
 * this session (`{ questionId: selectedAnswer }`). Fetches and scores each
 * batch independently, then aggregates -- one round trip regardless of how
 * many batches the session's questions were drawn from.
 */
async function evaluateOIRMultiBatch(firestoreDb, batches) {
  const batchIds = Object.keys(batches || {});
  if (batchIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'batches must contain at least one batchId');
  }

  let score = 0;
  let total = 0;
  const results = [];
  for (const batchId of batchIds) {
    const questions = await fetchOIRBatchQuestions(firestoreDb, batchId);
    if (!questions || questions.length === 0) {
      throw new functions.https.HttpsError('not-found', `OIR batch ${batchId} not found`);
    }
    const batchResult = scoreOIRQuestionSubset(questions, batches[batchId] || {});
    score += batchResult.score;
    total += batchResult.total;
    results.push(...batchResult.results);
  }

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  return { score, total, percentage, oirRating: calculateOIRRating(percentage), results };
}

/**
 * Evaluate OIR Answers Callable Function
 */
exports.evaluateOIRAnswers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to evaluate OIR test'
    );
  }

  const { batchId, userAnswers = {}, batches } = data || {};

  try {
    // Phase 2 (Web SSB Test Flow Parity plan): KMP's session questions can span
    // multiple Firestore batches, so it submits `batches` instead of a single
    // `batchId`. Web keeps using the original single-batch shape.
    if (batches && typeof batches === 'object' && Object.keys(batches).length > 0) {
      const result = await evaluateOIRMultiBatch(db, batches);
      return { success: true, ...result };
    }
    if (!batchId) {
      throw new functions.https.HttpsError('invalid-argument', 'batchId is required');
    }
    const result = await evaluateOIRSubmission(db, batchId, userAnswers);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('Error evaluating OIR answers:', error);
    throw new functions.https.HttpsError('internal', `Evaluation failed: ${error.message}`);
  }
});

exports.calculateOIRRating = calculateOIRRating;
exports.isAnswerCorrect = isAnswerCorrect;
exports.scoreOIRSubmission = scoreOIRSubmission;
exports.scoreOIRQuestionSubset = scoreOIRQuestionSubset;
exports.unwrapOIRAnswer = unwrapOIRAnswer;
exports.evaluateOIRSubmission = evaluateOIRSubmission;
exports.evaluateOIRMultiBatch = evaluateOIRMultiBatch;
exports.fetchOIRBatchQuestions = fetchOIRBatchQuestions;
