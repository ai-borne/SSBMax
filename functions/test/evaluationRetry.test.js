/**
 * Phase 1 (Web SSB Test Flow Parity plan): retry/backoff tests for
 * `src/evaluation/retry.js`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextDelayMillis, minDelayMillis, maxDelayMillis, withRetry } = require('../src/evaluation/retry');

test('Phase 1: nextDelayMillis stays within [min,max] bounds at each attempt', () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = 0; i < 20; i++) {
      const delay = nextDelayMillis(attempt);
      assert.ok(delay >= minDelayMillis(attempt), `attempt ${attempt}: ${delay} >= ${minDelayMillis(attempt)}`);
      assert.ok(delay <= maxDelayMillis(attempt), `attempt ${attempt}: ${delay} <= ${maxDelayMillis(attempt)}`);
    }
  }
});

test('Phase 1: nextDelayMillis caps the exponential base at MAX_EXPONENTIAL_DELAY_MS', () => {
  // attempt 3 -> 1000*2^3=8000, already at the cap; attempt 10 must not exceed it either.
  assert.ok(maxDelayMillis(10) <= 8000 * 1.2);
});

test('Phase 1: nextDelayMillis throws for a negative attempt', () => {
  assert.throws(() => nextDelayMillis(-1));
});

test('Phase 1: withRetry returns the accepted result on the first attempt', async () => {
  let calls = 0;
  const result = await withRetry({
    call: async () => {
      calls++;
      return 'ok';
    },
    isAcceptable: (r) => r === 'ok',
    fillDefaults: (r) => r,
    delayFn: async () => {}
  });
  assert.equal(result, 'ok');
  assert.equal(calls, 1);
});

test('Phase 1: withRetry retries past a rejected result and succeeds later', async () => {
  let calls = 0;
  const result = await withRetry({
    maxAttempts: 3,
    call: async () => {
      calls++;
      return calls < 3 ? 'not-yet' : 'ok';
    },
    isAcceptable: (r) => r === 'ok',
    fillDefaults: (r) => r,
    delayFn: async () => {}
  });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('Phase 1: withRetry swallows a thrown error and retries', async () => {
  let calls = 0;
  const result = await withRetry({
    maxAttempts: 2,
    call: async () => {
      calls++;
      if (calls === 1) throw new Error('transient Gemini failure');
      return 'ok';
    },
    isAcceptable: (r) => r === 'ok',
    fillDefaults: (r) => r,
    delayFn: async () => {}
  });
  assert.equal(result, 'ok');
  assert.equal(calls, 2);
});

test('Phase 1: withRetry returns null after exhausting maxAttempts', async () => {
  let calls = 0;
  const result = await withRetry({
    maxAttempts: 3,
    call: async () => {
      calls++;
      return 'never-acceptable';
    },
    isAcceptable: () => false,
    fillDefaults: (r) => r,
    delayFn: async () => {}
  });
  assert.equal(result, null);
  assert.equal(calls, 3);
});
