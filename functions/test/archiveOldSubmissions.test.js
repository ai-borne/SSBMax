/**
 * Submission archival server-migration plan: tests for `src/archival/archiveOldSubmissions.js`.
 * Ports `GitLiveSubmissionArchiveRepository.kt::archiveOldSubmissions`'s copy-then-delete sweep
 * server-side -- `archived_submissions` is `allow read, write: if false` in firestore.rules, so
 * the client-side WorkManager job that used to do this always hit PERMISSION_DENIED (Android)
 * and had no execution guarantee at all (iOS BGTaskScheduler). Each assertion here pins a
 * behavior the Kotlin original had that must survive the port, especially the
 * only-delete-if-the-copy-succeeded safety property (no data loss on partial failure).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { archiveOldSubmissionsCore } = require('../src/archival/archiveOldSubmissions');

/** Minimal fake supporting collectionGroup(...).where(...).get() plus per-doc delete()/collection().doc().set(). */
function makeFakeDb(submissionDocs = {}) {
  const submissions = new Map(Object.entries(submissionDocs));
  const archived = new Map();
  let failArchiveWriteFor = null;

  function submissionRef(id) {
    return {
      id,
      async delete() {
        submissions.delete(id);
      }
    };
  }

  return {
    collectionGroup(name) {
      if (name !== 'submissions') throw new Error(`unexpected collectionGroup: ${name}`);
      return {
        where(field, op, value) {
          return {
            async get() {
              const docs = Array.from(submissions.entries())
                .filter(([, data]) => (op === '<' ? data[field] < value : true))
                .map(([id, data]) => ({ id, data: () => data, ref: submissionRef(id) }));
              return { docs, size: docs.length };
            }
          };
        }
      };
    },
    collection(name) {
      if (name !== 'archived_submissions') throw new Error(`unexpected collection: ${name}`);
      return {
        doc(id) {
          return {
            async set(value) {
              if (failArchiveWriteFor && failArchiveWriteFor(id, value)) {
                throw new Error(`simulated PERMISSION_DENIED for ${id}`);
              }
              archived.set(id, value);
            }
          };
        }
      };
    },
    _submissions: submissions,
    _archived: archived,
    _failArchiveWriteFor(fn) {
      failArchiveWriteFor = fn;
    }
  };
}

const CUTOFF = 1_700_000_000_000;

test('archiveOldSubmissionsCore copies a stale submission into archived_submissions and deletes the original', async () => {
  const db = makeFakeDb({ old1: { id: 'old1', userId: 'u1', testType: 'WAT', submittedAt: CUTOFF - 1000 } });
  const result = await archiveOldSubmissionsCore(db, CUTOFF);

  assert.equal(result.archivedCount, 1);
  assert.deepEqual(db._archived.get('old1'), { id: 'old1', userId: 'u1', testType: 'WAT', submittedAt: CUTOFF - 1000 });
  assert.equal(db._submissions.has('old1'), false, 'the original must be deleted after a successful archive-copy');
});

test('archiveOldSubmissionsCore leaves submissions at or after the cutoff untouched', async () => {
  const db = makeFakeDb({ recent1: { id: 'recent1', userId: 'u1', testType: 'SRT', submittedAt: CUTOFF + 1000 } });
  const result = await archiveOldSubmissionsCore(db, CUTOFF);

  assert.equal(result.archivedCount, 0);
  assert.equal(db._archived.has('recent1'), false);
  assert.equal(db._submissions.has('recent1'), true);
});

test('archiveOldSubmissionsCore sweeps every test type uniformly, not scoped to one', async () => {
  const db = makeFakeDb({
    wat1: { id: 'wat1', testType: 'WAT', submittedAt: CUTOFF - 1 },
    piq1: { id: 'piq1', testType: 'PIQ', submittedAt: CUTOFF - 1 },
    interview1: { id: 'interview1', testType: 'IO', submittedAt: CUTOFF - 1 }
  });
  const result = await archiveOldSubmissionsCore(db, CUTOFF);

  assert.equal(result.archivedCount, 3);
  assert.equal(db._archived.size, 3);
});

test('archiveOldSubmissionsCore falls back to the doc id when the raw data has no "id" field', async () => {
  const db = makeFakeDb({ 'doc-id-1': { userId: 'u1', testType: 'SD', submittedAt: CUTOFF - 1 } });
  await archiveOldSubmissionsCore(db, CUTOFF);

  assert.ok(db._archived.has('doc-id-1'), 'must use the Firestore doc id when the document has no own "id" field');
});

test('archiveOldSubmissionsCore does NOT delete the original when the archive-copy write fails (no data loss on partial failure)', async () => {
  const db = makeFakeDb({
    ok1: { id: 'ok1', testType: 'WAT', submittedAt: CUTOFF - 1 },
    fail1: { id: 'fail1', testType: 'SRT', submittedAt: CUTOFF - 1 }
  });
  db._failArchiveWriteFor((id) => id === 'fail1');

  const result = await archiveOldSubmissionsCore(db, CUTOFF);

  assert.equal(result.archivedCount, 1, 'only the successfully-archived doc counts');
  assert.equal(db._submissions.has('fail1'), true, 'a submission whose archive-copy failed must NOT be deleted');
  assert.equal(db._archived.has('fail1'), false);
  assert.equal(db._submissions.has('ok1'), false, 'the doc that did succeed must still be deleted');
});

test('archiveOldSubmissionsCore returns archivedCount: 0 when nothing is stale', async () => {
  const db = makeFakeDb({});
  const result = await archiveOldSubmissionsCore(db, CUTOFF);
  assert.equal(result.archivedCount, 0);
});
