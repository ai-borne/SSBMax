/**
 * OIR Answer Evaluation Engine
 *
 * Evaluates candidate OIR test submissions server-side against secure answer keys
 * and calculates standardized OIR rating (1 to 5).
 */

const functions = require('firebase-functions');
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
 * Scores answers against a known question set. A question with no matching
 * answer is simply not counted correct -- there is no fallback that credits
 * an unanswered question.
 */
function scoreOIRSubmission(questions, userAnswers) {
  let score = 0;
  questions.forEach((q) => {
    const qId = q.id || `q_${q.questionNumber}`;
    const selected = userAnswers[qId] !== undefined ? userAnswers[qId] : userAnswers[q.questionNumber];
    if (selected !== undefined && (selected === q.correctAnswerIndex || selected === q.correctAnswerId)) {
      score++;
    }
  });
  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  return { score, total, percentage, oirRating: calculateOIRRating(percentage) };
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
 * Evaluate OIR Answers Callable Function
 */
exports.evaluateOIRAnswers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to evaluate OIR test'
    );
  }

  const { batchId, userAnswers = {} } = data || {};
  if (!batchId) {
    throw new functions.https.HttpsError('invalid-argument', 'batchId is required');
  }

  try {
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
exports.scoreOIRSubmission = scoreOIRSubmission;
exports.evaluateOIRSubmission = evaluateOIRSubmission;
exports.fetchOIRBatchQuestions = fetchOIRBatchQuestions;
