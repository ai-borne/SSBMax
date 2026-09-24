/**
 * SSBMax and ActionStation share ONE Razorpay account, so Razorpay delivers every ActionStation
 * event to this webhook too. ActionStation stamps `notes.source = 'actionstation'` on its orders
 * (server-side) and its notes carry `userId`/`planId` in the same shape as ours -- without this
 * filter an ActionStation payment could be read as an SSBMax upgrade or rejected as an
 * "underpayment" (400 -> Razorpay retries -> the webhook is eventually disabled).
 * Events with no `source` (every SSBMax payment made before this filter existed) are OURS.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { isForeignAppEvent } = require('../src/lib/razorpayForeignEvent');

const paymentEvent = (notes) => ({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', notes } } } });
const subscriptionEvent = (notes) => ({ event: 'subscription.activated', payload: { subscription: { entity: { id: 'sub_1', notes } } } });

test('a payment stamped source=actionstation is foreign', () => {
  assert.equal(isForeignAppEvent(paymentEvent({ userId: 'u1', planId: 'pro_annual', source: 'actionstation' })), true);
});

test('a subscription stamped source=actionstation is foreign', () => {
  assert.equal(isForeignAppEvent(subscriptionEvent({ source: 'actionstation' })), true);
});

test('a legacy SSBMax payment with no source is ours, never ignored', () => {
  assert.equal(isForeignAppEvent(paymentEvent({ userId: 'u1', planId: 'pro_monthly' })), false);
});

test('an SSBMax-stamped payment is ours', () => {
  assert.equal(isForeignAppEvent(paymentEvent({ userId: 'u1', planId: 'pro_monthly', source: 'ssbmax' })), false);
});

test('malformed or empty bodies are not foreign (existing handling stays in charge)', () => {
  for (const body of [undefined, null, {}, { event: 'payment.captured' }, { payload: null }, paymentEvent(undefined), paymentEvent(null), paymentEvent('actionstation')]) {
    assert.equal(isForeignAppEvent(body), false);
  }
});
