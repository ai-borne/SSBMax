#!/usr/bin/env node

/** Fixture tests for the OIR ingestion contract. No Firebase credentials or writes. */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, 'oir-extraction');
const uploadScript = path.join(root, 'upload-oir-batch.js');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oir-tooling-'));

function runUpload(batchId, questions) {
  fs.writeFileSync(path.join(tempDir, `${batchId}.json`), JSON.stringify({
    batchId,
    version: '3.0',
    source: 'fixture',
    totalQuestions: questions.length,
    questions,
  }));
  return spawnSync(process.execPath, [uploadScript, batchId, '--dry-run'], {
    encoding: 'utf8',
    env: { ...process.env, OIR_OUT_DIR: tempDir },
  });
}

const validQuestion = {
  id: 'fixture-q1',
  questionNumber: 1,
  type: 'VERBAL_REASONING',
  questionText: 'Choose the valid option.',
  options: [{ id: 'opt_a', text: 'A' }, { id: 'opt_b', text: 'B' }],
  correctAnswerId: 'opt_a',
  timeSeconds: 60,
};

const missingDifficulty = runUpload('without-difficulty', [validQuestion]);
assert.strictEqual(missingDifficulty.status, 0, missingDifficulty.stderr);
assert.match(missingDifficulty.stdout, /Dry run OK/);

const legacyDifficulty = runUpload('legacy-difficulty', [{ ...validQuestion, difficulty: 'MEDIUM' }]);
assert.strictEqual(legacyDifficulty.status, 0, legacyDifficulty.stderr);

const missingRequiredField = runUpload('missing-required-field', [{
  ...validQuestion,
  questionText: '',
}]);
assert.notStrictEqual(missingRequiredField.status, 0);
assert.match(missingRequiredField.stderr, /Question text is empty or blank/);

const extractorSources = [
  fs.readFileSync(path.join(root, 'oir_extract_v2.py'), 'utf8'),
  fs.readFileSync(path.join(root, 'oir_extract_part3.py'), 'utf8'),
];
extractorSources.forEach((source) => {
  assert.doesNotMatch(source, /["']difficulty["']\s*:\s*["']MEDIUM["']/);
});

console.log('✅ OIR tooling fixture tests passed (no Firebase writes).');
