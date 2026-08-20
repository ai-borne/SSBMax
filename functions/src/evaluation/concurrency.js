/**
 * Bounded-concurrency `Promise.all` helper (Phase 10, Web SSB Test Flow Parity plan).
 * Extracted out of `tatEvaluate.js` purely to keep that file under the repo's 300-LOC
 * limit -- generic enough that a later multi-call evaluation type (if one shows up)
 * can reuse it without duplicating the worker-pool loop.
 */

/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once, preserving
 * output order.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = {
  mapWithConcurrency
};
