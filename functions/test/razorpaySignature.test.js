/**
 * Phase B (Dual-Platform Subscription Billing Hardening plan, senior-review fix #6):
 * `verifyRazorpaySignature` was extracted out of `webhooks.js` so it isn't hand-duplicated for
 * the new subscription-family events -- both ride the same `handleRazorpayWebhook` endpoint, but
 * this pins the extracted function's own contract directly.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyRazorpaySignature, timingSafeCompare } = require('../src/lib/razorpaySignature');

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

test('verifyRazorpaySignature accepts a correctly-signed rawBody', () => {
  const secret = 'whsec_test';
  const rawBody = JSON.stringify({ event: 'subscription.activated' });
  const req = {
    headers: { 'x-razorpay-signature': sign(rawBody, secret) },
    rawBody: Buffer.from(rawBody, 'utf-8')
  };
  assert.equal(verifyRazorpaySignature(req, secret), true);
});

test('verifyRazorpaySignature rejects a tampered body', () => {
  const secret = 'whsec_test';
  const rawBody = JSON.stringify({ event: 'subscription.activated' });
  const req = {
    headers: { 'x-razorpay-signature': sign(rawBody, secret) },
    rawBody: Buffer.from(JSON.stringify({ event: 'subscription.completed' }), 'utf-8')
  };
  assert.equal(verifyRazorpaySignature(req, secret), false);
});

test('verifyRazorpaySignature rejects a missing signature header', () => {
  const req = { headers: {}, rawBody: Buffer.from('{}', 'utf-8') };
  assert.equal(verifyRazorpaySignature(req, 'whsec_test'), false);
});

test('timingSafeCompare is re-exported and still constant-time-safe for mismatched lengths', () => {
  assert.equal(timingSafeCompare('abc', 'ab'), false);
  assert.equal(timingSafeCompare('abc', 'abc'), true);
});
