/**
 * `evaluateTAT` Cloud Function (Phase 10 Ship, Web SSB Test Flow Parity plan) --
 * highest-risk, last-migrated evaluation type per the plan's risk ordering.
 *
 * Bespoke wrapper, not a thin `core.js::runEvaluation` call -- same reason as
 * `ppdtEvaluate.js`/`gtoEvaluate.js`: TAT needs per-story async image resolution plus a
 * two-stage (per-story -> synthesis) Gemini pipeline that `runEvaluation`'s single
 * `buildPrompt`/`parseAndValidate` pair can't express. Reuses `core.js::checkQuota`,
 * `retry.js::withRetry`, and `responseParser.js::{parseEvaluationResponse,
 * finalizeOlqScores,ratingFromScore}` directly -- the same primitives `core.js` itself
 * calls -- and writes to `psych_results` (TAT/WAT/SRT/SD's shared results collection,
 * matching `GitLivePsychTestSubmissionRepository.kt::finalizeTATAnalysisResult`).
 *
 * **Parallelization (§A of the plan):** `TATAnalysisOrchestrator.kt`'s 12 per-story
 * calls are independent of each other; porting them as a sequential loop (as KMP does
 * today) risks ~40 Gemini calls (12 stories + 1 synthesis, x up to 3 retries each) in
 * one invocation. `concurrency.js::mapWithConcurrency` (extracted to its own file to
 * keep this one under the repo's 300-LOC limit) runs the per-story calls with a
 * concurrency cap (`STORY_CONCURRENCY = 5`, within the plan's 4-6 target to stay under
 * Gemini per-project QPS) instead of Promise.all-ing all 12 at once uncapped; synthesis
 * then runs once after every story settles. Same output shape as the sequential KMP
 * version, meaningfully better latency and cost. `timeoutSeconds: 540, memory: '512MB'`
 * (safety margin for the worst case), unlike every other `evaluate*` function's
 * 60s/256MB default.
 *
 * **SSRF guard (§A of the plan):** TAT is explicitly named alongside PPDT/GTO -- the
 * submission doc's `data.questions[].imageUrl` is client-written at submission time (the
 * KMP orchestrator itself trusts it, a pre-existing, not-fixed-here client-side quirk),
 * so it must never be trusted server-side. `resolveImageBatch` re-derives every story's
 * image URL/context/genderTag from the server-controlled
 * `test_content/tat/image_batches/{batchId}` doc (the same doc
 * `GitLiveTATImageCacheManager.kt::downloadBatch` reads), keyed by `questionId`, in one
 * batch fetch (not one read per story). `fetchImageBytes` additionally allowlists the
 * resolved URL's hostname to Firebase/Google Cloud Storage domains before fetching.
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
const { parseEvaluationResponse, finalizeOlqScores, ratingFromScore } = require('./responseParser');
const { validateScores } = require('./validation');
const { generateTATStoryMultimodalPrompt, buildTATSynthesisPrompt } = require('./tatPrompts');
const { generateContent } = require('./geminiClient');
const { mapWithConcurrency } = require('./concurrency');
const { FirestorePaths, Enums } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

const TAT_TEST_TYPE = 'TAT';
const DEFAULT_BATCH_ID = 'batch_001';
const DEFAULT_ENTRY_TYPE = 'GRADUATE';
const DEFAULT_CANDIDATE_GENDER = 'Unknown';
const MIN_STORY_THRESHOLD = 6;
const STORY_CONCURRENCY = 5;
const ALLOWED_IMAGE_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];

/**
 * Resolves `{ imageUrl, imageContext, genderTag }` for every question in
 * `test_content/tat/image_batches/{batchId}`, keyed by `id` -- never from the
 * submission doc itself (see class doc's SSRF guard section). One Firestore read
 * covers every story in the submission. Returns an empty map if the batch doc doesn't
 * exist (callers proceed with empty images, matching `PPDTAnalysisOrchestrator.kt`-style
 * graceful degradation).
 */
async function resolveImageBatch(firestoreDb, batchId) {
  const doc = await firestoreDb.doc(`${FirestorePaths.TestContent.TAT_BATCHES}/${batchId || DEFAULT_BATCH_ID}`).get();
  const map = new Map();
  if (!doc.exists) return map;
  const images = doc.data().images || [];
  for (const img of images) {
    if (!img.id || !img.imageUrl) continue;
    map.set(img.id, {
      imageUrl: img.imageUrl,
      imageContext: img.imageContext || {},
      genderTag: img.genderTag || 'MIXED'
    });
  }
  return map;
}

/**
 * Fetches image bytes for a server-resolved URL, allowlisting the hostname first
 * (SSRF guard -- see class doc). Returns an empty buffer (not a thrown error) on any
 * failure -- a transient image-fetch failure shouldn't fail one story's assessment
 * when the story text alone can still be scored.
 */
async function fetchImageBytes(imageUrl) {
  try {
    const host = new URL(imageUrl).hostname;
    if (!ALLOWED_IMAGE_HOSTS.includes(host)) {
      console.warn(`TAT image URL host not allowlisted, skipping fetch: ${host}`);
      return Buffer.alloc(0);
    }
    const response = await fetch(imageUrl);
    if (!response.ok) return Buffer.alloc(0);
    return Buffer.from(await response.arrayBuffer());
  } catch (e) {
    console.warn(`TAT image download failed, proceeding with empty bytes: ${e.message}`);
    return Buffer.alloc(0);
  }
}

/**
 * Analyzes one story: resolves its image from `imageMap`, calls Gemini (3x retry), and
 * returns a per-story assessment object, or `null` if every retry attempt failed
 * (caller filters `null`s out and compares the survivor count against
 * `MIN_STORY_THRESHOLD`, matching `TATAnalysisOrchestrator.kt::analyzeStory`'s
 * "skip failed stories, keep going" behavior).
 */
async function analyzeStory(story, storyIndex, totalStories, imageMap, submissionId) {
  const image = imageMap.get(story.questionId);
  const imageBytes = image ? await fetchImageBytes(image.imageUrl) : Buffer.alloc(0);
  const imageContext = image ? image.imageContext : {};
  const imageGenderTag = image ? image.genderTag : 'MIXED';
  const storyText = story.story || '';

  const scoreResult = await withRetry({
    call: async () => {
      const prompt = generateTATStoryMultimodalPrompt(
        storyText,
        imageContext,
        DEFAULT_CANDIDATE_GENDER,
        storyIndex,
        totalStories,
        storyText.length,
        imageGenderTag
      );
      return finalizeOlqScores(
        parseEvaluationResponse(
          await generateContent(prompt, imageBytes, undefined, {
            testType: TAT_TEST_TYPE,
            submissionId,
            callTag: `story_${storyIndex}`
          })
        )
      );
    },
    isAcceptable: (r) => r !== null && r !== undefined,
    fillDefaults: (r) => r
  });

  if (!scoreResult) return null;

  const scoreEntries = Object.entries(scoreResult.olqScores);
  const overallScore = scoreEntries.reduce((sum, [, s]) => sum + s.score, 0) / scoreEntries.length;

  return {
    questionId: story.questionId,
    storyIndex,
    story: storyText,
    olqScores: scoreResult.olqScores,
    overallScore,
    overallRating: ratingFromScore(overallScore),
    aiConfidence: scoreEntries[0] ? scoreEntries[0][1].confidence : 50
  };
}

function olqLabel(olqId, score) {
  const displayName = (Enums.OLQ[olqId] && Enums.OLQ[olqId].displayName) || olqId;
  return `${displayName} (${score})`;
}

/**
 * Builds the `psych_results/{submissionId}` document body from the synthesis call's raw
 * response plus the per-story assessments (for `validStoriesCount`/`failedStoriesCount`),
 * matching `TATAnalysisOrchestrator.kt`'s `OLQAnalysisResult` construction field-for-field.
 */
function buildTATResult(rawSynthesisText, assessments, failedCount) {
  const parsed = finalizeOlqScores(parseEvaluationResponse(rawSynthesisText));
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
  console.log(`TAT SSB validation: ${validation.recommendation}`);

  return {
    olqScores: parsed.olqScores,
    overallScore,
    overallRating: ratingFromScore(overallScore),
    strengths,
    weaknesses,
    recommendations: [
      'Review your narrative arcs across all stories',
      `Focus on strengthening: ${weaknesses.join(', ')}`,
      'Maintain proactive and optimistic storytelling'
    ],
    aiConfidence: Math.round(parsed.overallConfidence),
    validStoriesCount: assessments.length,
    failedStoriesCount: failedCount,
    usedPartialAssessment: failedCount > 0
  };
}

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 540,
  memory: '512MB',
  secrets: ['GEMINI_API_KEY']
};

exports.evaluateTAT = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
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

  const stories = submissionData.stories || [];
  if (stories.length === 0) {
    return { success: true, skipped: true, status: currentStatus };
  }

  await checkQuota(db, uid, TAT_TEST_TYPE);

  await submissionRef.update({ 'data.analysisStatus': 'ANALYZING' });

  const imageMap = await resolveImageBatch(db, submissionData.batchId);

  const assessments = (
    await mapWithConcurrency(stories, STORY_CONCURRENCY, (story, index) =>
      analyzeStory(story, index, stories.length, imageMap, submissionId)
    )
  ).filter((a) => a !== null && a !== undefined);

  if (assessments.length < MIN_STORY_THRESHOLD) {
    await submissionRef.update({ 'data.analysisStatus': 'FAILED' });
    return { success: false, submissionId, status: 'FAILED' };
  }

  const failedCount = stories.length - assessments.length;
  const result = await withRetry({
    call: async () =>
      buildTATResult(
        await generateContent(buildTATSynthesisPrompt(assessments), undefined, undefined, {
          testType: TAT_TEST_TYPE,
          submissionId,
          callTag: 'synthesis'
        }),
        assessments,
        failedCount
      ),
    isAcceptable: (r) => r !== null && r !== undefined,
    fillDefaults: (r) => r
  });

  if (!result) {
    await submissionRef.update({ 'data.analysisStatus': 'FAILED' });
    return { success: false, submissionId, status: 'FAILED' };
  }

  await db
    .collection(FirestorePaths.PSYCH_RESULTS)
    .doc(submissionId)
    .set({
      submissionId,
      userId: submission.userId,
      testType: TAT_TEST_TYPE,
      ...result,
      analyzedAt: Date.now()
    });
  await submissionRef.update({ 'data.analysisStatus': 'COMPLETED' });

  await notifyEvaluationComplete({ firestoreDb: db, userId: submission.userId, testType: TAT_TEST_TYPE, submissionId });

  return { success: true, submissionId, status: 'COMPLETED' };
});

exports.buildTATResult = buildTATResult;
exports.analyzeStory = analyzeStory;
exports.resolveImageBatch = resolveImageBatch;
exports.fetchImageBytes = fetchImageBytes;
exports.ALLOWED_IMAGE_HOSTS = ALLOWED_IMAGE_HOSTS;
exports.MIN_STORY_THRESHOLD = MIN_STORY_THRESHOLD;
exports.STORY_CONCURRENCY = STORY_CONCURRENCY;
