/**
 * Phase 7 (Payment Ecosystem Hardening plan): tests for
 * `src/subscriptions/scheduledRazorpayDriftSweep.js`. A fake Firestore (dotted-key convention,
 * mirroring `razorpaySubscriptionWebhooks.test.js`) plus a fake `fetch` standing in for Razorpay's
 * `GET /v1/subscriptions` list call (no `status` filter -- see `toProviderState`'s tests below for
 * why) -- no live network, no emulator.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sweepRazorpayDrift,
  toProviderState,
  PAGE_SIZE,
  MAX_PAGES_PER_RUN
} = require('../src/subscriptions/scheduledRazorpayDriftSweep');

const NOW = 1_700_000_000_000;
const CREDS = { keyId: 'rzp_test_key', keySecret: 'test_secret' };

function makeFakeDb(seedDocs = {}) {
  const docs = new Map(Object.entries(seedDocs));
  const opsAlerts = [];

  function subscriptionRef(userId) {
    const key = `users/${userId}/data/subscription`;
    return {
      async get() {
        const data = docs.get(key);
        return { exists: data !== undefined, data: () => data };
      },
      async set(value, options) {
        const existing = options?.merge ? docs.get(key) || {} : {};
        docs.set(key, { ...existing, ...value });
      }
    };
  }

  return {
    collection(name) {
      if (name === 'ops_alerts') {
        return { add: async (doc) => { opsAlerts.push(doc); } };
      }
      if (name === 'users') {
        return {
          doc: (userId) => ({
            collection: () => ({
              doc: () => subscriptionRef(userId)
            })
          })
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    _docs: docs,
    _opsAlerts: opsAlerts
  };
}

/** Fake fetch serving fixed pages of Razorpay's list-subscriptions response shape. */
function makeFakeFetch(pages) {
  return async (url) => {
    const skipMatch = /skip=(\d+)/.exec(url);
    const skip = skipMatch ? Number(skipMatch[1]) : 0;
    const page = pages[skip / PAGE_SIZE] || { items: [] };
    return { ok: true, json: async () => page };
  };
}

function activeSubEntity({ userId, planId = 'pro_monthly', currentEndSec }) {
  return { id: `sub_${userId}`, status: 'active', notes: { userId, planId }, current_end: currentEndSec };
}

test('toProviderState maps a Razorpay subscription entity via the shared planIdToTier, never a second hand-typed mapping', () => {
  const { userId, providerState } = toProviderState(activeSubEntity({ userId: 'u1', planId: 'premium_monthly', currentEndSec: 1_700_100_000 }));
  assert.equal(userId, 'u1');
  assert.deepEqual(providerState, { status: 'ACTIVE', tier: 'PREMIUM', expiryDate: 1_700_100_000_000, subscriptionId: 'sub_u1' });
});

test('toProviderState maps every non-"active" Razorpay status to UNKNOWN, since the list endpoint has no server-side status filter', () => {
  for (const status of ['created', 'authenticated', 'pending', 'halted', 'cancelled', 'completed', 'expired']) {
    const { providerState } = toProviderState({ id: 'sub_x', status, notes: { userId: 'u1', planId: 'pro_monthly' }, current_end: NOW / 1000 });
    assert.equal(providerState.status, 'UNKNOWN', `status=${status}`);
  }
});

test('sweepRazorpayDrift repairs a user Razorpay says is active but Firestore has as FREE (the "paid but locked out" case)', async () => {
  const db = makeFakeDb({});
  const fetchImpl = makeFakeFetch([{ items: [activeSubEntity({ userId: 'u1', currentEndSec: (NOW + 100000) / 1000 })] }]);

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW);

  assert.equal(result.repairedCount, 1);
  assert.equal(result.conflictCount, 0);
  const written = db._docs.get('users/u1/data/subscription');
  assert.equal(written.tier, 'PRO');
  assert.equal(written.billingCycle, 'MONTHLY');
  assert.equal(written.source, 'RAZORPAY');
  assert.equal(written.subscriptionId, 'sub_u1', 'a repaired doc must carry subscriptionId or getSubscriptionSupportSnapshot immediately flags it dataIncomplete/missing-subscription-id');
  assert.equal(db._opsAlerts.length, 1, 'every repair calls emitOpsAlert exactly once');
  assert.equal(db._opsAlerts[0].kind, 'DRIFT_REPAIR');
});

test('sweepRazorpayDrift is a no-op when Razorpay and Firestore already agree', async () => {
  const db = makeFakeDb({
    'users/u1/data/subscription': { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: NOW + 100000, source: 'RAZORPAY' }
  });
  const fetchImpl = makeFakeFetch([{ items: [activeSubEntity({ userId: 'u1', currentEndSec: (NOW + 100000) / 1000 })] }]);

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW);

  assert.equal(result.repairedCount, 0);
  assert.equal(db._opsAlerts.length, 0);
});

test('sweepRazorpayDrift flags (never silently overwrites) a user whose stored tier is already higher than what Razorpay reports', async () => {
  const db = makeFakeDb({
    'users/u1/data/subscription': { tier: 'PREMIUM', billingCycle: 'MONTHLY', expiryDate: NOW + 500000, source: 'REVENUECAT' }
  });
  const fetchImpl = makeFakeFetch([{ items: [activeSubEntity({ userId: 'u1', planId: 'basic_monthly', currentEndSec: (NOW + 100000) / 1000 })] }]);

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW);

  assert.equal(result.repairedCount, 0);
  assert.equal(result.conflictCount, 1);
  assert.equal(db._docs.get('users/u1/data/subscription').tier, 'PREMIUM', 'never silently downgraded');
  assert.equal(db._opsAlerts[0].kind, 'DRIFT_CONFLICT');
});

test('sweepRazorpayDrift ignores subscription entities with no notes.userId (nothing to act on)', async () => {
  const db = makeFakeDb({});
  const fetchImpl = makeFakeFetch([{ items: [{ id: 'sub_orphan', status: 'active', notes: {}, current_end: NOW / 1000 }] }]);

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW);

  assert.equal(result.repairedCount, 0);
  assert.equal(result.scannedCount, 0);
});

test('sweepRazorpayDrift skips a non-active subscription entity without ever reading Firestore for it (the list endpoint has no server-side status filter, so most returned entities are not active)', async () => {
  // A db whose `collection('users')` throws -- proves the non-active branch below returns before
  // ever attempting the per-user Firestore read `applyDrift`/`readStoredSubscription` would do.
  const db = {
    collection(name) {
      if (name === 'ops_alerts') return { add: async () => {} };
      throw new Error(`unexpected Firestore access for collection ${name} -- non-active entity should never reach this`);
    }
  };
  const fetchImpl = makeFakeFetch([
    { items: [{ id: 'sub_cancelled', status: 'cancelled', notes: { userId: 'u1', planId: 'pro_monthly' }, current_end: NOW / 1000 }] }
  ]);

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW);

  assert.equal(result.repairedCount, 0);
  assert.equal(result.scannedCount, 0, 'a non-active entity is not counted as scanned -- it was never considered for repair');
});

test('sweepRazorpayDrift paginates past a full first page to a shorter second page', async () => {
  const db = makeFakeDb({});
  const firstPageItems = [];
  for (let i = 0; i < PAGE_SIZE; i++) {
    firstPageItems.push(activeSubEntity({ userId: `full-${i}`, currentEndSec: (NOW + 100000) / 1000 }));
  }
  const secondPageItems = [activeSubEntity({ userId: 'u-last', currentEndSec: (NOW + 100000) / 1000 })];
  const fetchImpl = makeFakeFetch([{ items: firstPageItems }, { items: secondPageItems }]);

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW, { pageSize: PAGE_SIZE, maxPages: MAX_PAGES_PER_RUN });

  assert.equal(result.repairedCount, PAGE_SIZE + 1);
  assert.equal(result.completed, true);
  assert.ok(db._docs.get('users/u-last/data/subscription'));
});

test('sweepRazorpayDrift caps work at maxPages and reports completed: false when a full page was still returned', async () => {
  const db = makeFakeDb({});
  const pages = [];
  for (let p = 0; p < 3; p++) {
    const items = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      items.push(activeSubEntity({ userId: `p${p}-${i}`, currentEndSec: (NOW + 100000) / 1000 }));
    }
    pages.push({ items });
  }
  const fetchImpl = makeFakeFetch(pages);

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW, { pageSize: PAGE_SIZE, maxPages: 2 });

  assert.equal(result.repairedCount, PAGE_SIZE * 2);
  assert.equal(result.completed, false);
  assert.equal(result.aborted, false);
});

test('sweepRazorpayDrift aborts without writing anything once a Razorpay API call fails', async () => {
  const db = makeFakeDb({});
  const fetchImpl = async () => {
    throw new Error('simulated Razorpay outage');
  };

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW);

  assert.equal(result.aborted, true);
  assert.equal(result.repairedCount, 0);
  assert.equal(db._docs.size, 0);
  assert.equal(db._opsAlerts.length, 0);
});

test('sweepRazorpayDrift aborts on a Razorpay API failure on a later page without writing that page\'s repairs', async () => {
  const db = makeFakeDb({});
  const firstPageItems = [];
  for (let i = 0; i < PAGE_SIZE; i++) {
    firstPageItems.push(activeSubEntity({ userId: `ok-${i}`, currentEndSec: (NOW + 100000) / 1000 }));
  }
  let callCount = 0;
  const fetchImpl = async (url) => {
    callCount += 1;
    if (callCount === 1) {
      return { ok: true, json: async () => ({ items: firstPageItems }) };
    }
    throw new Error('simulated Razorpay outage on page 2');
  };

  const result = await sweepRazorpayDrift(db, fetchImpl, CREDS, NOW, { pageSize: PAGE_SIZE, maxPages: MAX_PAGES_PER_RUN });

  // First page's repairs already committed (each write is independent, same as the reconciliation
  // cron's "the persisted write is the checkpoint" stance) -- but nothing from the failed page.
  assert.equal(result.repairedCount, PAGE_SIZE);
  assert.equal(result.aborted, true);
});

test('PAGE_SIZE and MAX_PAGES_PER_RUN are sane, bounded production defaults', () => {
  assert.ok(Number.isInteger(PAGE_SIZE) && PAGE_SIZE > 0);
  assert.ok(Number.isInteger(MAX_PAGES_PER_RUN) && MAX_PAGES_PER_RUN > 0);
});
