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
