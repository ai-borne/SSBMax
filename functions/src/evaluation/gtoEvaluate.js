/**
 * `evaluateGTO` Cloud Function (Phase 8 Ship, Web SSB Test Flow Parity plan).
 *
 * **Scope correction from the plan's original text** (confirmed with the user before
 * implementing, see `gtoPrompts.js`'s class doc): covers GD/GPE/Lecturette only, not
 * all 7 sealed `GTOSubmission` variants -- PGT/HGT/GOR/CT can never reach this function
 * today (dead Firestore read path + no capture UI), so porting their prompts would be
 * untestable dead code. Tracked as separate tech debt, not silently dropped.
 *
 * Bespoke wrapper, not a thin `core.js::runEvaluation` call -- same reason as Phase 7's
 * `interviewEvaluate.js`: GTO's submission shape doesn't fit `runEvaluation`'s
 * assumptions. Specifically, `GitLiveGTOSubmissionRepository.kt`'s own class doc
 * documents (as a *pre-existing, not-fixed-here* quirk) that GTO submissions carry
 * their lifecycle in a **top-level** `status` field using `GTOSubmissionStatus`
 * (PENDING_ANALYSIS/ANALYZING/COMPLETED/FAILED -- same names, different field) rather
 * than every other test type's nested `data.analysisStatus`. Reusing `runEvaluation`
 * as-is would check the wrong field and silently no-op (`skipped`) on every real GTO
 * submission. This file reuses `checkQuota`/`withRetry`/`parseEvaluationResponse`/
 * `finalizeOlqScores`/`ratingFromScore` directly, same primitives `core.js` itself
 * calls, and writes to `gto_results` (not `psych_results`) matching `GTOResultDto`'s
 * shape (`GitLiveGTOSharedDtos.kt`) -- `testType` stored as the domain `GTOTestType`
 * enum name (e.g. `GROUP_DISCUSSION`), not the contract `TestType` id (`GTO_GD`) the
 * submission doc itself uses, matching what `GitLiveGTOSubmissionDelegate.kt`'s own
 * result-write path does.
 *
 * On repeated Gemini failure, marks the submission FAILED rather than the legacy KMP
 * orchestrator's neutral-fallback-score behavior (`GTOAnalysisOrchestrator.kt`'s
 * `fallbackOLQScores`) -- matches every other Phase 4+ `evaluate*` function's contract.
 * Both paths coexist behind the feature flag during the bake period; this behavioral
 * difference is a deliberate, documented divergence for the new path, not a bug.
 *
 * Only `{ submissionId }` accepted from the client -- the function fetches the
 * submission itself (ownership-checked here), so a client can't forge which submission
 * gets evaluated.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { checkQuota } = require('./core');
const { withRetry } = require('./retry');
const { parseEvaluationResponse, finalizeOlqScores, ratingFromScore } = require('./responseParser');
const { validateScores } = require('./validation');
const { buildGDPrompt, buildGPEPrompt, buildLecturettePrompt } = require('./gtoPrompts');
const { generateContent } = require('./geminiClient');
const { FirestorePaths } = require('../generated/contracts.cjs');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Maps the submission doc's top-level `testType` (contract `TestType` id, e.g.
 * `GTO_GD` -- see `GitLiveGTOSubmissionRepository.kt::submitGD`) to this function's
 * prompt builder and the domain `GTOTestType` enum name `gto_results` expects.
 */
const GTO_SUBTYPE_CONFIG = {
  GTO_GD: { buildPrompt: buildGDPrompt, resultTestType: 'GROUP_DISCUSSION' },
  GTO_GPE: { buildPrompt: buildGPEPrompt, resultTestType: 'GROUP_PLANNING_EXERCISE' },
  GTO_LECTURETTE: { buildPrompt: buildLecturettePrompt, resultTestType: 'LECTURETTE' }
};

/**
 * Default GTO validation entry type -- matches `GTOAnalysisOrchestrator.kt`'s hardcoded
 * `EntryType.NDA` (GTO has no per-user profile lookup the way WAT/SRT/SD do). Non-blocking,
 * log-only, same as every other `*Evaluate.js`'s validation call.
 */
const DEFAULT_ENTRY_TYPE = 'NDA';

/**
 * Builds the `gto_results/{submissionId}` document body (everything the caller doesn't
 * already add itself -- submissionId/userId/testType/analyzedAt).
 */
function buildGTOResult(rawResponseText) {
  const parsed = finalizeOlqScores(parseEvaluationResponse(rawResponseText));
  if (!parsed) {
    return null;
  }

  const scoreEntries = Object.entries(parsed.olqScores);
  const overallScore = scoreEntries.reduce((sum, [, s]) => sum + s.score, 0) / scoreEntries.length;

  const scoresByOlq = {};
  for (const [olqId, s] of scoreEntries) scoresByOlq[olqId] = s.score;
  const validation = validateScores(scoresByOlq, DEFAULT_ENTRY_TYPE);
  console.log(`GTO SSB validation: ${validation.recommendation}`);

  return {
    olqScores: parsed.olqScores,
    overallScore,
    overallRating: ratingFromScore(overallScore),
    aiConfidence: Math.round(parsed.overallConfidence)
  };
}

const runtimeOptions = {
  maxInstances: 10,
  timeoutSeconds: 60,
  secrets: ['GEMINI_API_KEY']
};

exports.evaluateGTO = functions.runWith(runtimeOptions).https.onCall(async (data, context) => {
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

  const config = GTO_SUBTYPE_CONFIG[submission.testType];
  if (!config) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `evaluateGTO does not support testType ${submission.testType} (GD/GPE/Lecturette only)`
    );
  }

  if (submission.status !== 'PENDING_ANALYSIS') {
    return { success: true, skipped: true, status: submission.status };
  }

  await checkQuota(db, uid, submission.testType);

  await submissionRef.update({ status: 'ANALYZING' });

  const result = await withRetry({
    call: async () => buildGTOResult(await generateContent(config.buildPrompt(submission))),
    isAcceptable: (r) => r !== null && r !== undefined,
    fillDefaults: (r) => r
  });

  if (!result) {
    await submissionRef.update({ status: 'FAILED' });
    return { success: false, submissionId, status: 'FAILED' };
  }

  await db
    .collection(FirestorePaths.GTO_RESULTS)
    .doc(submissionId)
    .set({
      submissionId,
      userId: submission.userId,
      testType: config.resultTestType,
      ...result,
      analyzedAt: Date.now()
    });
  await submissionRef.update({ status: 'COMPLETED' });

  return { success: true, submissionId, status: 'COMPLETED' };
});

exports.buildGTOResult = buildGTOResult;
exports.GTO_SUBTYPE_CONFIG = GTO_SUBTYPE_CONFIG;
