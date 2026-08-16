/**
 * Phase 7 (Web SSB Test Flow Parity plan): tests for `src/evaluation/interviewEvaluate.js`.
 *
 * `buildInterviewResult` is tested directly (pure function, the meat of this file's own
 * logic, and the piece that diverges from WAT/SRT/SD: a single interview response only
 * targets a subset of the 15 OLQs, so unlike `finalizeOlqScores` there is no
 * 14-of-15-acceptance gate or neutral-fill here -- any 1+ valid OLQ score is accepted).
 * The full callable's cross-cutting ownership/quota checks mirror the already-tested
 * `checkQuota` (`evaluationCore.test.js`) and the legacy dual-ownership check this file
 * generalizes (`aiAnalysis.js::analyzeInterviewResponse`, tested pre-Phase-7).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildInterviewResult, evaluateInterviewResponseCore } = require('../src/evaluation/interviewEvaluate');

function arrayResponse(items, extra = {}) {
  return JSON.stringify({ olqScores: items, ...extra });
}

/** Same fake-db shape as evaluationCore.test.js/gtoEvaluate.test.js. */
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

test('Phase 7: buildInterviewResult parses a targeted-subset olqScores array (not all 15)', () => {
  const result = buildInterviewResult(
    arrayResponse([{ olq: 'INITIATIVE', score: 4, reasoning: 'proactive', evidence: ['took charge'] }], {
      overallConfidence: 80
    })
  );
  assert.deepEqual(Object.keys(result.olqScores), ['INITIATIVE']);
  assert.equal(result.olqScores.INITIATIVE.score, 4);
  assert.equal(result.olqScores.INITIATIVE.confidence, 80);
  assert.equal(result.olqScores.INITIATIVE.reasoning, 'proactive');
  assert.equal(result.confidenceScore, 80);
});

test('Phase 7: buildInterviewResult clamps a decimal score to the domain OLQScore 1..10 int invariant', () => {
  const result = buildInterviewResult(arrayResponse([{ olq: 'COURAGE', score: 5.5, reasoning: 'r' }]));
  assert.equal(result.olqScores.COURAGE.score, 6);
  assert.ok(Number.isInteger(result.olqScores.COURAGE.score));
});

test('Phase 7: buildInterviewResult clamps an out-of-range score into 1..10', () => {
  const result = buildInterviewResult(arrayResponse([{ olq: 'STAMINA', score: 14, reasoning: 'r' }]));
  assert.equal(result.olqScores.STAMINA.score, 10);
});

test('Phase 7: buildInterviewResult returns null (triggers retry) on unparseable Gemini output', () => {
  assert.equal(buildInterviewResult('not json at all'), null);
});

test('Phase 7: buildInterviewResult returns null (triggers retry) when no OLQ in the response matches a known id', () => {
  const result = buildInterviewResult(arrayResponse([{ olq: 'NOT_A_REAL_OLQ', score: 5, reasoning: 'r' }]));
  assert.equal(result, null);
});

test('Phase 7: buildInterviewResult ignores unknown OLQ ids but keeps valid ones from the same response', () => {
  const result = buildInterviewResult(
    arrayResponse([
      { olq: 'NOT_A_REAL_OLQ', score: 5, reasoning: 'r' },
      { olq: 'DETERMINATION', score: 3, reasoning: 'persistent' }
    ])
  );
  assert.deepEqual(Object.keys(result.olqScores), ['DETERMINATION']);
});

/** Same quota-bypass fix as evaluationCore.test.js/gtoEvaluate.test.js -- see those for rationale. */
const UID = 'user1';
const SESSION_ID = 'sess1';

function baseFixtures(overrides = {}) {
  return {
    [`interview_responses/resp1`]: { userId: UID, sessionId: SESSION_ID, questionId: 'q1', responseText: 'my answer', olqScores: {} },
    [`interview_sessions/${SESSION_ID}`]: { userId: UID },
    [`users/${UID}/data/subscription`]: { tier: 'PRO' },
    ...overrides
  };
}

test('evaluateInterviewResponseCore charges the usage counter once, keyed by sessionId, on a successful evaluation', async () => {
  const db = makeFakeDb(baseFixtures());
  await evaluateInterviewResponseCore(db, UID, 'resp1', SESSION_ID, async () => arrayResponse([{ olq: 'COURAGE', score: 5, reasoning: 'r' }], { overallConfidence: 70 }));

  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const usage = db._store[`users/${UID}/subscription/usage_${month}`];
  assert.ok(usage, 'usage doc must be written by evaluateInterviewResponseCore itself');
  assert.equal(usage.interviewTestsUsed, 1);
  assert.deepEqual(usage.recordedSubmissionIds, [SESSION_ID], 'idempotency key must be the sessionId, not the responseId');
});

test('evaluateInterviewResponseCore does not double-charge a second response evaluated in the same session', async () => {
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const db = makeFakeDb(
    baseFixtures({
      'interview_responses/resp2': { userId: UID, sessionId: SESSION_ID, questionId: 'q2', responseText: 'second answer', olqScores: {} },
      [`users/${UID}/subscription/usage_${month}`]: { interviewTestsUsed: 1, recordedSubmissionIds: [SESSION_ID] }
    })
  );
  await evaluateInterviewResponseCore(db, UID, 'resp2', SESSION_ID, async () => arrayResponse([{ olq: 'COURAGE', score: 5, reasoning: 'r' }], { overallConfidence: 70 }));

  assert.equal(db._store[`users/${UID}/subscription/usage_${month}`].interviewTestsUsed, 1, 'a second response in the same session must not re-charge quota');
});

test('evaluateInterviewResponseCore charges the session quota slot even when the Gemini response never parses (FAILED) -- the session attempt is spent regardless of Gemini outcome', async () => {
  const db = makeFakeDb(baseFixtures());
  const result = await evaluateInterviewResponseCore(db, UID, 'resp1', SESSION_ID, async () => 'not json at all', async () => {});

  assert.equal(result.success, false);
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  assert.equal(db._store[`users/${UID}/subscription/usage_${month}`].interviewTestsUsed, 1);
});

test('evaluateInterviewResponseCore rejects with resource-exhausted when a NEW session would exceed quota', async () => {
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  process.env.ENFORCE_QUOTA = 'true';
  try {
    const db = makeFakeDb(
      baseFixtures({
        [`users/${UID}/subscription/usage_${month}`]: { interviewTestsUsed: 1, recordedSubmissionIds: ['other-session'] }
      })
    );
    await assert.rejects(
      () => evaluateInterviewResponseCore(db, UID, 'resp1', SESSION_ID, async () => arrayResponse([{ olq: 'COURAGE', score: 5, reasoning: 'r' }])),
      (err) => {
        assert.equal(err.code, 'resource-exhausted');
        return true;
      }
    );
  } finally {
    delete process.env.ENFORCE_QUOTA;
  }
});
