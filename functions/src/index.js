/**
 * Firebase Cloud Functions Entry Dispatcher for SSBMax
 *
 * Modular architecture strictly enforcing single responsibility and < 300 LOC per file.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SSOT
if (!admin.apps.length) {
  admin.initializeApp();
}

const { handleRazorpayWebhook } = require('./webhooks');
const { handleRevenueCatWebhook } = require('./revenueCatWebhook');
const { createRazorpayOrder } = require('./payments');
const { createRazorpaySubscription } = require('./razorpaySubscriptions');
const { cancelRazorpaySubscription } = require('./razorpaySubscriptionCancel');
const { evaluateOIRAnswers } = require('./oirScoring');
const { onOirSubmissionCreated } = require('./notifications/onOirSubmissionCreated');
const { notifyGradingComplete } = require('./notifications/notifyGradingComplete');
const { scheduledDailyPracticeReminders } = require('./notifications/scheduledDailyPracticeReminders');
const { analyzeInterviewResponse, analyzeResponseInline } = require('./aiAnalysis');
const { recordTestUsage } = require('./eligibility');
const { geminiGenerateContent } = require('./geminiProxy');
const { evaluateWAT } = require('./evaluation/watEvaluate');
const { evaluateSRT } = require('./evaluation/srtEvaluate');
const { evaluateSD } = require('./evaluation/sdEvaluate');
const { evaluateInterviewResponse } = require('./evaluation/interviewEvaluate');
const { createInterviewSession } = require('./interview/createInterviewSession');
const { completeInterviewSession } = require('./interview/completeInterviewSession');
const { archiveOldSubmissions } = require('./archival/archiveOldSubmissions');
const { scheduledFirestoreBackup } = require('./archival/scheduledFirestoreBackup');
const { scheduledSubscriptionReconciliation } = require('./subscriptions/scheduledSubscriptionReconciliation');
const { scheduledRazorpayDriftSweep } = require('./subscriptions/scheduledRazorpayDriftSweep');
const { repairMobileEntitlement } = require('./subscriptions/repairMobileEntitlement');
const { getSubscriptionSupportSnapshot } = require('./subscriptions/getSubscriptionSupportSnapshot');
const { recordSignup } = require('./analytics/recordSignup');
const { getAnalyticsSummary } = require('./analytics/getAnalyticsSummary');
const { evaluateGTO } = require('./evaluation/gtoEvaluate');
const { evaluatePPDT } = require('./evaluation/ppdtEvaluate');
const { evaluateTAT } = require('./evaluation/tatEvaluate');
const { requestAccountDeletion } = require('./account/requestAccountDeletion');
const { cancelAccountDeletion } = require('./account/cancelAccountDeletion');
const { purgeExpiredAccounts } = require('./account/purgeExpiredAccounts');
const {
  submitPIQTest,
  submitPPDTTest,
  submitTATTest,
  submitWATTest,
  submitSRTTest,
  submitSDTest,
  submitGTOTest,
  submitOIRTest,
  submitInterviewResponse
} = require('./submissions');

exports.handleRazorpayWebhook = handleRazorpayWebhook;
exports.handleRevenueCatWebhook = handleRevenueCatWebhook;
exports.createRazorpayOrder = createRazorpayOrder;
// Phase B (Dual-Platform Subscription Billing Hardening plan): real Razorpay Subscription
// (not a one-time Order) so `webhooks.js` can derive `expiryDate`/`willRenew` from lifecycle
// webhooks the same way RevenueCat does for mobile. Deployed alongside `createRazorpayOrder`
// (deprecated-but-live) -- web's checkout cutover is feature-flag gated, not atomic with this
// function's deploy.
exports.createRazorpaySubscription = createRazorpaySubscription;
// Phase 5 (H5a, Payment Ecosystem Hardening plan): server-side half of Razorpay cancellation --
// calls Razorpay's cancel API for the caller's own subscription; the existing
// `subscription.cancelled` webhook flips `willRenew: false` once Razorpay confirms it.
exports.cancelRazorpaySubscription = cancelRazorpaySubscription;
exports.evaluateOIRAnswers = evaluateOIRAnswers;
// Fires notifyEvaluationComplete for OIR specifically -- evaluateOIRAnswers above has no
// submissionId to notify against (it runs before the submission doc exists, see
// SubmitOIRTestUseCase.kt); every other test type's equivalent fires from
// evaluation/core.js::runEvaluation instead, once its (later) grading completes.
exports.onOirSubmissionCreated = onOirSubmissionCreated;
// Client-invoked equivalent for legacy client-side-graded paths that never call core.js/
// onOirSubmissionCreated -- currently only TATSynthesisWorker.kt (Android's TAT WorkManager
// chain, kept deliberately separate from the flag-gated shared orchestrator for process-death
// resilience -- see app/CLAUDE.md).
exports.notifyGradingComplete = notifyGradingComplete;
// Notification & Intelligence Sync plan (Phase 3): daily 09:00 cron sending a TEST_REMINDER
// notification + push to every user with notificationPreferences.enableTestReminders == true.
// enableTestReminders/NotificationType.TEST_REMINDER already existed on both KMP platforms with
// no server-side sender -- this is that missing sender, shared with web via the same
// notificationPreferences doc and writeAndPush helper notifyGradingComplete above uses.
exports.scheduledDailyPracticeReminders = scheduledDailyPracticeReminders;
exports.analyzeInterviewResponse = analyzeInterviewResponse;
exports.analyzeResponseInline = analyzeResponseInline;
exports.recordTestUsage = recordTestUsage;
exports.geminiGenerateContent = geminiGenerateContent;
// Phase 4 Ship (Web SSB Test Flow Parity plan): behind KMP's `wat_server_evaluation`
// feature flag, default off -- see WATAnalysisOrchestrator.
exports.evaluateWAT = evaluateWAT;
// Phase 5 Ship (Web SSB Test Flow Parity plan): behind KMP's `srt_server_evaluation`
// feature flag, default off -- see SRTAnalysisOrchestrator.
exports.evaluateSRT = evaluateSRT;
// Phase 6 Ship (Web SSB Test Flow Parity plan): behind KMP's `sd_server_evaluation`
// feature flag, default off -- see SDAnalysisOrchestrator.
exports.evaluateSD = evaluateSD;
// Phase 7 Ship (Web SSB Test Flow Parity plan): behind KMP's `interview_server_evaluation`
// feature flag, default off -- see InterviewAnalysisOrchestrator. Per-response, not
// per-submission -- generalizes the legacy `analyzeInterviewResponse` above rather than
// replacing it (legacy stays live during the canary/bake period).
exports.evaluateInterviewResponse = evaluateInterviewResponse;
// Interview session/result server-migration plan: `interview_sessions`/`interview_questions`/
// `interview_results` are server-only in firestore.rules (`allow write: if false`) --
// GitLiveInterviewRepository's client-side createSession()/completeInterview() always hit
// PERMISSION_DENIED writing them directly. These two callables are the real write path now;
// KMP calls them via EvaluationFunctionsClient instead.
exports.createInterviewSession = createInterviewSession;
exports.completeInterviewSession = completeInterviewSession;
// Submission archival server-migration: `archived_submissions` is server-only in
// firestore.rules -- Android's ArchivalWorker used to write to it directly and always hit
// PERMISSION_DENIED (no data loss -- the delete-original step never ran either). This scheduled
// function replaces that client-side WorkManager/BGTaskScheduler job entirely on both platforms.
exports.archiveOldSubmissions = archiveOldSubmissions;
// Phase 5 (cost & scale guardrails): daily full-database export to GCS -- there was no
// Firestore backup of any kind before this. Requires FIRESTORE_BACKUP_BUCKET + IAM setup,
// see scheduledFirestoreBackup.js's doc comment.
exports.scheduledFirestoreBackup = scheduledFirestoreBackup;
// Phase F (Dual-Platform Subscription Billing Hardening plan): reconciliation safety-net cron --
// Phase 0's read-side expiryDate derivation is the primary defense against a missed webhook,
// this is the cleanup/monitoring backstop that corrects the stored `tier` field itself. Requires
// the new `data` collectionGroup composite index (firestore.indexes.json) to be deployed before
// its first real run -- see that function's doc comment.
exports.scheduledSubscriptionReconciliation = scheduledSubscriptionReconciliation;
// Phase 7 (Payment Ecosystem Hardening plan): the upward counterpart -- reconciliation only ever
// downgrades; this daily sweep enumerates Razorpay's `status=active` subscriptions and repairs any
// Firestore doc stranded behind what Razorpay actually confirms (a missed grant/renewal webhook).
exports.scheduledRazorpayDriftSweep = scheduledRazorpayDriftSweep;
// Phase 7: RevenueCat has no cheap bulk "all active subscribers" endpoint, so this is the
// client-triggered counterpart to the sweep above -- the device detects local drift, this callable
// re-verifies against RevenueCat's REST API server-side before writing anything (never trusts the
// client's claim -- see this function's doc comment for the C1-regression guard it enforces).
exports.repairMobileEntitlement = repairMobileEntitlement;
// Phase 9: the one support-view lookup -- joins the Firestore subscription doc, the Razorpay
// subscription (if any), the RevenueCat subscriber state, and recent `ops_alerts` for one user.
// Admin-only (`admin: true` custom claim, checked inside the callable); read-only, no write path.
exports.getSubscriptionSupportSnapshot = getSubscriptionSupportSnapshot;
// Phase 8 Ship (Web SSB Test Flow Parity plan): behind KMP's `gto_server_evaluation`
// feature flag, default off -- see GTOAnalysisOrchestrator. GD/GPE/Lecturette only
// (scope correction, confirmed with the user -- see gtoPrompts.js's class doc for why
// PGT/HGT/GOR/CT/IO are out of reach today regardless of the flag).
exports.evaluateGTO = evaluateGTO;
// Phase 9 Ship (Web SSB Test Flow Parity plan): behind KMP's `ppdt_server_evaluation`
// feature flag, default off -- see PPDTAnalysisOrchestrator. First image-based (multimodal)
// evaluate* function; parity harness (synthetic fixtures) required before flag exceeds 5%
// per the plan's Verification section, since PPDT is production-verified today.
exports.evaluatePPDT = evaluatePPDT;
// Phase 10 Ship (Web SSB Test Flow Parity plan): behind KMP's `tat_server_evaluation`
// feature flag, default off -- see TATAnalysisOrchestrator. Highest-risk, last-migrated
// type per the plan's risk ordering -- 12-story-parallel + synthesis two-stage pipeline;
// parity harness (synthetic fixtures) required before flag exceeds 5% per the plan's
// Verification section, since TAT is production-verified today.
exports.evaluateTAT = evaluateTAT;

// Phase 11a Ship (Web SSB Test Flow Parity plan): submission-creation callables so web
// can create `submissions/{id}` docs (writes-via-Cloud-Function-only per web/CLAUDE.md)
// -- the gap that made every web `evaluate*` call above unreachable until now, since
// nothing on web created the submission doc those functions read.
exports.submitPIQTest = submitPIQTest;
exports.submitPPDTTest = submitPPDTTest;
exports.submitTATTest = submitTATTest;
exports.submitWATTest = submitWATTest;
exports.submitSRTTest = submitSRTTest;
exports.submitSDTest = submitSDTest;
exports.submitGTOTest = submitGTOTest;
// OIR notification/persistence parity fix: web's OIR flow previously never created a
// submissions/{id} doc at all (unlike every other type), so onOirSubmissionCreated never fired
// for it and there was no result history. Scores server-side via evaluateOIRSubmission (never
// trusts a client-supplied score), matching KMP's SubmitOIRTestUseCase's score-then-persist shape.
exports.submitOIRTest = submitOIRTest;
exports.submitInterviewResponse = submitInterviewResponse;

// Phase 8 (ai_search_readiness plan, "Measurement & Instrumentation"): signup counter and its
// admin-only read. Auth-required write, admin-claim-gated read -- see analytics/recordSignup.js
// and analytics/getAnalyticsSummary.js's doc comments for why this is a counter, not an event
// log, and why traffic/referrer segmentation is intentionally NOT duplicated here.
exports.recordSignup = recordSignup;

// Phase 1 (docs/plans/AccountDeletion.md): soft-delete grace-period account deletion --
// `functions/src/account/` is the sole cascade-delete authority (root CLAUDE.md's
// four-consumer SSOT section). requestAccountDeletion/cancelAccountDeletion are the
// client-facing callables; purgeExpiredAccounts is the daily sweep that runs the real
// cascade once the grace period elapses.
exports.requestAccountDeletion = requestAccountDeletion;
exports.cancelAccountDeletion = cancelAccountDeletion;
exports.purgeExpiredAccounts = purgeExpiredAccounts;
exports.getAnalyticsSummary = getAnalyticsSummary;
