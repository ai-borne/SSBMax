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
const { createRazorpayOrder } = require('./payments');
const { evaluateOIRAnswers } = require('./oirScoring');
const { analyzeInterviewResponse, analyzeResponseInline } = require('./aiAnalysis');
const { recordTestUsage } = require('./eligibility');
const { geminiGenerateContent } = require('./geminiProxy');
const { evaluateWAT } = require('./evaluation/watEvaluate');
const { evaluateSRT } = require('./evaluation/srtEvaluate');
const { evaluateSD } = require('./evaluation/sdEvaluate');
const { evaluateInterviewResponse } = require('./evaluation/interviewEvaluate');
const { evaluateGTO } = require('./evaluation/gtoEvaluate');
const { evaluatePPDT } = require('./evaluation/ppdtEvaluate');

exports.handleRazorpayWebhook = handleRazorpayWebhook;
exports.createRazorpayOrder = createRazorpayOrder;
exports.evaluateOIRAnswers = evaluateOIRAnswers;
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
