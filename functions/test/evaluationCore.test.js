/**
 * Phase 1 (Web SSB Test Flow Parity plan): tests for `src/evaluation/core.js`'s
 * `runEvaluation` dispatcher. Uses a generic in-memory fake Firestore (path -> doc),
 * following the same fake-injection convention as `eligibility.test.js`/`oirScoring.test.js`.
 *
 * Phase 4: submission fixtures use the real `SubmissionDocDto` envelope
 * (`{ userId, testType, ..., data: { analysisStatus, ... } }`) that every
 * `GitLive*SubmissionRepository` actually writes -- `analysisStatus` nests
 * under `data`, it is not a top-level field. `update()` below applies dotted
 * keys (e.g. `'data.analysisStatus'`) as nested-field-path merges, matching
 * real Firestore `DocumentReference.update()` semantics.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { runEvaluation } = require('../src/evaluation/core');

/** Applies a dotted-path partial update (`'data.analysisStatus'`) onto a plain object, Firestore-style. */
function applyDottedUpdate(target, value) {
  const result = { ...(target || {}) };
  for (const [dottedKey, val] of Object.entries(value)) {
    const parts = dottedKey.split('.');
    let node = result;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = { ...(node[parts[i]] || {}) };
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = val;
  }
  return result;
}

/** Generic in-memory fake standing in for admin.firestore(), keyed by full path string. */
function makeFakeDb(initialDocs = {}) {
  const store = { ...initialDocs };
  const writes = [];

  function docRef(path) {
    return {
      path,
      async get() {
        const data = store[path];
        return { exists: data !== undefined, data: () => data };
      },
      async set(value) {
        store[path] = value;
        writes.push({ path, value });
      },
      async update(value) {
        store[path] = applyDottedUpdate(store[path], value);
        writes.push({ path, value });
      },
      collection(sub) {
        return collectionRef(`${path}/${sub}`);
      }
    };
  }

  function collectionRef(path) {
    return { doc: (id) => docRef(`${path}/${id}`) };
  }

  return {
    collection: (path) => collectionRef(path),
    _store: store,
    _writes: writes
  };
}

const SUBMISSION_ID = 'sub1';
const UID = 'user1';

function baseArgs(overrides = {}) {
  return {
    uid: UID,
    submissionId: SUBMISSION_ID,
    testType: 'WAT',
    buildPrompt: (submission) => `prompt for ${submission.userId}`,
    parseAndValidate: (raw) => ({ olqScores: { COURAGE: { score: 5 } }, overallScore: 5, raw }),
    resultCollection: 'wat_results',
    ...overrides
  };
}

test('Phase 1: runEvaluation rejects permission-denied when the submission belongs to another user', async () => {
  const db = makeFakeDb({
    [`submissions/${SUBMISSION_ID}`]: { userId: 'someone-else', data: { analysisStatus: 'PENDING_ANALYSIS' } }
  });
  await assert.rejects(
    () => runEvaluation({ firestoreDb: db, generateContent: async () => 'irrelevant', ...baseArgs() }),
    (err) => {
      assert.equal(err.code, 'permission-denied');
      return true;
    }
  );
});

test('Phase 1: runEvaluation is an idempotent no-op when status is not PENDING_ANALYSIS', async () => {
  const db = makeFakeDb({
    [`submissions/${SUBMISSION_ID}`]: { userId: UID, data: { analysisStatus: 'COMPLETED' } }
  });
  const result = await runEvaluation({ firestoreDb: db, generateContent: async () => 'irrelevant', ...baseArgs() });
  assert.equal(result.skipped, true);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(db._writes.length, 0, 'a non-PENDING_ANALYSIS submission must not be touched at all');
});

test('Phase 1: runEvaluation rejects failed-precondition when the user is already at their monthly quota', async () => {
  process.env.ENFORCE_QUOTA = 'true';
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const db = makeFakeDb({
    [`submissions/${SUBMISSION_ID}`]: { userId: UID, data: { analysisStatus: 'PENDING_ANALYSIS' } },
    [`users/${UID}/data/subscription`]: { tier: 'PRO' },
    [`users/${UID}/subscription/usage_${month}`]: { watTestsUsed: 3 }
  });
  await assert.rejects(
    () => runEvaluation({ firestoreDb: db, generateContent: async () => 'irrelevant', ...baseArgs() }),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
  delete process.env.ENFORCE_QUOTA;
});

test('Phase 1: runEvaluation happy path flips ANALYZING -> COMPLETED and writes the result doc', async () => {
  const db = makeFakeDb({
    [`submissions/${SUBMISSION_ID}`]: { userId: UID, data: { analysisStatus: 'PENDING_ANALYSIS' } },
    [`users/${UID}/data/subscription`]: { tier: 'PREMIUM' } // unlimited, quota check is a no-op
  });
  const result = await runEvaluation({
    firestoreDb: db,
    generateContent: async (prompt) => `raw:${prompt}`,
    ...baseArgs()
  });

  assert.equal(result.success, true);
  assert.equal(result.status, 'COMPLETED');
  assert.equal(db._store[`submissions/${SUBMISSION_ID}`].data.analysisStatus, 'COMPLETED');

  const resultDoc = db._store[`wat_results/${SUBMISSION_ID}`];
  assert.ok(resultDoc, 'result doc must be written to the resultCollection');
  assert.equal(resultDoc.submissionId, SUBMISSION_ID);
  assert.equal(resultDoc.testType, 'WAT');
  assert.equal(resultDoc.userId, UID, 'result doc must carry userId, required by psych_results security rules');
  assert.deepEqual(resultDoc.olqScores, { COURAGE: { score: 5 } });

  const analyzingWrite = db._writes.find(
    (w) => w.path === `submissions/${SUBMISSION_ID}` && w.value['data.analysisStatus'] === 'ANALYZING'
  );
  assert.ok(analyzingWrite, 'must flip to ANALYZING before calling Gemini');
});

test('Phase 1: runEvaluation flips to FAILED and writes no result doc when parseAndValidate never accepts', async () => {
  const db = makeFakeDb({
    [`submissions/${SUBMISSION_ID}`]: { userId: UID, data: { analysisStatus: 'PENDING_ANALYSIS' } },
    [`users/${UID}/data/subscription`]: { tier: 'PREMIUM' }
  });
  const result = await runEvaluation({
    firestoreDb: db,
    generateContent: async () => 'unparseable garbage',
    retryDelayFn: async () => {},
    ...baseArgs({
      parseAndValidate: () => {
        throw new Error('Gemini response rejected');
      }
    })
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 'FAILED');
  assert.equal(db._store[`submissions/${SUBMISSION_ID}`].data.analysisStatus, 'FAILED');
  assert.equal(db._store['wat_results/' + SUBMISSION_ID], undefined, 'no result doc on failure');
});

test('Phase 1: runEvaluation ENFORCE_QUOTA=false logs but still proceeds past an over-quota check', async () => {
  process.env.ENFORCE_QUOTA = 'false';
  try {
    const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    const db = makeFakeDb({
      [`submissions/${SUBMISSION_ID}`]: { userId: UID, data: { analysisStatus: 'PENDING_ANALYSIS' } },
      [`users/${UID}/data/subscription`]: { tier: 'FREE' },
      [`users/${UID}/subscription/usage_${month}`]: { watTestsUsed: 0 } // FREE tier has 0 WAT quota
    });
    const result = await runEvaluation({ firestoreDb: db, generateContent: async () => 'raw', ...baseArgs() });
    assert.equal(result.success, true);
  } finally {
    delete process.env.ENFORCE_QUOTA;
  }
});
