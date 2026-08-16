/**
 * Phase 10 (Web SSB Test Flow Parity plan): tests for `src/evaluation/concurrency.js`,
 * extracted from `tatEvaluate.js` to keep that file under the 300-LOC limit.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapWithConcurrency } = require('../src/evaluation/concurrency');

test('Phase 10: mapWithConcurrency preserves output order regardless of resolution order', async () => {
  const items = [30, 10, 20];
  const result = await mapWithConcurrency(items, 3, (ms) => new Promise((resolve) => setTimeout(() => resolve(ms), ms)));
  assert.deepEqual(result, [30, 10, 20]);
});

test('Phase 10: mapWithConcurrency never has more than `limit` calls in flight at once', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);
  await mapWithConcurrency(items, 5, async (i) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    return i;
  });
  assert.ok(maxInFlight <= 5, `expected at most 5 in flight, saw ${maxInFlight}`);
});

test('Phase 10: mapWithConcurrency processes every item exactly once', async () => {
  const items = Array.from({ length: 12 }, (_, i) => i);
  const seen = [];
  await mapWithConcurrency(items, 4, async (i) => {
    seen.push(i);
    return i * 2;
  });
  assert.deepEqual(seen.slice().sort((a, b) => a - b), items);
});

test('Phase 10: mapWithConcurrency handles an empty input list', async () => {
  const result = await mapWithConcurrency([], 5, async (i) => i);
  assert.deepEqual(result, []);
});
