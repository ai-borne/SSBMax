/**
 * Interview session/result server-migration plan (Phase 1): tests for
 * `src/interview/createInterviewSession.js`. Verifies the fix for the PERMISSION_DENIED bug
 * (client used to write `interview_questions`/`interview_sessions` directly, blocked by
 * `firestore.rules`'s `allow write: if false`) by asserting this callable does the writes
 * server-side, charges quota once per session, and falls through cache -> AI -> static
 * fallback exactly like `InterviewQuestionGenerator.kt`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createInterviewSessionCore, resolvePiqContext } = require('../src/interview/createInterviewSession');

/** Same fake-db shape as interviewEvaluate.test.js/evaluationCore.test.js. */
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

const UID = 'user1';

function baseFixtures(overrides = {}) {
  return {
    [`users/${UID}/data/subscription`]: { tier: 'PRO' },
    ...overrides
  };
}

let idCounter;
function makeIdFn() {
  idCounter = 0;
  return () => `id-${idCounter++}`;
}

/** No cache/AI results by default -- forces the static-fallback tier. */
function noCacheNoAiDeps(overrides = {}) {
  return {
    newIdFn: makeIdFn(),
    getCachedPIQQuestionsFn: async () => [],
    getGenericQuestionsFn: async () => [],
    resolvePiqContextFn: async () => '',
    generateContentFn: async () => {
      throw new Error('no Gemini in this test');
    },
    ...overrides
  };
}

test('createInterviewSessionCore rejects a missing piqSnapshotId', async () => {
  const db = makeFakeDb(baseFixtures());
  await assert.rejects(
    () => createInterviewSessionCore(db, UID, { mode: 'VOICE_BASED', piqSnapshotId: '', consentGiven: true }, noCacheNoAiDeps()),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});

test('createInterviewSessionCore rejects an invalid mode', async () => {
  const db = makeFakeDb(baseFixtures());
  await assert.rejects(
    () => createInterviewSessionCore(db, UID, { mode: 'NOT_A_MODE', piqSnapshotId: 'piq1', consentGiven: true }, noCacheNoAiDeps()),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});

test('createInterviewSessionCore writes interview_sessions and interview_questions server-side (the PERMISSION_DENIED fix)', async () => {
  const db = makeFakeDb(baseFixtures());
  const { session, questions } = await createInterviewSessionCore(
    db,
    UID,
    { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true },
    noCacheNoAiDeps()
  );

  assert.equal(session.userId, UID);
  assert.equal(session.status, 'IN_PROGRESS');
  assert.equal(session.questionIds.length, questions.length);
  assert.equal(db._store[`interview_sessions/${session.id}`].id, session.id);
  questions.forEach((q) => {
    assert.ok(db._store[`interview_questions/${q.id}`], `question ${q.id} must be written to interview_questions`);
  });
});

test('createInterviewSessionCore falls back to the static question list when cache and AI both come up empty', async () => {
  const db = makeFakeDb(baseFixtures());
  const { questions } = await createInterviewSessionCore(db, UID, { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true }, noCacheNoAiDeps());
  assert.equal(questions.length, 25, 'must still produce the full TARGET_TOTAL_QUESTIONS count via static fallback');
  questions.forEach((q) => assert.equal(q.source, 'GENERIC_POOL'));
});

test('createInterviewSessionCore prefers cached questions over AI/fallback when the cache already has enough', async () => {
  const cached = Array.from({ length: 25 }, (_, i) => ({ id: `cached-${i}`, questionText: `Q${i}`, targetOLQs: ['COURAGE'], context: null, source: 'PIQ_BASED' }));
  const db = makeFakeDb(baseFixtures());
  let aiCalled = false;
  const { questions } = await createInterviewSessionCore(
    db,
    UID,
    { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true },
    noCacheNoAiDeps({
      getCachedPIQQuestionsFn: async () => cached,
      generateContentFn: async () => {
        aiCalled = true;
        return '[]';
      }
    })
  );
  assert.equal(questions.length, 25);
  assert.equal(aiCalled, false, 'AI must not be called when the cache alone already satisfies the target count');
});

test('createInterviewSessionCore uses Gemini-generated questions to fill the gap when cache is short, and caches them', async () => {
  const db = makeFakeDb(baseFixtures());
  let cachedQuestions = null;
  const aiPayload = JSON.stringify(
    Array.from({ length: 25 }, (_, i) => ({ questionText: `AI question ${i}`, targetOLQs: ['COURAGE', 'STAMINA'] }))
  );
  const { questions } = await createInterviewSessionCore(
    db,
    UID,
    { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true },
    noCacheNoAiDeps({
      resolvePiqContextFn: async () => 'candidate PIQ text',
      generateContentFn: async () => aiPayload,
      cachePIQQuestionsFn: async (_db, _piqId, qs) => {
        cachedQuestions = qs;
      }
    })
  );
  assert.equal(questions.length, 25);
  assert.ok(questions.every((q) => q.source === 'AI_GENERATED'));
  assert.ok(cachedQuestions && cachedQuestions.length === 25, 'AI-generated questions must be cached for future sessions');
});

test('createInterviewSessionCore ignores unknown OLQ ids returned by Gemini but keeps the question', async () => {
  const db = makeFakeDb(baseFixtures());
  const aiPayload = JSON.stringify([{ questionText: 'A question', targetOLQs: ['NOT_A_REAL_OLQ', 'COURAGE'] }]);
  const { questions } = await createInterviewSessionCore(
    db,
    UID,
    { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true },
    noCacheNoAiDeps({ resolvePiqContextFn: async () => 'ctx', generateContentFn: async () => aiPayload })
  );
  const aiQuestion = questions.find((q) => q.source === 'AI_GENERATED');
  assert.ok(aiQuestion);
  assert.deepEqual(aiQuestion.targetOLQs, ['COURAGE']);
});

test('createInterviewSessionCore charges the usage counter exactly once, keyed by the new sessionId', async () => {
  const db = makeFakeDb(baseFixtures());
  const { session } = await createInterviewSessionCore(db, UID, { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true }, noCacheNoAiDeps());

  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const usage = db._store[`users/${UID}/subscription/usage_${month}`];
  assert.ok(usage);
  assert.equal(usage.interviewTestsUsed, 1);
  assert.deepEqual(usage.recordedSubmissionIds, [session.id]);
});

test('createInterviewSessionCore rejects with resource-exhausted when the user is already at their monthly interview quota', async () => {
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  process.env.ENFORCE_QUOTA = 'true';
  try {
    const db = makeFakeDb(baseFixtures({ [`users/${UID}/subscription/usage_${month}`]: { interviewTestsUsed: 3, recordedSubmissionIds: ['s1', 's2', 's3'] } }));
    await assert.rejects(
      () => createInterviewSessionCore(db, UID, { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true }, noCacheNoAiDeps()),
      (err) => {
        assert.equal(err.code, 'resource-exhausted');
        return true;
      }
    );
  } finally {
    delete process.env.ENFORCE_QUOTA;
  }
});

/**
 * resolvePiqContext: server-side PIQ resolution (closes the client-supplied-piqContext gap).
 */

test('resolvePiqContext returns "" (not an error) when the PIQ submission does not exist', async () => {
  const db = makeFakeDb(baseFixtures());
  const context = await resolvePiqContext(db, UID, 'missing-piq');
  assert.equal(context, '');
});

test('resolvePiqContext returns "" when the submission exists but belongs to a different user (ownership check)', async () => {
  const db = makeFakeDb(baseFixtures({ 'submissions/piq1': { userId: 'someone-else', testType: 'PIQ', data: { fullName: 'Not Yours' } } }));
  const context = await resolvePiqContext(db, UID, 'piq1');
  assert.equal(context, '');
});

test('resolvePiqContext builds the PIQ context from the caller\'s own submission', async () => {
  const db = makeFakeDb(baseFixtures({ 'submissions/piq1': { userId: UID, testType: 'PIQ', data: { fullName: 'Rahul Sharma' } } }));
  const context = await resolvePiqContext(db, UID, 'piq1');
  assert.match(context, /Name: Rahul Sharma/);
});

test('createInterviewSessionCore resolves piqContext server-side from piqSnapshotId, not from client input (a client-supplied piqContext field is ignored)', async () => {
  const db = makeFakeDb(baseFixtures({ 'submissions/piq1': { userId: UID, testType: 'PIQ', data: { fullName: 'Server Resolved Name' } } }));
  let promptSeen = null;
  const aiPayload = JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ questionText: `AI question ${i}`, targetOLQs: ['COURAGE'] })));

  await createInterviewSessionCore(
    db,
    UID,
    { mode: 'VOICE_BASED', piqSnapshotId: 'piq1', consentGiven: true, piqContext: 'a client cannot inject this' },
    noCacheNoAiDeps({
      resolvePiqContextFn: undefined, // use the real resolvePiqContextFn wired via createInterviewSessionCore's default
      generateContentFn: async (prompt) => {
        promptSeen = prompt;
        return aiPayload;
      }
    })
  );

  assert.match(promptSeen, /Server Resolved Name/, 'the Gemini prompt must be built from the server-resolved PIQ context');
  assert.doesNotMatch(promptSeen, /a client cannot inject this/, 'a client-supplied piqContext field must never reach the prompt');
});
