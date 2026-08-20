/**
 * Phase B (Dual-Platform Subscription Billing Hardening plan): tests for `webhooks.js`'s new
 * subscription-family event handling (`subscription.activated`/`charged`/`completed`/`cancelled`/
 * `halted`/`paused`/`resumed`, `refund.processed`) -- kept in its own file per the plan
 * ("don't grow `webhooksTierWrite.test.js` into an 8-event-type catch-all"). Uses a fake
 * Firestore (mirroring `revenueCatWebhook.test.js`'s convention) rather than the emulator.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processRazorpaySubscriptionEvent,
  extractRazorpaySubscriptionContext,
  RAZORPAY_SUBSCRIPTION_EVENT_TYPES
} = require('../src/webhooks');

// Nested collection paths (users/{uid}/data/subscription) don't exist in this flat fake -- the
// production code always calls `.collection(...).document(...).collection(...).document(...)`
// against a single Firestore client, so we simulate it with dotted-key top-level maps instead,
// matching `revenueCatWebhook.test.js`'s existing fake-Firestore convention.
function makeSubscriptionFakeDb(seedSubscription) {
  const webhookLogs = new Map();
  const subscriptionDocs = new Map();
  if (seedSubscription) subscriptionDocs.set('user1', seedSubscription);

  const subscriptionRef = { store: subscriptionDocs, id: 'user1' };
  const logCollection = {
    doc: (id) => ({ store: webhookLogs, id })
  };
  const usersCollection = {
    doc: () => ({
      collection: () => ({
        doc: () => subscriptionRef
      })
    })
  };

  const db = {
    collection(name) {
      if (name === 'webhook_logs') return logCollection;
      if (name === 'users') return usersCollection;
      throw new Error(`Unexpected collection ${name}`);
    },
    async runTransaction(fn) {
      const tx = {
        async get(docRef) {
          const data = docRef.store.get(docRef.id);
          return { exists: data !== undefined, data: () => data };
        },
        set(docRef, data, options) {
          const existing = options?.merge ? docRef.store.get(docRef.id) || {} : {};
          docRef.store.set(docRef.id, { ...existing, ...data });
        }
      };
      return fn(tx);
    }
  };

  return { db, webhookLogs, subscriptionDocs };
}

function activatedPayload(overrides = {}) {
  return {
    subscription: {
      entity: {
        id: 'sub_123',
        current_end: 1893456000, // unix seconds
        notes: { userId: 'user1', planId: 'pro_monthly' },
        ...overrides
      }
    }
  };
}

test('extractRazorpaySubscriptionContext reads notes off subscription.entity', () => {
  const ctx = extractRazorpaySubscriptionContext(activatedPayload());
  assert.equal(ctx.userId, 'user1');
  assert.equal(ctx.planId, 'pro_monthly');
  assert.equal(ctx.currentEndMs, 1893456000 * 1000);
});

test('extractRazorpaySubscriptionContext falls back to payment.entity notes (refund.processed shape)', () => {
  const ctx = extractRazorpaySubscriptionContext({
    payment: { entity: { notes: { userId: 'user2', planId: 'basic_monthly' } } },
    refund: { entity: { id: 'rfnd_1' } }
  });
  assert.equal(ctx.userId, 'user2');
  assert.equal(ctx.planId, 'basic_monthly');
  assert.equal(ctx.currentEndMs, null);
});

test('every subscription-family event type this test file exercises is in the dispatch set', () => {
  for (const type of [
    'subscription.activated',
    'subscription.charged',
    'subscription.completed',
    'subscription.cancelled',
    'subscription.halted',
    'subscription.paused',
    'subscription.resumed',
    'refund.processed'
  ]) {
    assert.ok(RAZORPAY_SUBSCRIPTION_EVENT_TYPES.has(type), `${type} missing from dispatch set`);
  }
});

test('subscription.activated grants tier + expiryDate + willRenew:true, source RAZORPAY', async () => {
  const { db, subscriptionDocs, webhookLogs } = makeSubscriptionFakeDb();
  const result = await processRazorpaySubscriptionEvent('subscription.activated', activatedPayload(), 'evt_1', db);

  assert.equal(result.success, true);
  const doc = subscriptionDocs.get('user1');
  assert.equal(doc.tier, 'PRO');
  assert.equal(doc.source, 'RAZORPAY');
  assert.equal(doc.willRenew, true);
  assert.equal(doc.expiryDate, 1893456000 * 1000);
  assert.equal(doc.billingIssueAt, null);
  assert.ok(webhookLogs.has('rzp_sub_evt_1'));
});

test('subscription.activated persists subscriptionId (Phase 5, H5a: cancel target)', async () => {
  const { db, subscriptionDocs } = makeSubscriptionFakeDb();
  await processRazorpaySubscriptionEvent('subscription.activated', activatedPayload(), 'evt_sub_id', db);

  assert.equal(subscriptionDocs.get('user1').subscriptionId, 'sub_123');
});

test('subscription.completed keeps the prior subscriptionId (visible for support lookups after revoke)', async () => {
  const seed = { tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, startDate: 1000, subscriptionId: 'sub_123' };
  const { db, subscriptionDocs } = makeSubscriptionFakeDb(seed);
  await processRazorpaySubscriptionEvent('subscription.completed', activatedPayload(), 'evt_sub_id_2', db);

  assert.equal(subscriptionDocs.get('user1').subscriptionId, 'sub_123');
});

test('duplicate event id is idempotent (no double-processing)', async () => {
  const { db, subscriptionDocs } = makeSubscriptionFakeDb();
  await processRazorpaySubscriptionEvent('subscription.activated', activatedPayload(), 'evt_dup', db);
  const result = await processRazorpaySubscriptionEvent('subscription.activated', activatedPayload(), 'evt_dup', db);

  assert.equal(result.idempotent, true);
  assert.equal(subscriptionDocs.get('user1').tier, 'PRO');
});

test('subscription.completed revokes to FREE, willRenew:false', async () => {
  const seed = { tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, startDate: 1000 };
  const { db, subscriptionDocs } = makeSubscriptionFakeDb(seed);
  await processRazorpaySubscriptionEvent('subscription.completed', activatedPayload(), 'evt_2', db);

  const doc = subscriptionDocs.get('user1');
  assert.equal(doc.tier, 'FREE');
  assert.equal(doc.willRenew, false);
});

test('refund.processed (payment.entity notes shape) revokes to FREE', async () => {
  const seed = { tier: 'BASIC', source: 'RAZORPAY', expiryDate: Date.now() + 100000, startDate: 1000 };
  const { db, subscriptionDocs } = makeSubscriptionFakeDb(seed);
  const payload = { payment: { entity: { notes: { userId: 'user1', planId: 'basic_monthly' } } } };
  await processRazorpaySubscriptionEvent('refund.processed', payload, 'evt_3', db);

  assert.equal(subscriptionDocs.get('user1').tier, 'FREE');
});

test('subscription.cancelled only flips willRenew, leaves tier/expiryDate untouched', async () => {
  const seed = { tier: 'PREMIUM', source: 'RAZORPAY', expiryDate: 999999, startDate: 1000, willRenew: true };
  const { db, subscriptionDocs } = makeSubscriptionFakeDb(seed);
  await processRazorpaySubscriptionEvent('subscription.cancelled', activatedPayload(), 'evt_4', db);

  const doc = subscriptionDocs.get('user1');
  assert.equal(doc.tier, 'PREMIUM');
  assert.equal(doc.expiryDate, 999999);
  assert.equal(doc.willRenew, false);
});

test('subscription.halted marks billingIssueAt without revoking tier', async () => {
  const seed = { tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, startDate: 1000 };
  const { db, subscriptionDocs } = makeSubscriptionFakeDb(seed);
  await processRazorpaySubscriptionEvent('subscription.halted', activatedPayload(), 'evt_5', db);

  const doc = subscriptionDocs.get('user1');
  assert.equal(doc.tier, 'PRO');
  assert.ok(typeof doc.billingIssueAt === 'number');
});

test('subscription.paused sets willRenew:false, subscription.resumed sets willRenew:true', async () => {
  const seed = { tier: 'PRO', source: 'RAZORPAY', expiryDate: Date.now() + 100000, startDate: 1000, willRenew: true };
  const { db, subscriptionDocs } = makeSubscriptionFakeDb(seed);
  await processRazorpaySubscriptionEvent('subscription.paused', activatedPayload(), 'evt_6', db);
  assert.equal(subscriptionDocs.get('user1').willRenew, false);

  await processRazorpaySubscriptionEvent('subscription.resumed', activatedPayload({ current_end: 1893456000 }), 'evt_7', db);
  assert.equal(subscriptionDocs.get('user1').willRenew, true);
});

test('reconciliation: an active REVENUECAT-sourced doc is not clobbered by a lower-tier Razorpay grant', async () => {
  const seed = { tier: 'PREMIUM', source: 'REVENUECAT', expiryDate: Date.now() + 100000, startDate: 1000 };
  const { db, subscriptionDocs } = makeSubscriptionFakeDb(seed);
  await processRazorpaySubscriptionEvent('subscription.activated', activatedPayload(), 'evt_8', db); // grants PRO

  const doc = subscriptionDocs.get('user1');
  assert.equal(doc.tier, 'PREMIUM');
  assert.equal(doc.source, 'REVENUECAT');
  assert.ok(doc.conflictDetectedAt !== undefined);
});

test('missing userId in notes returns a warning, does not throw', async () => {
  const { db } = makeSubscriptionFakeDb();
  const result = await processRazorpaySubscriptionEvent('subscription.activated', { subscription: { entity: {} } }, 'evt_9', db);
  assert.equal(result.warning, 'missing_user_id');
});
