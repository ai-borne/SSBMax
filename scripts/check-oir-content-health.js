#!/usr/bin/env node

/**
 * Read-only production health check for the canonical OIR content bank.
 *
 * Usage:
 *   node scripts/check-oir-content-health.js
 *
 * Authentication uses FIREBASE_SERVICE_ACCOUNT or the local development
 * service-account path. This command never writes Firestore or Storage.
 */

const fs = require('fs');
const path = require('path');

const EXPECTED_VERSION = 4;
const EXPECTED_BATCH_COUNT = 28;
const EXPECTED_TOTAL_QUESTIONS = 1255;
const EXPECTED_BATCH_IDS = Array.from(
  { length: EXPECTED_BATCH_COUNT },
  (_, index) => `batch_pdf_${String(index + 1).padStart(3, '0')}`
);
const EXPECTED_TYPES = new Set([
  'VERBAL_REASONING',
  'NON_VERBAL_REASONING',
  'NUMERICAL_ABILITY',
  'SPATIAL_REASONING',
]);
const IMAGE_TIMEOUT_MS = 15_000;

function serviceAccountPath() {
  return process.env.FIREBASE_SERVICE_ACCOUNT ||
    path.join(process.env.HOME || '', 'Downloads/SSBMax/firebase-admin-key.json');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateQuestion(question, seenIds, counters, batchId) {
  const id = typeof question.id === 'string' ? question.id.trim() : '';
  if (Object.prototype.hasOwnProperty.call(question, 'difficulty')) {
    counters.legacyDifficultyFields += 1;
    if (typeof question.difficulty !== 'string' || !question.difficulty.trim()) {
      counters.malformedDifficultyFields += 1;
    }
  }
  assert(id, `${batchId}: question has no stable id`);
  assert(!seenIds.has(id), `duplicate question id across batches: ${id}`);
  seenIds.add(id);

  const errors = [];
  const options = Array.isArray(question.options) ? question.options : [];
  if (!question.questionText || !question.questionText.trim()) errors.push('missing questionText');
  if (options.length === 0) errors.push('missing options');
  if (!EXPECTED_TYPES.has(question.type)) errors.push(`invalid type ${question.type}`);
  if (!(question.questionNumber > 0)) errors.push('invalid questionNumber');
  if (!(question.timeSeconds > 0)) errors.push('invalid timeSeconds');
  const optionIds = options.map((option) => option && option.id);
  if (new Set(optionIds).size !== optionIds.length) errors.push('duplicate option IDs');
  options.forEach((option) => {
    if (!option || !option.id || (!option.text && !option.imageUrl)) errors.push('invalid option');
  });
  const correctIds = Array.isArray(question.correctAnswerIds) ? question.correctAnswerIds : [];
  if (!question.correctAnswerId && correctIds.length < 2) errors.push('missing correct answer');
  if (question.correctAnswerId && !optionIds.includes(question.correctAnswerId)) {
    errors.push('correct answer is not an option');
  }
  if (correctIds.some((answerId) => !optionIds.includes(answerId))) errors.push('multi-select answer is not an option');
  if (errors.length === 0) {
    counters.validQuestions += 1;
    counters.validByType[question.type] = (counters.validByType[question.type] || 0) + 1;
  } else {
    counters.invalidQuestions += 1;
  }
  counters.types[question.type] = (counters.types[question.type] || 0) + 1;

  if (question.questionImageUrl !== undefined && question.questionImageUrl !== null) {
    assert(typeof question.questionImageUrl === 'string' &&
      question.questionImageUrl.startsWith('https://'),
    `${batchId}/${id}: questionImageUrl is not HTTPS`);
    counters.imageUrls.push(question.questionImageUrl);
  }
  options.forEach((option) => {
    if (option && typeof option.imageUrl === 'string' && option.imageUrl) {
      assert(option.imageUrl.startsWith('https://'),
        `${batchId}/${id}: option image URL is not HTTPS`);
      counters.imageUrls.push(option.imageUrl);
    }
  });
}

async function checkImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    assert(response.status === 200, `${url} returned HTTP ${response.status}`);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`${url} timed out after ${IMAGE_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const accountPath = serviceAccountPath();
  assert(fs.existsSync(accountPath),
    `Service account not found at ${accountPath}. Set FIREBASE_SERVICE_ACCOUNT explicitly.`);

  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(require(accountPath)) });
  const db = admin.firestore();
  const metaRef = db.collection('test_content').doc('oir').collection('meta').doc('config');
  const batchCollection = db.collection('test_content').doc('oir').collection('batches');

  const metaSnapshot = await metaRef.get();
  assert(metaSnapshot.exists, 'metadata document test_content/oir/meta/config does not exist');
  const metadata = metaSnapshot.data();
  assert(metadata.contentVersion === EXPECTED_VERSION,
    `contentVersion is ${metadata.contentVersion}; expected ${EXPECTED_VERSION}`);
  assert(metadata.batchCount === EXPECTED_BATCH_COUNT,
    `batchCount is ${metadata.batchCount}; expected ${EXPECTED_BATCH_COUNT}`);
  assert(metadata.batches === EXPECTED_BATCH_COUNT,
    `batches is ${metadata.batches}; expected ${EXPECTED_BATCH_COUNT}`);
  assert(metadata.total_questions === EXPECTED_TOTAL_QUESTIONS,
    `total_questions is ${metadata.total_questions}; expected ${EXPECTED_TOTAL_QUESTIONS}`);
  assert(JSON.stringify(metadata.distribution) === JSON.stringify({
    VERBAL_REASONING: 20,
    NON_VERBAL_REASONING: 20,
    NUMERICAL_ABILITY: 10,
  }), 'distribution metadata is not the runtime 20/20/10 SSOT');

  const batchSnapshot = await batchCollection.get();
  const actualBatchIds = batchSnapshot.docs.map((doc) => doc.id).sort();
  assert(JSON.stringify(actualBatchIds) === JSON.stringify([...EXPECTED_BATCH_IDS].sort()),
    `batch IDs do not exactly match batch_pdf_001..${EXPECTED_BATCH_COUNT}`);

  const seenIds = new Set();
  const counters = {
    totalQuestions: 0,
    validQuestions: 0,
    invalidQuestions: 0,
    types: {},
    validByType: {},
    imageUrls: [],
    legacyDifficultyFields: 0,
    malformedDifficultyFields: 0,
  };
  for (const batchDoc of batchSnapshot.docs) {
    const data = batchDoc.data();
    const questions = Array.isArray(data.questions) ? data.questions : [];
    assert(data.batchId === batchDoc.id, `${batchDoc.id}: batchId field does not match document ID`);
    assert(data.totalQuestions === questions.length,
      `${batchDoc.id}: totalQuestions does not match questions.length`);
    counters.totalQuestions += questions.length;
    questions.forEach((question) => validateQuestion(question, seenIds, counters, batchDoc.id));
  }
  assert(counters.totalQuestions === EXPECTED_TOTAL_QUESTIONS,
    `question total is ${counters.totalQuestions}; expected ${EXPECTED_TOTAL_QUESTIONS}`);
  const requiredCoverage = {
    VERBAL_REASONING: 20,
    NON_VERBAL_REASONING: 20,
    NUMERICAL_ABILITY: 10,
  };
  Object.entries(requiredCoverage).forEach(([type, minimum]) => {
    const validCount = counters.validByType[type] || 0;
    assert(validCount >= minimum,
      `valid ${type} coverage is ${validCount}; need at least ${minimum}`);
  });

  const uniqueImageUrls = [...new Set(counters.imageUrls)];
  const imageFailures = [];
  for (const url of uniqueImageUrls) {
    try {
      await checkImage(url);
    } catch (error) {
      imageFailures.push(error.message);
    }
  }
  assert(imageFailures.length === 0,
    `image verification failed for ${imageFailures.length}/${uniqueImageUrls.length}:\n` +
    imageFailures.join('\n'));

  console.log('✅ OIR content health check passed (read-only)');
  console.log(`   contentVersion: ${metadata.contentVersion}`);
  console.log(`   batches: ${actualBatchIds.length}`);
  console.log(`   total questions: ${counters.totalQuestions}`);
  console.log(`   valid questions: ${counters.validQuestions}`);
  console.log(`   skipped questions: ${counters.invalidQuestions}`);
  console.log(`   legacy difficulty fields (informational): ${counters.legacyDifficultyFields}`);
  console.log(`   malformed legacy difficulty fields (informational): ${counters.malformedDifficultyFields}`);
  console.log(`   type coverage (all/valid): ${JSON.stringify(counters.types)} / ${JSON.stringify(counters.validByType)}`);
  console.log(`   unique HTTPS image URLs checked: ${uniqueImageUrls.length}`);
}

main().catch((error) => {
  console.error(`❌ OIR content health check failed: ${error.message}`);
  process.exitCode = 1;
});
