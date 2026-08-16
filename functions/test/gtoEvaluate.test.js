/**
 * Phase 8 (Web SSB Test Flow Parity plan): tests for `src/evaluation/gtoEvaluate.js`.
 *
 * `buildGTOResult` and `GTO_SUBTYPE_CONFIG` are tested directly (pure functions/data,
 * the meat of this file's own logic). The full `evaluateGTO` callable's cross-cutting
 * behavior (ownership, quota, retry) reuses `checkQuota`/`withRetry` already covered by
 * `evaluationCore.test.js`/`retry.test.js` -- this file's own contribution is the
 * top-level `status` field (not `data.analysisStatus`) and the GD/GPE/Lecturette
 * subtype dispatch, both exercised below.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGTOResult, GTO_SUBTYPE_CONFIG, evaluateGTOSubmission } = require('../src/evaluation/gtoEvaluate');
const { Enums } = require('../src/generated/contracts.cjs');

/** Same fake-db shape as evaluationCore.test.js (dotted-update + transaction support). */
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

function makeFakeDb(initialDocs = {}) {
  const store = { ...initialDocs };

  function docRef(path) {
    return {
      async get() {
        const data = store[path];
        return { exists: data !== undefined, data: () => data };
      },
      async set(value) {
        store[path] = value;
      },
      async update(value) {
        store[path] = applyDottedUpdate(store[path], value);
      },
      collection: (sub) => collectionRef(`${path}/${sub}`)
    };
  }

  function collectionRef(path) {
    return { doc: (id) => docRef(`${path}/${id}`) };
  }

  return {
    collection: (path) => collectionRef(path),
    async runTransaction(fn) {
      return fn({ get: (ref) => ref.get(), set: (ref, value) => ref.set(value) });
    },
    _store: store
  };
}

const ALL_OLQ_IDS = Object.keys(Enums.OLQ);

function fullOlqScoresResponse(overrides = {}) {
  const olqScores = {};
  for (const id of ALL_OLQ_IDS) {
    olqScores[id] = { score: 6, confidence: 80, reasoning: `reasoning for ${id}` };
  }
  Object.assign(olqScores, overrides);
  return JSON.stringify({ olqScores });
}

test('Phase 8: GTO_SUBTYPE_CONFIG supports exactly GD/GPE/Lecturette, mapping to their domain GTOTestType names', () => {
  assert.deepEqual(Object.keys(GTO_SUBTYPE_CONFIG).sort(), ['GTO_GD', 'GTO_GPE', 'GTO_LECTURETTE']);
  assert.equal(GTO_SUBTYPE_CONFIG.GTO_GD.resultTestType, 'GROUP_DISCUSSION');
  assert.equal(GTO_SUBTYPE_CONFIG.GTO_GPE.resultTestType, 'GROUP_PLANNING_EXERCISE');
  assert.equal(GTO_SUBTYPE_CONFIG.GTO_LECTURETTE.resultTestType, 'LECTURETTE');
});

test('Phase 8: buildGTOResult throws (triggers retry, via withRetry catch) on unparseable Gemini output', () => {
  assert.throws(() => buildGTOResult('not json at all'));
});

test('Phase 8: buildGTOResult returns null (triggers retry) when fewer than 14 OLQs are present', () => {
  const olqScores = {};
  for (const id of ALL_OLQ_IDS.slice(0, 10)) {
    olqScores[id] = { score: 6, confidence: 80, reasoning: 'r' };
  }
  assert.equal(buildGTOResult(JSON.stringify({ olqScores })), null);
});

test('Phase 8: buildGTOResult computes overallScore as the mean of all 15 (clamped) scores and a matching rating', () => {
  const result = buildGTOResult(fullOlqScoresResponse());
  assert.equal(result.overallScore, 6);
  assert.equal(result.overallRating, 'Good');
});

test('Phase 8: buildGTOResult has no strengths/weaknesses/recommendations fields (GTOResultDto is a leaner shape than psych_results)', () => {
  const result = buildGTOResult(fullOlqScoresResponse());
  assert.equal(result.strengths, undefined);
  assert.equal(result.weaknesses, undefined);
  assert.equal(result.recommendations, undefined);
});

test('Phase 8: buildGTOResult sets aiConfidence to the rounded overall (averaged) confidence', () => {
  const result = buildGTOResult(fullOlqScoresResponse({ EFFECTIVE_INTELLIGENCE: { score: 6, confidence: 10, reasoning: 'r' } }));
  const expectedAverage = Math.round((10 + 80 * 14) / 15);
  assert.equal(result.aiConfidence, expectedAverage);
});

/** Same quota-bypass fix as evaluationCore.test.js -- see that file's identical test for rationale. */
const GTO_SUBMISSION_ID = 'gtoSub1';
const GTO_UID = 'user1';

test('evaluateGTOSubmission charges the usage counter itself on a successful COMPLETED evaluation', async () => {
  const db = makeFakeDb({
    [`submissions/${GTO_SUBMISSION_ID}`]: { userId: GTO_UID, testType: 'GTO_GD', status: 'PENDING_ANALYSIS' },
    [`users/${GTO_UID}/data/subscription`]: { tier: 'PRO' }
  });
  await evaluateGTOSubmission(db, GTO_UID, GTO_SUBMISSION_ID, async () => fullOlqScoresResponse());

  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const usage = db._store[`users/${GTO_UID}/subscription/usage_${month}`];
  assert.ok(usage, 'usage doc must be written by evaluateGTOSubmission itself');
  assert.equal(usage.gtoTestsUsed, 1);
});

test('evaluateGTOSubmission does not charge the usage counter when the Gemini response never parses (FAILED)', async () => {
  const db = makeFakeDb({
    [`submissions/${GTO_SUBMISSION_ID}`]: { userId: GTO_UID, testType: 'GTO_GD', status: 'PENDING_ANALYSIS' },
    [`users/${GTO_UID}/data/subscription`]: { tier: 'PRO' }
  });
  const result = await evaluateGTOSubmission(db, GTO_UID, GTO_SUBMISSION_ID, async () => 'not json at all', async () => {});

  assert.equal(result.status, 'FAILED');
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  assert.equal(db._store[`users/${GTO_UID}/subscription/usage_${month}`], undefined, 'a FAILED evaluation must not consume quota');
});
