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
const { reconcileStaleSubscriptions, shouldReconcile } = require('../src/subscriptions/scheduledSubscriptionReconciliation');

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
    collectionGroup(name) {
      if (name !== 'data') throw new Error(`unexpected collectionGroup: ${name}`);
      const filters = [];
      const query = {
        where(field, op, value) {
          filters.push([field, op, value]);
          return query;
        },
        async get() {
          let matches = Array.from(docs.entries());
          for (const [field, op, value] of filters) {
            matches = applyWhere(matches, field, op, value);
          }
          return {
            docs: matches.map(([id, data]) => ({ id, data: () => data, ref: docRef(id) }))
          };
        }
      };
      return query;
    },
    _docs: docs
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
