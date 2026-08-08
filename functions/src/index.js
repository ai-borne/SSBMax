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

exports.handleRazorpayWebhook = handleRazorpayWebhook;
exports.createRazorpayOrder = createRazorpayOrder;
exports.evaluateOIRAnswers = evaluateOIRAnswers;
exports.analyzeInterviewResponse = analyzeInterviewResponse;
exports.analyzeResponseInline = analyzeResponseInline;
