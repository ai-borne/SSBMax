/**
 * Phase 2 (docs/plans/SubscriptionPricingRestructure.md): `createRazorpayOrder` must compute
 * the order amount server-side from `planId` via the generated pricing contract
 * (contracts/pricing.yaml) and reject unknown planIds outright -- never trust a
 * client-supplied `amount`. Runs via Node native test runner (node --test), matching the
 * `.run(data, context)` invocation pattern established in geminiProxy.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRazorpayOrder } = require('../src/payments');

test('createRazorpayOrder rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => createRazorpayOrder.run({ planId: 'pro_monthly' }, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('createRazorpayOrder rejects an unknown planId', async () => {
  await assert.rejects(
    () => createRazorpayOrder.run({ planId: 'not_a_real_plan' }, { auth: { uid: 'user-1' } }),
    (err) => {
      assert.equal(err.code, 'invalid-argument');
      return true;
    }
  );
});

test('createRazorpayOrder ignores a client-supplied amount and computes it from planId', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    const result = await createRazorpayOrder.run(
      { planId: 'pro_monthly', amount: 1 },
      { auth: { uid: 'user-1' } }
    );
    // PRO = Rs 499/month (contracts/pricing.yaml) -> 49900 paise, not the client's `amount: 1`.
    assert.equal(result.amount, 49900);
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('createRazorpayOrder computes the correct amount for every real planId', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    const expected = { basic_monthly: 29900, pro_monthly: 49900, premium_monthly: 99900 };
    for (const [planId, amountPaise] of Object.entries(expected)) {
      const result = await createRazorpayOrder.run({ planId }, { auth: { uid: 'user-1' } });
      assert.equal(result.amount, amountPaise, `${planId} should cost ${amountPaise} paise`);
    }
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});
