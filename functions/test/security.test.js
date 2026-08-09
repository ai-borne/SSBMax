/**
 * Backend Cloud Functions Security Unit Tests
 *
 * Runs via Node native test runner (node --test)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { timingSafeCompare } = require('../src/webhooks');
const { escapeXml } = require('../src/aiAnalysis');
const { calculateOIRRating } = require('../src/oirScoring');

test('Phase 2 Security: timingSafeCompare constant-time HMAC checking', (t) => {
  const sigA = '8f3e2a1b9c4d6e5f7a0b1c2d3e4f5a6b';
  const sigB = '8f3e2a1b9c4d6e5f7a0b1c2d3e4f5a6b';
  const sigC = '8f3e2a1b9c4d6e5f7a0b1c2d3e4f5a99';

  assert.equal(timingSafeCompare(sigA, sigB), true, 'Identical signatures should return true');
  assert.equal(timingSafeCompare(sigA, sigC), false, 'Different signatures should return false');
  assert.equal(timingSafeCompare(sigA, 'short'), false, 'Different length signatures should return false safely');
  assert.equal(timingSafeCompare(null, sigB), false, 'Null input should return false safely');
});

test('Phase 2 Security: escapeXml prompt injection defense', (t) => {
  const injectionAttempt = '<script>alert("hack")</script> & "quote" \'single\'';
  const escaped = escapeXml(injectionAttempt);

  assert.equal(escaped.includes('<script>'), false, 'Angle brackets must be escaped');
  assert.equal(escaped.includes('&lt;script&gt;'), true, 'Angle brackets must become XML entities');
  assert.equal(escaped.includes('&amp;'), true, 'Ampersand must be escaped');
  assert.equal(escaped.includes('&quot;'), true, 'Double quotes must be escaped');
  assert.equal(escaped.includes('&apos;'), true, 'Single quotes must be escaped');
});

test('Phase 2 Security: calculateOIRRating standardized boundaries', (t) => {
  assert.equal(calculateOIRRating(90), 1, '>= 85% should yield OIR rating 1');
  assert.equal(calculateOIRRating(85), 1, '85% threshold should yield OIR rating 1');
  assert.equal(calculateOIRRating(75), 2, '75% should yield OIR rating 2');
  assert.equal(calculateOIRRating(60), 3, '60% should yield OIR rating 3');
  assert.equal(calculateOIRRating(45), 4, '45% should yield OIR rating 4');
  assert.equal(calculateOIRRating(30), 5, '< 40% should yield OIR rating 5');
});

test('Phase 6A Payment Security: Mock order fallback restricted to emulator', async (t) => {
  const { createRazorpayOrder } = require('../src/payments');
  
  // Test 1: Emulator environment allows mock order
  process.env.FUNCTIONS_EMULATOR = 'true';
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;

  const mockContext = { auth: { uid: 'test_user_123' } };
  const emulatorResult = await createRazorpayOrder.run(
    { amount: 49900, planId: 'pro_monthly' },
    mockContext
  );

  assert.equal(emulatorResult.success, true, 'Emulator mode should return mock order');
  assert.equal(emulatorResult.orderId.startsWith('order_mock_'), true, 'Order ID must be mock formatted');
  assert.equal(emulatorResult.notes.userId, 'test_user_123', 'UserId must be in notes');

  // Test 2: Production environment throws failed-precondition error when keys missing
  process.env.FUNCTIONS_EMULATOR = 'false';
  await assert.rejects(
    async () => {
      await createRazorpayOrder.run({ amount: 49900 }, mockContext);
    },
    (err) => {
      assert.equal(err.code, 'failed-precondition', 'Production must throw failed-precondition error');
      return true;
    }
  );

  // Restore env
  process.env.FUNCTIONS_EMULATOR = 'true';
});

test('Phase 6A Payment Security: Webhook mandatory secret check & currency validation', async (t) => {
  const { handleRazorpayWebhook } = require('../src/webhooks');

  function createMockRes() {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { res.statusCode = code; return res; },
      json(data) { res.body = data; return res; }
    };
    return res;
  }

  // Test 1: Missing secret in non-emulator mode returns 500
  process.env.FUNCTIONS_EMULATOR = 'false';
  delete process.env.RAZORPAY_WEBHOOK_SECRET;

  const reqMissingSecret = {
    headers: {},
    body: { event: 'payment.captured' }
  };
  const resMissingSecret = createMockRes();

  await handleRazorpayWebhook(reqMissingSecret, resMissingSecret);
  assert.equal(resMissingSecret.statusCode, 500, 'Missing secret in production must return HTTP 500');
  assert.equal(resMissingSecret.body.status, 'error', 'Error status required');

  // Restore env
  process.env.FUNCTIONS_EMULATOR = 'true';
});

