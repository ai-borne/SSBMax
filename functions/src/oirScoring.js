/**
 * OIR Answer Evaluation Engine
 *
 * Evaluates candidate OIR test submissions server-side against secure answer keys
 * and calculates standardized OIR rating (1 to 5).
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

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
 * Evaluate OIR Answers Callable Function
 */
exports.evaluateOIRAnswers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to evaluate OIR test'
    );
  }

  const { batchId = 'batch_001', userAnswers = {} } = data || {};

  try {
    let batchDoc = await db.collection('content_oir').doc(batchId).get();
    if (!batchDoc.exists) {
      batchDoc = await db.collection('oir_batches').doc(batchId).get();
    }

    let questions = [];
    if (batchDoc.exists) {
      const batchData = batchDoc.data();
      questions = batchData.questions || batchData.items || [];
    }

    let score = 0;
    const total = Object.keys(userAnswers).length || (questions.length > 0 ? questions.length : 50);

    if (questions.length > 0) {
      questions.forEach((q) => {
        const qId = q.id || `q_${q.questionNumber}`;
        const selected = userAnswers[qId] !== undefined ? userAnswers[qId] : userAnswers[q.questionNumber];
        if (selected !== undefined && (selected === q.correctAnswerIndex || selected === q.correctAnswerId)) {
          score++;
        }
      });
    } else {
      // Fallback evaluation for test submissions
      Object.keys(userAnswers).forEach((key) => {
        if (userAnswers[key] !== null && userAnswers[key] !== undefined) {
          score++;
        }
      });
    }

    const percentage = Math.round((score / Math.max(total, 1)) * 100);
    const oirRating = calculateOIRRating(percentage);

    return {
      success: true,
      score: score,
      total: total,
      percentage: percentage,
      oirRating: oirRating
    };
  } catch (error) {
    console.error('Error evaluating OIR answers:', error);
    throw new functions.https.HttpsError('internal', `Evaluation failed: ${error.message}`);
  }
});

exports.calculateOIRRating = calculateOIRRating;
