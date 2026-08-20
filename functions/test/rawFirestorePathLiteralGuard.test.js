/**
 * Phase 2 guard test (docs/plans/CrossPlatform_SSOT): a raw Firestore
 * collection/document-path literal must never reappear in functions/src
 * outside the generated contracts file. FirestorePaths
 * (src/generated/contracts.cjs) is the only source of truth for a path.
 *
 * Runs via Node native test runner (node --test).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcRoot = path.join(__dirname, '..', 'src');
const exemptDir = path.join(srcRoot, 'generated');

// `.collection('literal')` / `.doc('literal')` -- a bare string-literal
// argument (no template interpolation) to a Firestore collection/doc call.
const RAW_LITERAL_CALL = /\.(collection|doc)\(\s*'[^'`]*'\s*\)/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return full === exemptDir ? [] : walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

test('functions/src has zero raw literal .collection()/.doc() calls outside generated/', () => {
  const offenders = walk(srcRoot)
    .filter((file) => RAW_LITERAL_CALL.test(fs.readFileSync(file, 'utf8')))
    .map((file) => path.relative(srcRoot, file));

  assert.deepEqual(offenders, []);
});
