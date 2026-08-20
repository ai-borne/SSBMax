/**
 * `evaluatePPDT` Cloud Function (Phase 9 Ship, Web SSB Test Flow Parity plan).
 *
 * Bespoke wrapper, not a thin `core.js::runEvaluation` call -- same reason as Phase 7/8's
 * `interviewEvaluate.js`/`gtoEvaluate.js`: `runEvaluation`'s `buildPrompt` is a
 * synchronous `(submission) => string`, but PPDT needs an *async* image resolution step
 * (a second Firestore read plus an HTTP fetch) before a prompt can even be built. This
 * file reuses `core.js::checkQuota`, `retry.js::withRetry`, and
 * `responseParser.js::{parseEvaluationResponse,finalizeOlqScores}` directly -- the same
 * primitives `core.js` itself calls -- and writes to `ppdt_results` (not `psych_results`)
 * matching `GitLivePersonalTestSubmissionRepository.kt`'s dedicated PPDT results
 * collection (`FirestorePaths.PPDT_RESULTS`), not the shared psych-results one WAT/SRT/SD
 * use. Status guard uses the standard nested `data.analysisStatus` field (PPDT submissions
 * go through `GitLiveSubmissionRepository`, not GTO's top-level-`status` quirk).
 *
 * **SSRF guard (§A of the plan):** the submission doc only ever carries `questionId`/
 * `batchId` (see `PPDTDataDto`, `data-firebase/.../PPDTSubmissionMappers.kt`) -- it has
 * no `imageUrl` field to trust in the first place. `resolveImage` re-derives the image
 * URL server-side by reading `test_content/ppdt/image_batches/{batchId}` (the same
 * Firestore doc `GitLivePPDTImageCacheManager.kt::downloadBatch` reads) and picking the
 * entry whose `id` matches `questionId`. `fetchImageBytes` additionally allowlists the
 * resolved URL's hostname to Firebase/Google Cloud Storage domains before fetching, as
 * defense in depth against a corrupted/malicious content doc.
 *
 * Rating uses PPDT's own `PPDTRating.fromScore` label set (GOOD/AVERAGE/BELOW_AVERAGE/
 * NEEDS_IMPROVEMENT), not `responseParser.js::ratingFromScore`'s generic Exceptional/
 * Good/Average/Needs-Improvement labels WAT/SRT/SD/GTO use -- `PPDTAnalysisOrchestrator.kt`
 * uses the dedicated enum, so this file reproduces that field-for-field rather than
 * "fixing" it to the generic labels, to keep the two paths' output comparable during the
 * bake period.
 *
 * Only `{ submissionId }` accepted from the client -- the function fetches the
 * submission itself (ownership-checked here), so a client can't forge which submission
 * gets evaluated.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { checkQuota } = require('./core');
const { notifyEvaluationComplete } = require('../notifications/sendNotification');
const { withRetry } = require('./retry');
const { parseEvaluationResponse, finalizeOlqScores } = require('./responseParser');
const { validateScores } = require('./validation');
const { generatePPDTMultimodalPrompt } = require('./ppdtPrompts');
const { generateContent } = require('./geminiClient');
const { FirestorePaths, Enums } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const PPDT_TEST_TYPE = 'PPDT';
const DEFAULT_BATCH_ID = 'batch_001';
const DEFAULT_ENTRY_TYPE = 'GRADUATE';
const ALLOWED_IMAGE_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];

const PPDT_RECOMMENDATIONS_PREFIX = [
  'Continue practicing PPDT with diverse scenarios',
  'Maintain clear and positive storytelling'
];

/** Port of `PPDTRating.fromScore` -- PPDT's own label set, distinct from `ratingFromScore`. */
function ppdtRatingFromScore(score) {
  if (score <= 5.5) return 'Good';
  if (score <= 6.5) return 'Average';
  if (score <= 7.5) return 'Below Average';
  return 'Needs Improvement';
}

/**
 * Resolves `{ imageUrl, imageContext }` for `questionId` from the server-controlled
 * `test_content/ppdt/image_batches/{batchId}` doc -- never from anything on the
 * submission doc itself (see class doc's SSRF guard section). Returns `null` if the
 * batch doc or the matching image entry doesn't exist (caller proceeds with an empty
 * image, matching `PPDTAnalysisOrchestrator.kt`'s own graceful-degradation behavior).
 */
async function resolveImage(firestoreDb, questionId, batchId) {
  const doc = await firestoreDb.doc(`${FirestorePaths.TestContent.PPDT_BATCHES}/${batchId || DEFAULT_BATCH_ID}`).get();
  if (!doc.exists) return null;
  const images = doc.data().images || [];
  const match = images.find((img) => img.id === questionId);
  if (!match || !match.imageUrl) return null;
  return { imageUrl: match.imageUrl, imageContext: match.imageContext || {} };
}

/**
 * Fetches image bytes for a server-resolved URL, allowlisting the hostname first
 * (SSRF guard -- see class doc). Returns an empty buffer (not a thrown error) on any
 * failure, matching `PPDTAnalysisOrchestrator.kt::downloadImageBytes`'s "proceed with
 * empty bytes" fallback -- a transient image-fetch failure shouldn't fail the whole
 * evaluation when the story text alone can still be scored.
 */
async function fetchImageBytes(imageUrl) {
  try {
    const host = new URL(imageUrl).hostname;
    if (!ALLOWED_IMAGE_HOSTS.includes(host)) {
      console.warn(`PPDT image URL host not allowlisted, skipping fetch: ${host}`);
      return Buffer.alloc(0);
    }
    const response = await fetch(imageUrl);
    if (!response.ok) return Buffer.alloc(0);
    return Buffer.from(await response.arrayBuffer());
  } catch (e) {
    console.warn(`PPDT image download failed, proceeding with empty bytes: ${e.message}`);
    return Buffer.alloc(0);
  }
}

function olqLabel(olqId, score) {
  const displayName = (Enums.OLQ[olqId] && Enums.OLQ[olqId].displayName) || olqId;
  return `${displayName} (${score})`;
}

/**
 * Builds the `ppdt_results/{submissionId}` document body (everything the caller doesn't
 * already add itself -- submissionId/testType/userId/analyzedAt), matching
 * `OLQAnalysisResultDto`'s shape field-for-field with `PPDTAnalysisOrchestrator.kt`.
 */
function buildPPDTResult(rawResponseText) {
  const parsed = finalizeOlqScores(parseEvaluationResponse(rawResponseText));
  if (!parsed) {
    return null;
  }

  const scoreEntries = Object.entries(parsed.olqScores);
  const overallScore = scoreEntries.reduce((sum, [, s]) => sum + s.score, 0) / scoreEntries.length;
  const sortedAscending = [...scoreEntries].sort((a, b) => a[1].score - b[1].score);
  const strengths = sortedAscending.slice(0, 3).map(([olqId, s]) => olqLabel(olqId, s.score));
  const weaknesses = sortedAscending
    .slice()
    .reverse()
    .slice(0, 3)
    .map(([olqId, s]) => olqLabel(olqId, s.score));

  const scoresByOlq = {};
  for (const [olqId, s] of scoreEntries) scoresByOlq[olqId] = s.score;
  const validation = validateScores(scoresByOlq, DEFAULT_ENTRY_TYPE);
  console.log(`PPDT SSB validation: ${validation.recommendation}`);

  return {
    olqScores: parsed.olqScores,
    overallScore,
    overallRating: ppdtRatingFromScore(overallScore),
    strengths,
    weaknesses,
    recommendations: [
      PPDT_RECOMMENDATIONS_PREFIX[0],
      `Focus on strengthening: ${weaknesses.join(', ')}`,
      PPDT_RECOMMENDATIONS_PREFIX[1]
    ],
    aiConfidence: Math.round(parsed.overallConfidence)
  };
}

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60,
  secrets: ['GEMINI_API_KEY']
};

exports.evaluatePPDT = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const uid = context.auth.uid;
  const { submissionId } = data || {};
  if (!submissionId || typeof submissionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'submissionId is required');
  }

  const db = admin.firestore();
  const submissionRef = db.collection(FirestorePaths.SUBMISSIONS).doc(submissionId);
  const snapshot = await submissionRef.get();
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', `Submission ${submissionId} not found`);
  }
  const submission = snapshot.data();

  if (submission.userId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Permission denied: ownership check failed');
  }

  const submissionData = submission.data || {};
  const currentStatus = submissionData.analysisStatus;
  if (currentStatus !== 'PENDING_ANALYSIS') {
    return { success: true, skipped: true, status: currentStatus };
  }

  await checkQuota(db, uid, PPDT_TEST_TYPE);

  await submissionRef.update({ 'data.analysisStatus': 'ANALYZING' });

  const image = await resolveImage(db, submissionData.questionId, submissionData.batchId);
  const imageBytes = image ? await fetchImageBytes(image.imageUrl) : Buffer.alloc(0);
  const imageContext = image ? image.imageContext : {};
  const story = submissionData.story || '';

  const result = await withRetry({
    call: async () => {
      const prompt = generatePPDTMultimodalPrompt(story, imageContext);
      return buildPPDTResult(
        await generateContent(prompt, imageBytes, undefined, { testType: PPDT_TEST_TYPE, submissionId })
      );
    },
    isAcceptable: (r) => r !== null && r !== undefined,
    fillDefaults: (r) => r
  });

  if (!result) {
    await submissionRef.update({ 'data.analysisStatus': 'FAILED' });
    return { success: false, submissionId, status: 'FAILED' };
  }

  await db
    .collection(FirestorePaths.PPDT_RESULTS)
    .doc(submissionId)
    .set({
      submissionId,
      userId: submission.userId,
      testType: PPDT_TEST_TYPE,
      ...result,
      analyzedAt: Date.now()
    });
  await submissionRef.update({ 'data.analysisStatus': 'COMPLETED' });

  await notifyEvaluationComplete({ firestoreDb: db, userId: submission.userId, testType: PPDT_TEST_TYPE, submissionId });

  return { success: true, submissionId, status: 'COMPLETED' };
});

exports.buildPPDTResult = buildPPDTResult;
exports.ppdtRatingFromScore = ppdtRatingFromScore;
exports.resolveImage = resolveImage;
exports.fetchImageBytes = fetchImageBytes;
exports.ALLOWED_IMAGE_HOSTS = ALLOWED_IMAGE_HOSTS;
