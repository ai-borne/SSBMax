/**
 * Gemini Proxy Tests
 *
 * Runs via Node native test runner (node --test). Fakes the Firestore Admin
 * SDK transaction surface used by enforceRateLimit, matching the fake-db
 * pattern established in eligibility.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  currentHourKey,
  enforceRateLimit,
  validateRequest,
  HOURLY_REQUEST_LIMIT,
  MAX_PROMPT_CHARACTERS,
  geminiGenerateContent
} = require('../src/geminiProxy');

/**
 * In-memory fake standing in for admin.firestore(): supports the one doc
 * read/write enforceRateLimit needs (users/{uid}/aiUsage/{hourKey}).
 */
function makeFakeDb({ count = null } = {}) {
  const writes = [];
  const state = { count };

  function docRef() {
    return {
      async get() {
        return { exists: state.count !== null, data: () => ({ count: state.count }) };
      },
      set(value) {
        writes.push(value);
        state.count = value.count;
      }
    };
  }

  function collection() {
    return {
      doc: () => ({
        collection: () => ({
          doc: () => docRef()
        })
      })
    };
  }

  return {
    collection,
    async runTransaction(fn) {
      const tx = { get: (ref) => ref.get(), set: (ref, value) => ref.set(value) };
      return fn(tx);
    },
    _writes: writes
  };
}

test('currentHourKey is UTC-based and hour-granular', () => {
  const key = currentHourKey();
  assert.match(key, /^\d{4}-\d{2}-\d{2}-\d{2}$/, 'expected yyyy-MM-dd-HH format');
});

test('enforceRateLimit allows the first call in a fresh hour and starts the counter at 1', async () => {
  const db = makeFakeDb({ count: null });
  const result = await enforceRateLimit(db, 'user1');
  assert.equal(result, 1);
  assert.equal(db._writes.at(-1).count, 1);
});

test('enforceRateLimit rejects once the hourly cap is reached', async () => {
  const db = makeFakeDb({ count: HOURLY_REQUEST_LIMIT });
  await assert.rejects(
    () => enforceRateLimit(db, 'user1'),
    (err) => {
      assert.equal(err.code, 'resource-exhausted');
      return true;
    }
  );
});

test('validateRequest rejects a missing prompt', () => {
  assert.throws(() => validateRequest({}), (err) => {
    assert.equal(err.code, 'invalid-argument');
    return true;
  });
});

test('validateRequest rejects an oversized prompt', () => {
  const hugePrompt = 'a'.repeat(MAX_PROMPT_CHARACTERS + 1);
  assert.throws(() => validateRequest({ prompt: hugePrompt }), (err) => {
    assert.equal(err.code, 'invalid-argument');
    return true;
  });
});

test('validateRequest accepts a well-formed request with no image', () => {
  assert.doesNotThrow(() => validateRequest({ prompt: 'Analyze this response.' }));
});

test('geminiGenerateContent rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => geminiGenerateContent.run({ prompt: 'hello' }, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});
