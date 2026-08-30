/**
 * Phase 7 (Payment Ecosystem Hardening plan): tests for
 * `src/subscriptions/repairMobileEntitlement.js`. The SECURITY LANDMINE this file exists to close
 * (the plan's own words): this callable must never trust the client's claim of entitlement --
 * only what a fake RevenueCat REST response confirms may ever be written. Every test that could
 * plausibly grant something is written to prove that, not just the happy path.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  repairMobileEntitlement,
  repairMobileEntitlementForUser,
  fetchRevenueCatSubscriberState
} = require('../src/subscriptions/repairMobileEntitlement');
const { HOURLY_ENTITLEMENT_REPAIR_LIMIT } = require('../src/lib/subscriptionRateLimit');

let uidCounter = 0;
function uniqueUid(label) {
  uidCounter += 1;
  return `${label}-${Date.now()}-${uidCounter}`;
}

function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  const opsAlerts = [];

  function docRef(path) {
    return {
      async get() {
        const data = store.get(path);
        return { exists: data !== undefined, data: () => data };
      },
      async set(value, options) {
        const existing = options?.merge ? store.get(path) || {} : {};
        store.set(path, { ...existing, ...value });
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
          doc: (uid) => ({
            collection: (sub) => ({
              doc: (id) => docRef(`users/${uid}/${sub}/${id}`)
            })
          })
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    async runTransaction(fn) {
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, value, options) => ref.set(value, options)
      };
      return fn(tx);
    },
    _store: store,
    _opsAlerts: opsAlerts
  };
}

/** entitlements: `{ [entitlementId]: { expires_date: ISO string | null } }` */
function makeFakeRevenueCatFetch(entitlements) {
  return async () => ({ ok: true, json: async () => ({ subscriber: { entitlements } }) });
}

test('repairMobileEntitlement rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => repairMobileEntitlement.run({}, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('repairMobileEntitlement has a maxInstances cap set (DoW defense, mirrors the other subscription callables)', () => {
  assert.equal(
    repairMobileEntitlement.__trigger?.maxInstances ?? repairMobileEntitlement.__endpoint?.maxInstances,
    10
  );
});

test('repairMobileEntitlement rejects once the hourly per-user cap is reached (via the real module db, live-hitting)', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  const uid = `repair-rate-limit-test-${Date.now()}`;
  try {
    for (let i = 0; i < HOURLY_ENTITLEMENT_REPAIR_LIMIT; i++) {
      const result = await repairMobileEntitlement.run({}, { auth: { uid } });
      assert.equal(result.repaired, false, 'no REVENUECAT_SECRET_KEY set -- emulator fallback reports nothing to repair');
    }
    await assert.rejects(
      () => repairMobileEntitlement.run({}, { auth: { uid } }),
      (err) => {
        assert.equal(err.code, 'resource-exhausted');
        return true;
      }
    );
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('fetchRevenueCatSubscriberState reduces an RC subscriber response to {status, tier, expiryDate}', async () => {
  const now = 1_700_000_000_000;
  const fetchImpl = makeFakeRevenueCatFetch({ pro: { expires_date: new Date(now + 100000).toISOString() } });
  const state = await fetchRevenueCatSubscriberState(fetchImpl, 'sk_test', 'user-1', now);
  assert.deepEqual(state, { status: 'ACTIVE', tier: 'PRO', expiryDate: now + 100000 });
});

test('fetchRevenueCatSubscriberState reports NONE/FREE when every entitlement has expired', async () => {
  const now = 1_700_000_000_000;
  const fetchImpl = makeFakeRevenueCatFetch({ pro: { expires_date: new Date(now - 1000).toISOString() } });
  const state = await fetchRevenueCatSubscriberState(fetchImpl, 'sk_test', 'user-1', now);
  assert.deepEqual(state, { status: 'NONE', tier: 'FREE', expiryDate: null });
});

test('fetchRevenueCatSubscriberState throws on a non-OK response (fails closed, not silently FREE)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(() => fetchRevenueCatSubscriberState(fetchImpl, 'sk_test', 'user-1'));
});

test('repairMobileEntitlementForUser writes the RC-confirmed tier on the happy path and emits exactly one alert', async () => {
  const db = makeFakeDb({});
  const now = Date.now();
  const fetchImpl = makeFakeRevenueCatFetch({ pro: { expires_date: new Date(now + 500000).toISOString() } });

  const result = await repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user-1');

  assert.equal(result.repaired, true);
  assert.equal(result.tier, 'PRO');
  const written = db._store.get('users/user-1/data/subscription');
  assert.equal(written.tier, 'PRO');
  assert.equal(written.billingCycle, 'MONTHLY');
  assert.equal(written.source, 'REVENUECAT');
  assert.equal(db._opsAlerts.length, 1);
  assert.equal(db._opsAlerts[0].kind, 'DRIFT_REPAIR');
});

test('repairMobileEntitlementForUser writes nothing when RC and Firestore already agree', async () => {
  const now = Date.now();
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'PRO', billingCycle: 'MONTHLY', expiryDate: now + 500000, source: 'REVENUECAT' }
  });
  const fetchImpl = makeFakeRevenueCatFetch({ pro: { expires_date: new Date(now + 500000).toISOString() } });

  const result = await repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user-1');

  assert.equal(result.repaired, false);
  assert.equal(db._opsAlerts.length, 0);
});

test('repairMobileEntitlementForUser fails closed (internal) on a RevenueCat API error, and writes nothing', async () => {
  const db = makeFakeDb({});
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

  await assert.rejects(
    () => repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user-1'),
    (err) => {
      assert.equal(err.code, 'internal');
      return true;
    }
  );
  assert.equal(db._store.size, 0);
});

test('repairMobileEntitlementForUser: a client claiming PREMIUM while RevenueCat reports none writes nothing and emits a distinct C1-regression alert (SECURITY LANDMINE)', async () => {
  const db = makeFakeDb({});
  const fetchImpl = makeFakeRevenueCatFetch({}); // RC confirms no active entitlement at all

  await assert.rejects(
    () => repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user-1', 'PREMIUM'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
  assert.equal(db._store.size, 0, 'no write happened -- the client claim was never trusted');
  assert.equal(db._opsAlerts.length, 1);
  assert.equal(db._opsAlerts[0].kind, 'DRIFT_REPAIR_REJECTED', 'distinct from an ordinary DRIFT_REPAIR/NONE outcome');
});

test('repairMobileEntitlementForUser: a client claiming a tier higher than what RC actually confirms is rejected the same way (not just claiming vs. nothing)', async () => {
  const now = Date.now();
  const db = makeFakeDb({});
  const fetchImpl = makeFakeRevenueCatFetch({ basic: { expires_date: new Date(now + 500000).toISOString() } });

  await assert.rejects(
    () => repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user-1', 'PREMIUM'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
  assert.equal(db._store.size, 0);
});

test('repairMobileEntitlementForUser: an accurate claimedTier that RC also confirms proceeds normally (the guard only fires on a mismatch)', async () => {
  const now = Date.now();
  const db = makeFakeDb({});
  const fetchImpl = makeFakeRevenueCatFetch({ pro: { expires_date: new Date(now + 500000).toISOString() } });

  const result = await repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user-1', 'PRO');

  assert.equal(result.repaired, true);
  assert.equal(result.tier, 'PRO');
});

test('repairMobileEntitlementForUser flags (never silently overwrites) a stored tier already higher than RC confirms', async () => {
  const now = Date.now();
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'PREMIUM', billingCycle: 'MONTHLY', expiryDate: now + 500000, source: 'RAZORPAY' }
  });
  const fetchImpl = makeFakeRevenueCatFetch({ basic: { expires_date: new Date(now + 500000).toISOString() } });

  const result = await repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user-1');

  assert.equal(result.repaired, false);
  assert.equal(result.conflict, true);
  assert.equal(db._store.get('users/user-1/data/subscription').tier, 'PREMIUM');
  assert.equal(db._opsAlerts[0].kind, 'DRIFT_CONFLICT');
});
