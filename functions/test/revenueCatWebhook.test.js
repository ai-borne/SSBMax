/**
 * Phase 4 (RevenueCat integration): `handleRevenueCatWebhook` is Android/iOS's equivalent of
 * `handleRazorpayWebhook` -- verifies RC's HMAC signature, maps entitlement IDs to a tier
 * (cumulative: premium implies basic+pro), and only writes `data/subscription.tier` for
 * grant/revoke event types. Runs via Node native test runner (node --test), mirroring
 * `security.test.js`'s mock-req/res pattern for onRequest handlers.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { handleRevenueCatWebhook, entitlementIdsToTier, verifySignature } = require('../src/revenueCatWebhook');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; }
  };
  return res;
}

test('entitlementIdsToTier picks the highest cumulative entitlement present', () => {
  assert.equal(entitlementIdsToTier([]), 'FREE');
  assert.equal(entitlementIdsToTier(['basic']), 'BASIC');
  assert.equal(entitlementIdsToTier(['basic', 'pro']), 'PRO');
  assert.equal(entitlementIdsToTier(['basic', 'pro', 'premium']), 'PREMIUM');
  assert.equal(entitlementIdsToTier(undefined), 'FREE');
});

test('verifySignature rejects a missing or malformed signature header', () => {
  assert.equal(verifySignature({ headers: {} }, 'secret'), false);
  assert.equal(verifySignature({ headers: { 'x-revenuecat-webhook-signature': 'garbage' } }, 'secret'), false);
});

test('verifySignature accepts a correctly computed HMAC', () => {
  const secret = 'test_secret';
  const timestamp = '1700000000';
  const rawBody = JSON.stringify({ event: { id: 'evt_1' } });
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const req = {
    headers: { 'x-revenuecat-webhook-signature': `t=${timestamp},v1=${signature}` },
    rawBody: Buffer.from(rawBody, 'utf-8')
  };
  assert.equal(verifySignature(req, secret), true);
});

test('handleRevenueCatWebhook returns 500 when the secret is missing in production', async () => {
  process.env.FUNCTIONS_EMULATOR = 'false';
  delete process.env.REVENUECAT_WEBHOOK_SECRET;

  const res = createMockRes();
  await handleRevenueCatWebhook({ headers: {}, body: {} }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.status, 'error');

  process.env.FUNCTIONS_EMULATOR = 'true';
});

test('handleRevenueCatWebhook returns 400 for an invalid signature', async () => {
  process.env.FUNCTIONS_EMULATOR = 'false';
  process.env.REVENUECAT_WEBHOOK_SECRET = 'test_secret';

  const res = createMockRes();
  await handleRevenueCatWebhook(
    { headers: { 'x-revenuecat-webhook-signature': 't=1,v1=deadbeef' }, body: { event: { id: 'evt_1' } } },
    res
  );

  assert.equal(res.statusCode, 400);

  delete process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.FUNCTIONS_EMULATOR = 'true';
});

test('handleRevenueCatWebhook ignores event types that do not change entitlement (e.g. CANCELLATION)', async () => {
  delete process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.FUNCTIONS_EMULATOR = 'true';

  const res = createMockRes();
  await handleRevenueCatWebhook(
    { headers: {}, body: { event: { id: 'evt_cancel_1', app_user_id: 'user1', type: 'CANCELLATION' } } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ignored, 'CANCELLATION');
});

test('handleRevenueCatWebhook returns 200 with a warning when app_user_id is missing', async () => {
  delete process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.FUNCTIONS_EMULATOR = 'true';

  const res = createMockRes();
  await handleRevenueCatWebhook(
    { headers: {}, body: { event: { id: 'evt_no_user', type: 'INITIAL_PURCHASE' } } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.warning, 'missing_id_or_app_user_id');
});
