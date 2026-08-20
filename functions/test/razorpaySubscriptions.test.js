/**
 * Phase B (Dual-Platform Subscription Billing Hardening plan): `createRazorpaySubscription`
 * mirrors `payments.test.js`'s conventions for `createRazorpayOrder` -- same auth/planId
 * validation shape, same `.run(data, context)` invocation, same emulator-fallback pattern
 * (senior-review fix #7).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRazorpaySubscription,
  assertNoActiveRevenueCatSubscription,
  enforceSubscriptionCreationRateLimit,
  HOURLY_SUBSCRIPTION_CREATE_LIMIT
} = require('../src/razorpaySubscriptions');

/**
 * Mirrors geminiProxy.test.js's fake-db shape for `enforceRateLimit` -- the one doc
 * read/write `enforceSubscriptionCreationRateLimit` needs (users/{uid}/subscription/
 * subscription_create_usage_{hourKey}), inside a transaction.
 */
function makeFakeRateLimitDb({ count = null } = {}) {
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

  return {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => docRef()
        })
      })
    }),
    async runTransaction(fn) {
      const tx = { get: (ref) => ref.get(), set: (ref, value) => ref.set(value) };
      return fn(tx);
    },
    _writes: writes
  };
}

/**
 * Phase C: minimal fake standing in for the one `.get()` read
 * `assertNoActiveRevenueCatSubscription` performs -- mirrors `eligibility.test.js`'s
 * `makeFakeDb` shape but only needs the single doc, no transaction/write surface.
 */
function makeFakeSubscriptionDb(docData) {
  return {
    collection() {
      return {
        doc() {
          return {
            collection() {
              return {
                doc() {
                  return {
                    async get() {
                      if (docData === 'throw') {
                        throw new Error('simulated Firestore outage');
                      }
                      return docData === null
                        ? { exists: false, data: () => undefined }
                        : { exists: true, data: () => docData };
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };
}

/**
 * Full-path `.run()` tests hit the real module-level `db` (live Firestore, per this project's
 * ADC-configured dev project -- see the emulator-fallback test below, which already relied on
 * this). Now that `createRazorpaySubscription` also calls `enforceSubscriptionCreationRateLimit`
 * before returning, every such test consumes one real hourly-bucket increment -- give each a
 * distinct uid so they don't share a rate-limit counter and trip each other's cap across test
 * runs within the same UTC hour.
 */
let uidCounter = 0;
function uniqueUid(label) {
  uidCounter += 1;
  return `${label}-${Date.now()}-${uidCounter}`;
}

test('createRazorpaySubscription rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => createRazorpaySubscription.run({ planId: 'pro_monthly' }, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('createRazorpaySubscription rejects an unknown planId', async () => {
  await assert.rejects(
    () => createRazorpaySubscription.run({ planId: 'not_a_real_plan' }, { auth: { uid: 'user-1' } }),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});

test('createRazorpaySubscription returns a mock subscriptionId in the emulator when credentials are unset', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    const result = await createRazorpaySubscription.run(
      { planId: 'pro_monthly' },
      { auth: { uid: uniqueUid('mock-fallback') } }
    );
    assert.equal(result.success, true);
    assert.match(result.subscriptionId, /^sub_mock_/);
    assert.equal(result.notes.planId, 'pro_monthly');
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('createRazorpaySubscription fails closed (not open) in production when credentials are missing', async () => {
  delete process.env.FUNCTIONS_EMULATOR;
  await assert.rejects(
    () => createRazorpaySubscription.run({ planId: 'pro_monthly' }, { auth: { uid: uniqueUid('fails-closed') } }),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('createRazorpaySubscription does not reject a call missing an App Check token (warn-only until Phase 1b)', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    const result = await createRazorpaySubscription.run(
      { planId: 'pro_monthly' },
      { auth: { uid: uniqueUid('no-app-check') } } // no `app` field
    );
    assert.equal(result.success, true);
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('createRazorpaySubscription has a maxInstances cap set (DoW defense, mirrors createRazorpayOrder)', () => {
  assert.equal(
    createRazorpaySubscription.__trigger?.maxInstances ?? createRazorpaySubscription.__endpoint?.maxInstances,
    10
  );
});

test('Phase C: assertNoActiveRevenueCatSubscription rejects an active RevenueCat-sourced subscription', async () => {
  const db = makeFakeSubscriptionDb({ source: 'REVENUECAT', tier: 'PRO', expiryDate: Date.now() + 100_000 });
  await assert.rejects(
    () => assertNoActiveRevenueCatSubscription(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('Phase C: assertNoActiveRevenueCatSubscription proceeds for an expired RevenueCat subscription', async () => {
  const db = makeFakeSubscriptionDb({ source: 'REVENUECAT', tier: 'PRO', expiryDate: Date.now() - 1000 });
  await assert.doesNotReject(() => assertNoActiveRevenueCatSubscription(db, 'user-1'));
});

test('Phase C: assertNoActiveRevenueCatSubscription fails closed on a null expiryDate (treated as still-active)', async () => {
  const db = makeFakeSubscriptionDb({ source: 'REVENUECAT', tier: 'PRO', expiryDate: null });
  await assert.rejects(
    () => assertNoActiveRevenueCatSubscription(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('Phase C: assertNoActiveRevenueCatSubscription proceeds when there is no subscription doc', async () => {
  const db = makeFakeSubscriptionDb(null);
  await assert.doesNotReject(() => assertNoActiveRevenueCatSubscription(db, 'user-1'));
});

test('Phase C: assertNoActiveRevenueCatSubscription proceeds for a FREE-tier doc', async () => {
  const db = makeFakeSubscriptionDb({ source: null, tier: 'FREE', expiryDate: null });
  await assert.doesNotReject(() => assertNoActiveRevenueCatSubscription(db, 'user-1'));
});

test('Phase C: assertNoActiveRevenueCatSubscription proceeds for a RAZORPAY-sourced doc (same-source repeat purchase/renewal)', async () => {
  const db = makeFakeSubscriptionDb({ source: 'RAZORPAY', tier: 'PRO', expiryDate: Date.now() + 100_000 });
  await assert.doesNotReject(() => assertNoActiveRevenueCatSubscription(db, 'user-1'));
});

test('Phase C: assertNoActiveRevenueCatSubscription fails closed (rejects) when the Firestore read throws', async () => {
  const db = makeFakeSubscriptionDb('throw');
  await assert.rejects(
    () => assertNoActiveRevenueCatSubscription(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'internal');
      return true;
    }
  );
});

test('enforceSubscriptionCreationRateLimit allows the first attempt in a fresh hour and starts the counter at 1', async () => {
  const db = makeFakeRateLimitDb({ count: null });
  const result = await enforceSubscriptionCreationRateLimit(db, 'user-1');
  assert.equal(result, 1);
  assert.equal(db._writes.at(-1).count, 1);
});

test('enforceSubscriptionCreationRateLimit allows attempts under the hourly cap', async () => {
  const db = makeFakeRateLimitDb({ count: HOURLY_SUBSCRIPTION_CREATE_LIMIT - 1 });
  const result = await enforceSubscriptionCreationRateLimit(db, 'user-1');
  assert.equal(result, HOURLY_SUBSCRIPTION_CREATE_LIMIT);
});

test('enforceSubscriptionCreationRateLimit rejects once the hourly cap is reached', async () => {
  const db = makeFakeRateLimitDb({ count: HOURLY_SUBSCRIPTION_CREATE_LIMIT });
  await assert.rejects(
    () => enforceSubscriptionCreationRateLimit(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'resource-exhausted');
      return true;
    }
  );
});

test('enforceSubscriptionCreationRateLimit does not write when rejecting (no partial increment past the cap)', async () => {
  const db = makeFakeRateLimitDb({ count: HOURLY_SUBSCRIPTION_CREATE_LIMIT });
  await assert.rejects(() => enforceSubscriptionCreationRateLimit(db, 'user-1'));
  assert.equal(db._writes.length, 0);
});

test('createRazorpaySubscription rejects once the hourly per-user cap is reached (via the real module db, live-hitting)', async () => {
  // Exercises the wired-in call site, not just the pure function -- distinct rejection code
  // (resource-exhausted, not invalid-argument/failed-precondition) proves the rate limiter
  // actually runs inside createRazorpaySubscription and isn't dead code. Uses a uid namespaced
  // to this test so repeated runs don't collide with other tests' counters within the same hour.
  process.env.FUNCTIONS_EMULATOR = 'true';
  const uid = `rate-limit-test-${Date.now()}`;
  try {
    for (let i = 0; i < HOURLY_SUBSCRIPTION_CREATE_LIMIT; i++) {
      const result = await createRazorpaySubscription.run({ planId: 'pro_monthly' }, { auth: { uid } });
      assert.equal(result.success, true);
    }
    await assert.rejects(
      () => createRazorpaySubscription.run({ planId: 'pro_monthly' }, { auth: { uid } }),
      (err) => {
        assert.equal(err.code, 'resource-exhausted');
        return true;
      }
    );
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('VALID_PLAN_IDS covers every real planId', () => {
  const { VALID_PLAN_IDS } = require('../src/razorpaySubscriptions');
  assert.ok(VALID_PLAN_IDS.has('basic_monthly'));
  assert.ok(VALID_PLAN_IDS.has('pro_monthly'));
  assert.ok(VALID_PLAN_IDS.has('premium_monthly'));
  assert.ok(!VALID_PLAN_IDS.has('free_monthly'));
});
