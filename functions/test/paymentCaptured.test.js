/**
 * Phase 3 (H2 + H3, payment ecosystem hardening plan): tests for the legacy Razorpay
 * `payment.captured` path, extracted to `webhooks/paymentCaptured.js` in this phase's mechanical
 * split. Uses a fake Firestore (mirroring `razorpaySubscriptionWebhooks.test.js`'s convention)
 * rather than the emulator.
 *
 * H2: a paying user's `expiryDate` must land in the future, not stay null/stale forever --
 * `applySubscriptionTier` used to write `tier`/`startDate`/`billingCycle` but never `expiryDate`,
 * so a re-subscribing lapsed user read as FREE the instant Phase 0's read-time derivation shipped
 * (paid, and permanently on FREE).
 *
 * H3: a payment entity that belongs to a Razorpay subscription (carries `invoice_id`/
 * `subscription_id`) must be skipped by this legacy handler -- the subscription-family handler in
 * `lib/razorpaySubscriptionWebhook.js` owns it exclusively, via its own `subscription.charged`
 * event, and derives `expiryDate` from Razorpay's authoritative `current_end`. Double-applying
 * `applySubscriptionTier` here would race the two writes within the same delivery.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processPaymentCaptured,
  addOneBillingPeriod,
  isSubscriptionLinkedPayment,
  TIER_PRICES
} = require('../src/webhooks/paymentCaptured');
const { shouldReconcile } = require('../src/subscriptions/scheduledSubscriptionReconciliation');

// Mirrors razorpaySubscriptionWebhooks.test.js's flat-map fake-Firestore convention, extended
// with a `payments` collection (paymentCaptured's replay-detection read/write) alongside
// `webhook_logs` and `users/{uid}/data/subscription`.
function makeFakeDb({ seedSubscription = null, seedPayment = null } = {}) {
  const webhookLogs = new Map();
  const payments = new Map();
  const users = new Map();
  const subscriptionDocs = new Map();
  if (seedSubscription) subscriptionDocs.set('user1', seedSubscription);
  if (seedPayment) payments.set(seedPayment.id, seedPayment.data);

  const subscriptionRef = { store: subscriptionDocs, id: 'user1' };
  const logCollection = { doc: (id) => ({ store: webhookLogs, id }) };
  const paymentsCollection = { doc: (id) => ({ store: payments, id }) };
  const usersCollection = {
    doc: (id) => ({
      store: users,
      id,
      collection: () => ({ doc: () => subscriptionRef })
    })
  };

  const db = {
    collection(name) {
      if (name === 'webhook_logs') return logCollection;
      if (name === 'payments') return paymentsCollection;
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

  return { db, webhookLogs, payments, subscriptionDocs };
}

function paymentEntity(overrides = {}) {
  return {
    id: 'pay_1',
    amount: TIER_PRICES.pro_monthly,
    currency: 'INR',
    notes: { userId: 'user1', planId: 'pro_monthly' },
    ...overrides
  };
}

test('addOneBillingPeriod adds one calendar month, UTC', () => {
  const jan15 = Date.UTC(2026, 0, 15);
  assert.equal(addOneBillingPeriod(jan15), Date.UTC(2026, 1, 15));
});

test('isSubscriptionLinkedPayment is true when invoice_id is present', () => {
  assert.equal(isSubscriptionLinkedPayment({ invoice_id: 'inv_1' }), true);
});

test('isSubscriptionLinkedPayment is true when subscription_id is present', () => {
  assert.equal(isSubscriptionLinkedPayment({ subscription_id: 'sub_1' }), true);
});

test('isSubscriptionLinkedPayment is false for a plain one-time payment', () => {
  assert.equal(isSubscriptionLinkedPayment({ id: 'pay_1' }), false);
});

test('H2: a fresh payment.captured writes an expiryDate one billing period in the future', async () => {
  const { db, subscriptionDocs } = makeFakeDb();
  const now = Date.now();
  const result = await processPaymentCaptured(paymentEntity(), 'evt_1', db);
  assert.equal(result.success, true);
  const doc = subscriptionDocs.get('user1');
  assert.equal(doc.tier, 'PRO');
  assert.ok(doc.expiryDate > now, 'expiryDate must be in the future');
  assert.ok(doc.expiryDate >= now + 27 * 24 * 60 * 60 * 1000, 'expiryDate must be roughly one billing period out');
});

test('H2: a re-subscribing user with a PAST expiryDate ends up with a FUTURE one (the "paid, stuck on FREE" regression)', async () => {
  const past = Date.now() - 1000 * 60 * 60 * 24 * 10; // 10 days ago
  const { db, subscriptionDocs } = makeFakeDb({
    seedSubscription: { tier: 'FREE', startDate: past - 1000, expiryDate: past, billingCycle: 'MONTHLY', source: 'RAZORPAY' }
  });
  const result = await processPaymentCaptured(paymentEntity(), 'evt_2', db);
  assert.equal(result.success, true);
  const doc = subscriptionDocs.get('user1');
  assert.equal(doc.tier, 'PRO');
  assert.ok(doc.expiryDate > Date.now(), 'a lapsed-then-renewed user must end up with a future expiryDate, not stay stuck on FREE');
  assert.equal(
    shouldReconcile(doc, Date.now()),
    false,
    'the reconciliation cron must not immediately downgrade the doc this payment just fixed'
  );
});

test('H2: startDate is preserved across renewals, only expiryDate advances', async () => {
  const originalStart = Date.UTC(2026, 0, 1);
  const { db, subscriptionDocs } = makeFakeDb({
    seedSubscription: { tier: 'PRO', startDate: originalStart, expiryDate: Date.now() - 1000, billingCycle: 'MONTHLY', source: 'RAZORPAY' }
  });
  await processPaymentCaptured(paymentEntity({ id: 'pay_2' }), 'evt_3', db);
  assert.equal(subscriptionDocs.get('user1').startDate, originalStart);
});

test('H3: a payment carrying invoice_id (subscription-family charge) is skipped, not double-applied', async () => {
  const { db, subscriptionDocs } = makeFakeDb();
  const result = await processPaymentCaptured(paymentEntity({ invoice_id: 'inv_1' }), 'evt_4', db);
  assert.equal(result.subscriptionLinked, true);
  assert.equal(subscriptionDocs.has('user1'), false, 'the legacy handler must not write anything for a subscription-linked payment');
});

test('H3: a payment carrying subscription_id (subscription-family charge) is skipped, not double-applied', async () => {
  const { db, subscriptionDocs } = makeFakeDb();
  const result = await processPaymentCaptured(paymentEntity({ subscription_id: 'sub_1' }), 'evt_5', db);
  assert.equal(result.subscriptionLinked, true);
  assert.equal(subscriptionDocs.has('user1'), false);
});

test('a duplicate eventId is idempotent and writes nothing new', async () => {
  const { db, webhookLogs } = makeFakeDb();
  webhookLogs.set('evt_6', { eventId: 'evt_6', userId: 'user1', status: 'processed' });
  const result = await processPaymentCaptured(paymentEntity(), 'evt_6', db);
  assert.equal(result.idempotent, true);
});

test('a payment.id already claimed by another user is a replay attack, rejected', async () => {
  const { db } = makeFakeDb({ seedPayment: { id: 'pay_1', data: { userId: 'someone-else' } } });
  const result = await processPaymentCaptured(paymentEntity(), 'evt_7', db);
  assert.equal(result.replayDetected, true);
});

test('underpayment is rejected and does not apply the tier', async () => {
  const { db, subscriptionDocs } = makeFakeDb();
  const result = await processPaymentCaptured(paymentEntity({ amount: 1 }), 'evt_8', db);
  assert.equal(result.underpaid, true);
  assert.equal(subscriptionDocs.has('user1'), false);
});

test('missing userId in notes is a warning, not a hard failure', async () => {
  const { db } = makeFakeDb();
  const result = await processPaymentCaptured(paymentEntity({ notes: {} }), 'evt_9', db);
  assert.equal(result.warning, 'missing_user_id');
});
