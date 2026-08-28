/**
 * Phase 8 (ai_search_readiness plan): tests for `src/analytics/getAnalyticsSummary.js`. Same
 * priority order as `getSubscriptionSupportSnapshot.test.js`: the admin privilege boundary
 * first, then the aggregation itself.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { getAnalyticsSummary, getAnalyticsSummaryFromDb } = require('../src/analytics/getAnalyticsSummary');

function makeFakeDb(days = {}) {
  const store = new Map(Object.entries(days));
  return {
    collection(name) {
      if (name !== 'analytics_daily') throw new Error(`unexpected collection ${name}`);
      return {
        orderBy: () => ({
          async get() {
            const sortedIds = [...store.keys()].sort();
            return {
              docs: sortedIds.map((id) => ({ id, data: () => store.get(id) }))
            };
          }
        })
      };
    }
  };
}

test('getAnalyticsSummary rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => getAnalyticsSummary.run({}, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('getAnalyticsSummary rejects an authenticated caller without the admin claim', async () => {
  await assert.rejects(
    () => getAnalyticsSummary.run({}, { auth: { uid: 'not-an-admin', token: {} } }),
    (err) => {
      assert.equal(err.code, 'permission-denied');
      return true;
    }
  );
});

test('getAnalyticsSummaryFromDb returns an empty summary when no day docs exist yet (nothing instrumented so far)', async () => {
  const db = makeFakeDb();
  const summary = await getAnalyticsSummaryFromDb(db);
  assert.deepEqual(summary, { days: [], totalSignups: 0, sinceDate: null });
});

test('getAnalyticsSummaryFromDb sums signups across days and reports the earliest date as sinceDate', async () => {
  const db = makeFakeDb({
    '2026-08-27': { signups: 2 },
    '2026-08-28': { signups: 5 },
    '2026-08-29': { signups: 1 }
  });
  const summary = await getAnalyticsSummaryFromDb(db);
  assert.equal(summary.totalSignups, 8);
  assert.equal(summary.sinceDate, '2026-08-27');
  assert.deepEqual(summary.days, [
    { date: '2026-08-27', signups: 2 },
    { date: '2026-08-28', signups: 5 },
    { date: '2026-08-29', signups: 1 }
  ]);
});

test('getAnalyticsSummaryFromDb treats a doc with no signups field as 0, rather than crashing', async () => {
  const db = makeFakeDb({ '2026-08-29': {} });
  const summary = await getAnalyticsSummaryFromDb(db);
  assert.deepEqual(summary.days, [{ date: '2026-08-29', signups: 0 }]);
  assert.equal(summary.totalSignups, 0);
});
