/**
 * Phase 5 (cost & scale guardrails): tests for `src/archival/scheduledFirestoreBackup.js`'s
 * pure request-building logic. The actual `exportDocuments` RPC is a real Google Cloud call
 * (long-running operation against the project's Firestore Admin API) and isn't exercised here --
 * this pins the one thing that's realistically wrong-able without a live project: the request
 * shape sent to it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExportRequest } = require('../src/archival/scheduledFirestoreBackup');

test('buildExportRequest targets the "(default)" database for the given project', () => {
  const request = buildExportRequest('ssbmax-49e68', 'ssbmax-49e68-firestore-backups', 1700000000000);
  assert.equal(request.name, 'projects/ssbmax-49e68/databases/(default)');
});

test('buildExportRequest writes into a timestamped path under the given bucket', () => {
  const request = buildExportRequest('ssbmax-49e68', 'my-backup-bucket', 1700000000000);
  assert.equal(request.outputUriPrefix, 'gs://my-backup-bucket/firestore-backups/1700000000000');
});

test('buildExportRequest exports every collection (empty collectionIds, matching gcloud firestore export\'s default)', () => {
  const request = buildExportRequest('ssbmax-49e68', 'my-backup-bucket', 1700000000000);
  assert.deepEqual(request.collectionIds, []);
});

test('buildExportRequest defaults the timestamp to "now" when not supplied', () => {
  const before = Date.now();
  const request = buildExportRequest('ssbmax-49e68', 'my-backup-bucket');
  const after = Date.now();

  const usedTimestamp = Number(request.outputUriPrefix.split('/').pop());
  assert.ok(usedTimestamp >= before && usedTimestamp <= after, 'should stamp with the current time when none is passed');
});
