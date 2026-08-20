/**
 * Dual-Platform Subscription Billing Hardening plan, Phase F: tests for
 * `src/subscriptions/scheduledSubscriptionReconciliation.js`.
 *
 * The fake `collectionGroup` below applies each `.where()` with real Firestore inequality
 * semantics (a filtered field that's missing on a doc excludes that doc, same as production) --
 * this is what makes the "profile docs never match" assertion below meaningful rather than
 * assumed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  reconcileStaleSubscriptions,
  shouldReconcile,
  BATCH_SIZE,
  MAX_BATCHES_PER_RUN
} = require('../src/subscriptions/scheduledSubscriptionReconciliation');
const { __resetDedupeForTests } = require('../src/lib/opsAlert');

function applyWhere(docs, field, op, value) {
  return docs.filter(([, data]) => {
    if (!(field in data)) return false; // missing field never matches any filter -- real Firestore semantics
    if (op === '==') return data[field] === value;
    if (op === '!=') return data[field] !== value;
    if (op === '<') return data[field] < value;
    throw new Error(`unsupported op ${op}`);
  });
}

function makeFakeDb(seedDocs) {
  const docs = new Map(Object.entries(seedDocs));
  const opsAlerts = [];

  function docRef(id) {
    return {
      id,
      async set(value, options) {
        const existing = options?.merge ? docs.get(id) || {} : {};
        docs.set(id, { ...existing, ...value });
      }
    };
  }

  return {
    collection(name) {
      if (name === 'ops_alerts') {
        return { add: async (doc) => { opsAlerts.push(doc); } };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    collectionGroup(name) {
      if (name !== 'data') throw new Error(`unexpected collectionGroup: ${name}`);
      const filters = [];
      let limitCount = null;
      const query = {
        where(field, op, value) {
          filters.push([field, op, value]);
          return query;
        },
        limit(n) {
          limitCount = n;
          return query;
        },
        async get() {
          let matches = Array.from(docs.entries());
          for (const [field, op, value] of filters) {
            matches = applyWhere(matches, field, op, value);
          }
          if (limitCount != null) {
            matches = matches.slice(0, limitCount);
          }
          return {
            docs: matches.map(([id, data]) => ({ id, data: () => data, ref: docRef(id) }))
          };
        }
      };
      return query;
    },
    _docs: docs,
    _opsAlerts: opsAlerts
  };
}

const NOW = 1_700_000_000_000;

test('shouldReconcile is true only for a non-FREE tier with a past numeric expiryDate', () => {
  assert.equal(shouldReconcile({ tier: 'PRO', expiryDate: NOW - 1 }, NOW), true);
  assert.equal(shouldReconcile({ tier: 'FREE', expiryDate: NOW - 1 }, NOW), false);
  assert.equal(shouldReconcile({ tier: 'PRO', expiryDate: NOW + 1 }, NOW), false);
  assert.equal(shouldReconcile({ tier: 'PRO', expiryDate: null }, NOW), false, 'legacy grandfathered doc (no expiryDate) must not be touched');
  assert.equal(shouldReconcile({ tier: 'PRO' }, NOW), false, 'missing expiryDate entirely must not be touched');
});

test('reconcileStaleSubscriptions downgrades a stale subscription doc to FREE and resets its metadata', async () => {
  const db = makeFakeDb({
    'users/u1/data/subscription': {
      tier: 'PRO',
      source: 'RAZORPAY',
      billingCycle: 'MONTHLY',
      expiryDate: NOW - 1000,
      willRenew: true,
      billingIssueAt: NOW - 5000
    }
  });

  const result = await reconcileStaleSubscriptions(db, NOW);

  assert.equal(result.reconciledCount, 1);
  const updated = db._docs.get('users/u1/data/subscription');
  assert.equal(updated.tier, 'FREE');
  assert.equal(updated.willRenew, false);
  assert.equal(updated.billingIssueAt, null);
  assert.ok('reconciledAt' in updated);
  assert.equal(updated.source, 'RAZORPAY', 'source is left as historical record, not cleared');
});

test('reconcileStaleSubscriptions leaves a subscription with a future expiryDate untouched', async () => {
  const db = makeFakeDb({
    'users/u1/data/subscription': { tier: 'PREMIUM', billingCycle: 'MONTHLY', expiryDate: NOW + 100000 }
  });

  const result = await reconcileStaleSubscriptions(db, NOW);

  assert.equal(result.reconciledCount, 0);
  assert.equal(db._docs.get('users/u1/data/subscription').tier, 'PREMIUM');
});

test('reconcileStaleSubscriptions leaves a legacy grandfathered doc (no expiryDate) untouched', async () => {
  const db = makeFakeDb({
    'users/u1/data/subscription': { tier: 'PRO', billingCycle: 'MONTHLY', source: 'RAZORPAY' }
  });

  const result = await reconcileStaleSubscriptions(db, NOW);

  assert.equal(result.reconciledCount, 0);
  assert.equal(db._docs.get('users/u1/data/subscription').tier, 'PRO');
});

test('reconcileStaleSubscriptions never matches a profile doc sharing the same "data" subcollection', async () => {
  // GitLiveUserProfileRepository writes profile docs into the same users/{uid}/data/{doc}
  // subcollection -- this doc has no `billingCycle` field at all, so it must be excluded by
  // the query's scoping filter before tier/expiryDate are even considered, even though it
  // happens to have an unrelated field that could coincidentally look tier-like.
  const db = makeFakeDb({
    'users/u1/data/profile': { displayName: 'Cadet', tier: 'not-a-real-tier-field', expiryDate: NOW - 1 }
  });

  const result = await reconcileStaleSubscriptions(db, NOW);

  assert.equal(result.reconciledCount, 0);
  assert.deepEqual(db._docs.get('users/u1/data/profile'), { displayName: 'Cadet', tier: 'not-a-real-tier-field', expiryDate: NOW - 1 });
});

test('reconcileStaleSubscriptions returns reconciledCount: 0 when nothing is stale', async () => {
  const db = makeFakeDb({});
  const result = await reconcileStaleSubscriptions(db, NOW);
  assert.equal(result.reconciledCount, 0);
});

test('reconcileStaleSubscriptions sweeps multiple stale docs across different users', async () => {
  const db = makeFakeDb({
    'users/u1/data/subscription': { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: NOW - 1 },
    'users/u2/data/subscription': { tier: 'BASIC', billingCycle: 'MONTHLY', expiryDate: NOW - 1 },
    'users/u3/data/subscription': { tier: 'PREMIUM', billingCycle: 'MONTHLY', expiryDate: NOW + 1 }
  });

  const result = await reconcileStaleSubscriptions(db, NOW);

  assert.equal(result.reconciledCount, 2);
  assert.equal(db._docs.get('users/u1/data/subscription').tier, 'FREE');
  assert.equal(db._docs.get('users/u2/data/subscription').tier, 'FREE');
  assert.equal(db._docs.get('users/u3/data/subscription').tier, 'PREMIUM');
});

test('BATCH_SIZE and MAX_BATCHES_PER_RUN are sane, bounded production defaults', () => {
  assert.ok(Number.isInteger(BATCH_SIZE) && BATCH_SIZE > 0);
  assert.ok(Number.isInteger(MAX_BATCHES_PER_RUN) && MAX_BATCHES_PER_RUN > 0);
});

test('reconcileStaleSubscriptions queries in pages bounded by batchSize (no unbounded single query)', async () => {
  // 5 stale docs, batchSize 2 -- must take 3 pages (2 + 2 + 1) to drain, not one big query.
  const seed = {};
  for (let i = 0; i < 5; i++) {
    seed[`users/u${i}/data/subscription`] = { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: NOW - 1 };
  }
  const db = makeFakeDb(seed);

  const result = await reconcileStaleSubscriptions(db, NOW, { batchSize: 2, maxBatches: 10 });

  assert.equal(result.reconciledCount, 5);
  assert.equal(result.completed, true);
  for (let i = 0; i < 5; i++) {
    assert.equal(db._docs.get(`users/u${i}/data/subscription`).tier, 'FREE');
  }
});

test('reconcileStaleSubscriptions stops after maxBatches and reports completed: false when more stale docs remain', async () => {
  // 6 stale docs, batchSize 2, maxBatches 2 -- caps this invocation's work at 4 docs, leaving 2
  // stale docs unprocessed rather than risking an unbounded single-invocation sweep that could
  // time out or OOM under an extended webhook-outage backlog of thousands of users.
  const seed = {};
  for (let i = 0; i < 6; i++) {
    seed[`users/u${i}/data/subscription`] = { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: NOW - 1 };
  }
  const db = makeFakeDb(seed);

  const result = await reconcileStaleSubscriptions(db, NOW, { batchSize: 2, maxBatches: 2 });

  assert.equal(result.reconciledCount, 4, 'bounded to batchSize * maxBatches this invocation');
  assert.equal(result.completed, false);
  const remainingStale = Array.from(db._docs.values()).filter((d) => d.tier === 'PRO').length;
  assert.equal(remainingStale, 2);
});

test('reconcileStaleSubscriptions self-resumes on the next invocation without re-scanning already-fixed docs (implicit checkpoint)', async () => {
  // Simulates two consecutive scheduled cron ticks against a backlog too large for one run.
  // No explicit checkpoint doc/cursor state is needed: docs fixed in run 1 flip to tier=FREE,
  // which drops them out of the `tier != 'FREE'` filter, so run 2's query naturally picks up
  // only what's left -- this is the "checkpointing" behavior, implemented via the write itself
  // rather than separate cursor state.
  const seed = {};
  for (let i = 0; i < 6; i++) {
    seed[`users/u${i}/data/subscription`] = { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: NOW - 1 };
  }
  const db = makeFakeDb(seed);

  const run1 = await reconcileStaleSubscriptions(db, NOW, { batchSize: 2, maxBatches: 2 });
  assert.equal(run1.completed, false);
  assert.equal(run1.reconciledCount, 4);

  const run2 = await reconcileStaleSubscriptions(db, NOW, { batchSize: 2, maxBatches: 2 });
  assert.equal(run2.completed, true);
  assert.equal(run2.reconciledCount, 2, 'only the remaining 2 docs left over from run 1');

  for (let i = 0; i < 6; i++) {
    assert.equal(db._docs.get(`users/u${i}/data/subscription`).tier, 'FREE');
  }
});

test('reconcileStaleSubscriptions emits exactly one RECONCILIATION_CORRECTION alert per run when it corrects something, none when it does not', async () => {
  __resetDedupeForTests();

  const nothingToDo = makeFakeDb({});
  await reconcileStaleSubscriptions(nothingToDo, NOW);
  assert.equal(nothingToDo._opsAlerts.length, 0, 'a no-op run must not alert -- that would be noise, not a signal');

  __resetDedupeForTests();

  const staleDocs = makeFakeDb({
    'users/u1/data/subscription': { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: NOW - 1 },
    'users/u2/data/subscription': { tier: 'BASIC', billingCycle: 'MONTHLY', expiryDate: NOW - 1 }
  });
  const result = await reconcileStaleSubscriptions(staleDocs, NOW);

  assert.equal(result.reconciledCount, 2);
  assert.equal(staleDocs._opsAlerts.length, 1, 'one alert for the whole run, not one per corrected doc');
  assert.equal(staleDocs._opsAlerts[0].kind, 'RECONCILIATION_CORRECTION');
  assert.equal(staleDocs._opsAlerts[0].severity, 'INFO', 'a completed run is informational, not urgent');
  assert.deepEqual(staleDocs._opsAlerts[0].detail, { reconciledCount: 2, completed: true });
});

test('reconcileStaleSubscriptions alerts HIGH severity when maxBatches caps the run (more stale docs remain)', async () => {
  __resetDedupeForTests();

  const seed = {};
  for (let i = 0; i < 6; i++) {
    seed[`users/u${i}/data/subscription`] = { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: NOW - 1 };
  }
  const db = makeFakeDb(seed);

  const result = await reconcileStaleSubscriptions(db, NOW, { batchSize: 2, maxBatches: 2 });

  assert.equal(result.completed, false);
  assert.equal(db._opsAlerts.length, 1);
  assert.equal(db._opsAlerts[0].severity, 'HIGH', 'more stale docs remain after this run -- worth surfacing sooner than the next scheduled tick');
  assert.deepEqual(db._opsAlerts[0].detail, { reconciledCount: 4, completed: false });
});
