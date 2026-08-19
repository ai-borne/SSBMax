/**
 * Phase B (Dual-Platform Subscription Billing Hardening plan): `createRazorpaySubscription`
 * mirrors `payments.test.js`'s conventions for `createRazorpayOrder` -- same auth/planId
 * validation shape, same `.run(data, context)` invocation, same emulator-fallback pattern
 * (senior-review fix #7).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRazorpaySubscription } = require('../src/razorpaySubscriptions');

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

test('VALID_PLAN_IDS covers every real planId', () => {
  const { VALID_PLAN_IDS } = require('../src/razorpaySubscriptions');
  assert.ok(VALID_PLAN_IDS.has('basic_monthly'));
  assert.ok(VALID_PLAN_IDS.has('pro_monthly'));
  assert.ok(VALID_PLAN_IDS.has('premium_monthly'));
  assert.ok(!VALID_PLAN_IDS.has('free_monthly'));
});
