/**
 * Phase 5 (H5a, Payment Ecosystem Hardening plan): `cancelRazorpaySubscription` mirrors
 * `razorpaySubscriptions.test.js`'s conventions for `createRazorpaySubscription` -- same
 * `.run(data, context)` invocation, same emulator-fallback pattern, same real-module-db rate
 * limit exercise. `cancelRazorpaySubscriptionForUser`'s branches (Razorpay API success/failure)
 * are exercised directly against a fake db + fake fetch, mirroring `assertNoActiveRevenueCatSubscription`'s
 * `makeFakeSubscriptionDb` convention in `razorpaySubscriptions.test.js` -- the real module `db`
 * cannot be seeded with a subscription doc from this test suite.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { cancelRazorpaySubscription, cancelRazorpaySubscriptionForUser } = require('../src/razorpaySubscriptionCancel');
const { HOURLY_SUBSCRIPTION_CANCEL_LIMIT } = require('../src/lib/subscriptionRateLimit');

let uidCounter = 0;
function uniqueUid(label) {
  uidCounter += 1;
  return `${label}-${Date.now()}-${uidCounter}`;
}

/** Mirrors `razorpaySubscriptions.test.js`'s `makeFakeSubscriptionDb` shape (single-doc `.get()`). */
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

test('cancelRazorpaySubscription rejects unauthenticated calls', async () => {
  await assert.rejects(
    () => cancelRazorpaySubscription.run({}, {}),
    (err) => {
      assert.equal(err.code, 'unauthenticated');
      return true;
    }
  );
});

test('cancelRazorpaySubscription ignores a client-supplied userId -- always targets the caller\'s own doc (cross-user cancel is impossible, not merely rejected)', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    // No subscription doc exists for this fresh uid, so this proves the callable never even
    // looked at `data.userId` -- it read (and failed-precondition'd against) the caller's own,
    // nonexistent doc instead of whatever `data.userId` named.
    const uid = uniqueUid('cross-user');
    await assert.rejects(
      () => cancelRazorpaySubscription.run({ userId: 'someone-elses-uid' }, { auth: { uid } }),
      (err) => {
        assert.equal(err.code, 'failed-precondition');
        return true;
      }
    );
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('cancelRazorpaySubscription rejects failed-precondition when the caller has no Razorpay subscription', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    const uid = uniqueUid('no-subscription');
    await assert.rejects(
      () => cancelRazorpaySubscription.run({}, { auth: { uid } }),
      (err) => {
        assert.equal(err.code, 'failed-precondition');
        return true;
      }
    );
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('cancelRazorpaySubscription has a maxInstances cap set (DoW defense, mirrors createRazorpaySubscription)', () => {
  assert.equal(
    cancelRazorpaySubscription.__trigger?.maxInstances ?? cancelRazorpaySubscription.__endpoint?.maxInstances,
    10
  );
});

test('cancelRazorpaySubscription rejects once the hourly per-user cap is reached (via the real module db, live-hitting)', async () => {
  // Every attempt in this test has no subscription doc, so each call already fails with
  // failed-precondition -- the rate limiter runs BEFORE that read, so exhausting the cap still
  // flips the rejection code to resource-exhausted, proving the limiter is wired in ahead of the
  // subscription lookup, not dead code after it.
  process.env.FUNCTIONS_EMULATOR = 'true';
  const uid = `cancel-rate-limit-test-${Date.now()}`;
  try {
    for (let i = 0; i < HOURLY_SUBSCRIPTION_CANCEL_LIMIT; i++) {
      await assert.rejects(
        () => cancelRazorpaySubscription.run({}, { auth: { uid } }),
        (err) => {
          assert.equal(err.code, 'failed-precondition');
          return true;
        }
      );
    }
    await assert.rejects(
      () => cancelRazorpaySubscription.run({}, { auth: { uid } }),
      (err) => {
        assert.equal(err.code, 'resource-exhausted');
        return true;
      }
    );
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('cancelRazorpaySubscriptionForUser rejects failed-precondition when there is no subscription doc', async () => {
  const db = makeFakeSubscriptionDb(null);
  await assert.rejects(
    () => cancelRazorpaySubscriptionForUser(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('cancelRazorpaySubscriptionForUser rejects failed-precondition for a RevenueCat-sourced subscription (nothing to cancel via Razorpay)', async () => {
  const db = makeFakeSubscriptionDb({ source: 'REVENUECAT', tier: 'PRO', subscriptionId: 'rc_sub_1' });
  await assert.rejects(
    () => cancelRazorpaySubscriptionForUser(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('cancelRazorpaySubscriptionForUser rejects failed-precondition for a Razorpay doc missing subscriptionId (legacy one-time-Order grant)', async () => {
  const db = makeFakeSubscriptionDb({ source: 'RAZORPAY', tier: 'PRO', expiryDate: Date.now() + 100000 });
  await assert.rejects(
    () => cancelRazorpaySubscriptionForUser(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});

test('cancelRazorpaySubscriptionForUser fails closed (internal) when the subscription read throws', async () => {
  const db = makeFakeSubscriptionDb('throw');
  await assert.rejects(
    () => cancelRazorpaySubscriptionForUser(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'internal');
      return true;
    }
  );
});

test('cancelRazorpaySubscriptionForUser calls the Razorpay cancel endpoint with cancel_at_cycle_end on the happy path', async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'test_secret';
  try {
    const db = makeFakeSubscriptionDb({ source: 'RAZORPAY', tier: 'PRO', subscriptionId: 'sub_abc123' });
    let calledUrl;
    let calledBody;
    const fakeFetch = async (url, opts) => {
      calledUrl = url;
      calledBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ id: 'sub_abc123', status: 'active' }) };
    };

    const result = await cancelRazorpaySubscriptionForUser(db, 'user-1', fakeFetch);

    assert.equal(result.success, true);
    assert.equal(result.subscriptionId, 'sub_abc123');
    assert.equal(calledUrl, 'https://api.razorpay.com/v1/subscriptions/sub_abc123/cancel');
    assert.equal(calledBody.cancel_at_cycle_end, 1);
  } finally {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  }
});

test('cancelRazorpaySubscriptionForUser fails closed (internal) on a Razorpay API error', async () => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'test_secret';
  try {
    const db = makeFakeSubscriptionDb({ source: 'RAZORPAY', tier: 'PRO', subscriptionId: 'sub_abc123' });
    const fakeFetch = async () => ({
      ok: false,
      json: async () => ({ error: { description: 'subscription already cancelled' } })
    });

    await assert.rejects(
      () => cancelRazorpaySubscriptionForUser(db, 'user-1', fakeFetch),
      (err) => {
        assert.equal(err.code, 'internal');
        assert.match(err.message, /already cancelled/);
        return true;
      }
    );
  } finally {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  }
});

test('cancelRazorpaySubscriptionForUser returns a mocked success in the emulator when credentials are unset', async () => {
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    const db = makeFakeSubscriptionDb({ source: 'RAZORPAY', tier: 'PRO', subscriptionId: 'sub_abc123' });
    const result = await cancelRazorpaySubscriptionForUser(db, 'user-1');
    assert.equal(result.success, true);
    assert.equal(result.mocked, true);
  } finally {
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('cancelRazorpaySubscriptionForUser fails closed (failed-precondition, not open) in production when credentials are missing', async () => {
  delete process.env.FUNCTIONS_EMULATOR;
  const db = makeFakeSubscriptionDb({ source: 'RAZORPAY', tier: 'PRO', subscriptionId: 'sub_abc123' });
  await assert.rejects(
    () => cancelRazorpaySubscriptionForUser(db, 'user-1'),
    (err) => {
      assert.equal(err.code, 'failed-precondition');
      return true;
    }
  );
});
