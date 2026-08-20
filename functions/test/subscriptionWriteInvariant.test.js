/**
 * Phase 7 (Payment Ecosystem Hardening plan): pins the one assumption the whole reconciliation
 * safety net rests on -- `scheduledSubscriptionReconciliation.js` and Phase 7's own
 * `scheduledRazorpayDriftSweep.js` both query `collectionGroup('data').where('billingCycle', '==',
 * 'MONTHLY')`. Firestore excludes documents *missing* a filtered field, so any writer that sets a
 * non-FREE `tier` without also setting `billingCycle` produces a doc permanently invisible to both
 * sweeps -- unreachable by any drift-repair or downgrade mechanism this plan has built, forever.
 *
 * Behavioral, not textual: each known writer's exported function is actually invoked against a
 * fake Firestore and its real write is inspected, rather than regex/AST-scanning source text --
 * a real object-literal `tier:`/`billingCycle:` pair can appear in return values, local variables,
 * and non-Firestore-write objects too (verified while writing this test), which makes static
 * text-matching noisy and prone to both false positives and false negatives. Exercising the actual
 * write path is the "cheapest possible guard" that's also correct.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

function assertGrantWriteHasBillingCycle(label, writtenDoc) {
  assert.ok(writtenDoc, `${label}: expected a write to have happened`);
  assert.notEqual(writtenDoc.tier, 'FREE', `${label}: this test only covers non-FREE grants -- a FREE write is excluded from reconciliation by the tier!=FREE filter anyway`);
  assert.equal(
    writtenDoc.billingCycle,
    'MONTHLY',
    `${label}: wrote tier='${writtenDoc.tier}' without billingCycle -- this doc would be invisible to both reconciliation sweeps forever`
  );
}

/**
 * Every ref `processPaymentCaptured` touches (`logRef`/`paymentRef`/`userRef`/`subscriptionRef`)
 * is constructed once at the top of the function and reused for both its `transaction.get` and
 * `transaction.set` calls -- so a doc ref can just hold its own mutable data directly, no
 * path-keyed store needed.
 */
function makeDocRef(initialData) {
  let data = initialData;
  return {
    async get() {
      return { exists: data !== undefined, data: () => data };
    },
    __write(value, merge) {
      data = merge ? { ...(data || {}), ...value } : value;
    }
  };
}

test('webhooks/paymentCaptured.js: applySubscriptionTier writes billingCycle alongside every non-FREE tier grant', async () => {
  const { processPaymentCaptured } = require('../src/webhooks/paymentCaptured');

  const logRef = makeDocRef(undefined);
  const paymentRef = makeDocRef(undefined);
  const subscriptionRef = makeDocRef(undefined);
  const userRef = makeDocRef(undefined);
  userRef.collection = (sub) => {
    if (sub !== 'data') throw new Error(`unexpected subcollection ${sub}`);
    return { doc: () => subscriptionRef };
  };

  const db = {
    collection(name) {
      if (name === 'webhook_logs') return { doc: () => logRef };
      if (name === 'payments') return { doc: () => paymentRef };
      if (name === 'users') return { doc: () => userRef };
      throw new Error(`unexpected collection ${name}`);
    },
    async runTransaction(fn) {
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, value, options) => ref.__write(value, options?.merge)
      };
      return fn(tx);
    }
  };

  const result = await processPaymentCaptured(
    { id: 'pay_1', order_id: 'order_1', amount: 999900, currency: 'INR', notes: { userId: 'user-1', planId: 'pro_monthly' } },
    'event_1',
    db
  );
  assert.equal(result.success, true);

  const written = (await subscriptionRef.get()).data();
  assertGrantWriteHasBillingCycle('paymentCaptured.applySubscriptionTier', written);
});

test('lib/razorpaySubscriptionWebhook.js: a grant event writes billingCycle alongside the non-FREE tier', async () => {
  const { processRazorpaySubscriptionEvent } = require('../src/lib/razorpaySubscriptionWebhook');
  const webhookLogs = new Map();
  const subscriptionDocs = new Map();
  const subscriptionRef = { store: subscriptionDocs, id: 'user1' };
  const db = {
    collection(name) {
      if (name === 'webhook_logs') return { doc: (id) => ({ store: webhookLogs, id }) };
      if (name === 'users') return { doc: () => ({ collection: () => ({ doc: () => subscriptionRef }) }) };
      throw new Error(`unexpected collection ${name}`);
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = ref.store.get(ref.id);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data, options) {
          const existing = options?.merge ? ref.store.get(ref.id) || {} : {};
          ref.store.set(ref.id, { ...existing, ...data });
        }
      };
      return fn(tx);
    }
  };

  const payload = { subscription: { entity: { id: 'sub_1', current_end: 1893456000, notes: { userId: 'user1', planId: 'pro_monthly' } } } };
  const planIdToTierFn = (planId) => (planId === 'pro_monthly' ? 'PRO' : 'PRO');
  const result = await processRazorpaySubscriptionEvent('subscription.activated', payload, 'evt_1', db, planIdToTierFn);
  assert.equal(result.success, true);

  assertGrantWriteHasBillingCycle('razorpaySubscriptionWebhook.processRazorpaySubscriptionEvent', subscriptionDocs.get('user1'));
});

test('revenueCatWebhook.js: a grant event writes billingCycle alongside the non-FREE tier', async () => {
  const { processRevenueCatEvent } = require('../src/revenueCatWebhook');
  const webhookLogs = new Map();
  const userDocs = new Map([['user1', { exists: true }]]);
  const subscriptionDocs = new Map();
  const subscriptionRef = { store: subscriptionDocs, id: 'user1' };
  const userRef = { store: userDocs, id: 'user1' };
  const db = {
    collection(name) {
      if (name === 'webhook_logs') return { doc: (id) => ({ store: webhookLogs, id }) };
      if (name === 'users') return { doc: () => ({ ...userRef, collection: () => ({ doc: () => subscriptionRef }) }) };
      throw new Error(`unexpected collection ${name}`);
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          const data = ref.store.get(ref.id);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data, options) {
          const existing = options?.merge ? ref.store.get(ref.id) || {} : {};
          ref.store.set(ref.id, { ...existing, ...data });
        }
      };
      return fn(tx);
    }
  };

  const event = { id: 'evt_1', app_user_id: 'user1', type: 'INITIAL_PURCHASE', entitlement_ids: ['pro'], expiration_at_ms: Date.now() + 100000 };
  const result = await processRevenueCatEvent(event, db);
  assert.equal(result.success, true);

  assertGrantWriteHasBillingCycle('revenueCatWebhook.processRevenueCatEvent', subscriptionDocs.get('user1'));
});

test('subscriptions/scheduledRazorpayDriftSweep.js: a REPAIR_UP write includes billingCycle', async () => {
  const { sweepRazorpayDrift, PAGE_SIZE } = require('../src/subscriptions/scheduledRazorpayDriftSweep');
  const docs = new Map();
  const db = {
    collection(name) {
      if (name === 'ops_alerts') return { add: async () => {} };
      if (name === 'users') {
        return {
          doc: (uid) => ({
            collection: () => ({
              doc: () => ({
                async get() {
                  const d = docs.get(uid);
                  return { exists: d !== undefined, data: () => d };
                },
                async set(value, options) {
                  const existing = options?.merge ? docs.get(uid) || {} : {};
                  docs.set(uid, { ...existing, ...value });
                }
              })
            })
          })
        };
      }
      throw new Error(`unexpected collection ${name}`);
    }
  };
  const now = Date.now();
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ items: [{ id: 'sub_x', status: 'active', notes: { userId: 'user1', planId: 'pro_monthly' }, current_end: (now + 100000) / 1000 }] })
  });

  await sweepRazorpayDrift(db, fetchImpl, { keyId: 'k', keySecret: 's' }, now, { pageSize: PAGE_SIZE, maxPages: 1 });

  assertGrantWriteHasBillingCycle('scheduledRazorpayDriftSweep.applyDrift', docs.get('user1'));
});

test('subscriptions/repairMobileEntitlement.js: a REPAIR_UP write includes billingCycle', async () => {
  const { repairMobileEntitlementForUser } = require('../src/subscriptions/repairMobileEntitlement');
  const docs = new Map();
  const db = {
    collection(name) {
      if (name === 'ops_alerts') return { add: async () => {} };
      if (name === 'users') {
        return {
          doc: (uid) => ({
            collection: () => ({
              doc: () => ({
                async get() {
                  const d = docs.get(uid);
                  return { exists: d !== undefined, data: () => d };
                }
              })
            })
          })
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) { return ref.get(); },
        set(ref, value, options) {
          // ref here is the same object returned by doc() above -- capture the uid via closure
          // by writing through a shared docs map keyed off the one seeded/target user in this test.
          const existing = options?.merge ? docs.get('user1') || {} : {};
          docs.set('user1', { ...existing, ...value });
        }
      };
      return fn(tx);
    }
  };
  const now = Date.now();
  const fetchImpl = async () => ({ ok: true, json: async () => ({ subscriber: { entitlements: { pro: { expires_date: new Date(now + 100000).toISOString() } } } }) });

  const result = await repairMobileEntitlementForUser(db, fetchImpl, 'sk_test', 'user1');
  assert.equal(result.repaired, true);

  assertGrantWriteHasBillingCycle('repairMobileEntitlement.repairMobileEntitlementForUser', docs.get('user1'));
});
