/**
 * Phase B (Dual-Platform Subscription Billing Hardening plan): `createRazorpaySubscription`
 * mirrors `payments.test.js`'s conventions for `createRazorpayOrder` -- same auth/planId
 * validation shape, same `.run(data, context)` invocation, same emulator-fallback pattern
 * (senior-review fix #7).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRazorpaySubscription, assertNoActiveRevenueCatSubscription } = require('../src/razorpaySubscriptions');

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
      { auth: { uid: 'user-1' } }
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
    () => createRazorpaySubscription.run({ planId: 'pro_monthly' }, { auth: { uid: 'user-1' } }),
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
      { auth: { uid: 'user-1' } } // no `app` field
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

test('VALID_PLAN_IDS covers every real planId', () => {
  const { VALID_PLAN_IDS } = require('../src/razorpaySubscriptions');
  assert.ok(VALID_PLAN_IDS.has('basic_monthly'));
  assert.ok(VALID_PLAN_IDS.has('pro_monthly'));
  assert.ok(VALID_PLAN_IDS.has('premium_monthly'));
  assert.ok(!VALID_PLAN_IDS.has('free_monthly'));
});
