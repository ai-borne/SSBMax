/**
 * Phase 7 (Payment Ecosystem Hardening plan): pins the one assumption the whole reconciliation
 * safety net rests on -- `scheduledSubscriptionReconciliation.js` queries
 * `collectionGroup('data').where('billingCycle', '==', 'MONTHLY')`. Firestore excludes documents
 * *missing* a filtered field, so any writer that sets a non-FREE `tier` without also setting
 * `billingCycle` produces a doc permanently invisible to the sweep -- unreachable by any downgrade
 * mechanism, forever. RevenueCat (webhook + repair callable) are the only writers.
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
    `${label}: wrote tier='${writtenDoc.tier}' without billingCycle -- this doc would be invisible to the reconciliation sweep forever`
  );
}

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
