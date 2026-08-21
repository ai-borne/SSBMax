/**
 * Phase 9 (Payment Ecosystem Hardening plan): tests for
 * `src/subscriptions/getSubscriptionSupportSnapshot.js`. The privilege boundary is the whole point
 * of this file existing -- a support tool that leaks another user's billing state to a non-admin
 * is a worse bug than the one this phase was built to fix, so that gets tested before anything
 * about the join itself. The degrade-gracefully behavior is tested second because a support tool
 * that goes dark exactly when Razorpay/RevenueCat is down is worthless.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getSubscriptionSupportSnapshot,
  getSubscriptionSupportSnapshotForUser,
  resolveUserId
} = require('../src/subscriptions/getSubscriptionSupportSnapshot');

function makeFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  const alerts = new Map(Object.entries(seed.__alerts || {}));

  function docRef(path) {
    return {
      async get() {
        const data = store.get(path);
        return { exists: data !== undefined, data: () => data };
      }
    };
  }

  return {
    collection(name) {
      if (name === 'ops_alerts') {
        return {
          where: (field, op, value) => ({
            orderBy: () => ({
              limit: () => ({
                async get() {
                  if (seed.__alertsQueryError) {
                    // Mirrors a missing composite index -- exactly what production hit before the
                    // `ops_alerts` index (userId ASC, createdAt DESC) was deployed.
                    throw new Error('FAILED_PRECONDITION: The query requires an index.');
                  }
                  const docs = [...alerts.entries()]
                    .filter(([, doc]) => field === 'userId' && op === '==' && doc.userId === value)
                    .sort((a, b) => b[1].createdAt - a[1].createdAt)
                    .map(([id, data]) => ({ id, data: () => data }));
                  return { docs };
                }
              })
            })
          })
        };
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
    _store: store
  };
}

function makeFakeRevenueCatFetch(entitlements) {
  return async () => ({ ok: true, json: async () => ({ subscriber: { entitlements } }) });
}

test('getSubscriptionSupportSnapshot rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => getSubscriptionSupportSnapshot.run({ userId: 'user-1' }, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('getSubscriptionSupportSnapshot rejects an authenticated caller without the admin claim (the privilege boundary this file exists for)', async () => {
  await assert.rejects(
    () => getSubscriptionSupportSnapshot.run({ userId: 'user-1' }, { auth: { uid: 'not-an-admin', token: {} } }),
    (err) => {
      assert.equal(err.code, 'permission-denied');
      return true;
    }
  );
});

test('getSubscriptionSupportSnapshot rejects an admin call with no userId', async () => {
  await assert.rejects(
    () => getSubscriptionSupportSnapshot.run({}, { auth: { uid: 'admin-1', token: { admin: true } } }),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});

test('resolveUserId passes a bare uid through unchanged (never calls Auth for a non-email input)', async () => {
  const authAdmin = { getUserByEmail: async () => { throw new Error('should not be called'); } };
  const result = await resolveUserId(authAdmin, 'MEkxQsweaEhNYFa0LeTJgCUDqVc2');
  assert.equal(result, 'MEkxQsweaEhNYFa0LeTJgCUDqVc2');
});

test('resolveUserId resolves an email to a uid via Firebase Auth (a support ticket names an email, not a uid)', async () => {
  const authAdmin = {
    getUserByEmail: async (email) => {
      assert.equal(email, 'candidate@example.com');
      return { uid: 'resolved-uid-1' };
    }
  };
  const result = await resolveUserId(authAdmin, 'candidate@example.com');
  assert.equal(result, 'resolved-uid-1');
});

test('resolveUserId reports not-found for an email with no matching account (a typo, not a server fault)', async () => {
  const authAdmin = { getUserByEmail: async () => { throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' }); } };
  await assert.rejects(
    () => resolveUserId(authAdmin, 'nobody@example.com'),
    (err) => {
      assert.equal(err.code, 'not-found');
      return true;
    }
  );
});

test('resolveUserId fails closed (internal) on any other Auth error, rather than falling through to treat the email as a uid', async () => {
  const authAdmin = { getUserByEmail: async () => { throw new Error('Auth service unavailable'); } };
  await assert.rejects(
    () => resolveUserId(authAdmin, 'candidate@example.com'),
    (err) => {
      assert.equal(err.code, 'internal');
      return true;
    }
  );
});

test('getSubscriptionSupportSnapshotForUser returns the joined snapshot for an admin', async () => {
  const now = Date.now();
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'PREMIUM', source: 'RAZORPAY', subscriptionId: 'sub_abc', expiryDate: now + 100000 },
    __alerts: {
      'alert-1': { userId: 'user-1', kind: 'DRIFT_REPAIR', severity: 'INFO', createdAt: now - 1000 },
      'alert-2': { userId: 'other-user', kind: 'DRIFT_REPAIR', severity: 'INFO', createdAt: now }
    }
  });
  const fetchImpl = async (url) => {
    if (String(url).includes('razorpay.com')) {
      return { ok: true, json: async () => ({ id: 'sub_abc', status: 'active' }) };
    }
    return { ok: true, json: async () => ({ subscriber: { entitlements: { premium: { expires_date: new Date(now + 100000).toISOString() } } } }) };
  };

  process.env.RAZORPAY_KEY_ID = 'test_key_id';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
  process.env.REVENUECAT_SECRET_KEY = 'test_rc_secret';
  let snapshot;
  try {
    snapshot = await getSubscriptionSupportSnapshotForUser(db, fetchImpl, 'user-1');
  } finally {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.REVENUECAT_SECRET_KEY;
  }

  assert.equal(snapshot.userId, 'user-1');
  assert.equal(snapshot.firestore.tier, 'PREMIUM');
  assert.equal(snapshot.razorpay.id, 'sub_abc');
  assert.equal(snapshot.revenueCat.status, 'ACTIVE');
  assert.equal(snapshot.alerts.length, 1, 'only this user\'s alerts, not another user\'s');
  assert.equal(snapshot.alerts[0].kind, 'DRIFT_REPAIR');
});

test('getSubscriptionSupportSnapshotForUser skips the Razorpay lookup when the stored doc names no Razorpay subscription', async () => {
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'PREMIUM', source: 'REVENUECAT' }
  });
  const fetchImpl = makeFakeRevenueCatFetch({});

  const snapshot = await getSubscriptionSupportSnapshotForUser(db, fetchImpl, 'user-1');

  assert.equal(snapshot.razorpay, null);
});

test('getSubscriptionSupportSnapshotForUser degrades to a partial snapshot on a Razorpay outage, without failing the whole call', async () => {
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'PREMIUM', source: 'RAZORPAY', subscriptionId: 'sub_abc' }
  });
  const fetchImpl = async (url) => {
    if (String(url).includes('razorpay.com')) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({ subscriber: { entitlements: {} } }) };
  };

  process.env.RAZORPAY_KEY_ID = 'test_key_id';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
  process.env.REVENUECAT_SECRET_KEY = 'test_rc_secret';
  let snapshot;
  try {
    snapshot = await getSubscriptionSupportSnapshotForUser(db, fetchImpl, 'user-1');
  } finally {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.REVENUECAT_SECRET_KEY;
  }

  assert.deepEqual(snapshot.razorpay, { unavailable: true });
  assert.equal(snapshot.revenueCat.status, 'NONE', 'RevenueCat side still resolves independently');
});

test('getSubscriptionSupportSnapshotForUser degrades to a partial snapshot on a RevenueCat outage, without failing the whole call', async () => {
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'FREE' }
  });
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

  process.env.REVENUECAT_SECRET_KEY = 'test_rc_secret';
  let snapshot;
  try {
    snapshot = await getSubscriptionSupportSnapshotForUser(db, fetchImpl, 'user-1');
  } finally {
    delete process.env.REVENUECAT_SECRET_KEY;
  }

  assert.deepEqual(snapshot.revenueCat, { unavailable: true });
});

test('getSubscriptionSupportSnapshotForUser degrades alerts to { unavailable: true } (not a thrown error) when the ops_alerts query fails, e.g. a missing composite index', async () => {
  // Regression test: production hit exactly this the first time the page was used live -- the
  // `ops_alerts` composite index (userId ASC, createdAt DESC) hadn't been deployed yet, the query
  // threw, `readRecentAlerts` correctly degraded to `{ unavailable: true }`, and the web page
  // crashed anyway because it assumed `alerts` was always an array. Fixed on both sides; this pins
  // the server half of that contract.
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'FREE' },
    __alertsQueryError: true
  });

  const snapshot = await getSubscriptionSupportSnapshotForUser(db, async () => ({ ok: true, json: async () => ({}) }), 'user-1');

  assert.deepEqual(snapshot.alerts, { unavailable: true });
});

test('getSubscriptionSupportSnapshotForUser reports Razorpay/RevenueCat as unavailable (not a crash) when credentials are missing', async () => {
  const db = makeFakeDb({
    'users/user-1/data/subscription': { tier: 'PREMIUM', source: 'RAZORPAY', subscriptionId: 'sub_abc' }
  });

  const razorpayState = await getSubscriptionSupportSnapshotForUser(db, async () => ({ ok: true, json: async () => ({}) }), 'user-1');

  assert.deepEqual(razorpayState.razorpay, { unavailable: true, reason: 'missing-credentials' });
  assert.deepEqual(razorpayState.revenueCat, { unavailable: true, reason: 'missing-credentials' });
});
