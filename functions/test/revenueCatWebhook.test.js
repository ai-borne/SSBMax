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
const {
  handleRevenueCatWebhook,
  entitlementIdsToTier,
  verifySignature,
  SIGNATURE_FRESHNESS_WINDOW_MS,
  isSubscriptionActive,
  resolveReconciliation,
  processRevenueCatEvent,
  processRevenueCatTransferEvent
} = require('../src/revenueCatWebhook');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; }
  };
  return res;
}

/**
 * Generic in-memory fake standing in for admin.firestore(), keyed by full path string --
 * same convention as `evaluationCore.test.js`'s `makeFakeDb`.
 */
function makeFakeDb(initialDocs = {}) {
  const store = { ...initialDocs };

  function docRef(path) {
    return {
      path,
      async get() {
        const data = store[path];
        return { exists: data !== undefined, data: () => data };
      },
      async set(value, options) {
        store[path] = options && options.merge ? { ...(store[path] || {}), ...value } : value;
      },
      collection(sub) {
        return collectionRef(`${path}/${sub}`);
      }
    };
  }

  function collectionRef(path) {
    return { doc: (id) => docRef(`${path}/${id}`) };
  }

  return {
    collection: (path) => collectionRef(path),
    async runTransaction(fn) {
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, value, options) => ref.set(value, options)
      };
      return fn(tx);
    },
    _store: store
  };
}

const SUBSCRIPTION_PATH = (uid) => `users/${uid}/data/subscription`;
const USER_PATH = (uid) => `users/${uid}`;
const LOG_PATH = (eventId) => `webhook_logs/rc_${eventId}`;

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

function signedReq(secret, timestampSeconds, rawBody) {
  const signature = crypto.createHmac('sha256', secret).update(`${timestampSeconds}.${rawBody}`).digest('hex');
  return {
    headers: { 'x-revenuecat-webhook-signature': `t=${timestampSeconds},v1=${signature}` },
    rawBody: Buffer.from(rawBody, 'utf-8')
  };
}

test('verifySignature accepts a correctly computed HMAC signed just now', () => {
  const secret = 'test_secret';
  const rawBody = JSON.stringify({ event: { id: 'evt_1' } });
  const nowMs = 1_700_000_000_000;
  const req = signedReq(secret, Math.floor(nowMs / 1000), rawBody);

  assert.equal(verifySignature(req, secret, nowMs), true);
});

/**
 * L1 (Phase 12): before this fix, `t=` was parsed out of the header and then never consulted --
 * a captured, genuinely-signed request (a proxy log, a leaked payload) stayed replayable forever,
 * since the HMAC itself never expires. This is the replay-attack regression test for that gap.
 */
test('verifySignature (L1): rejects a correctly-signed request whose t= is outside the freshness window', () => {
  const secret = 'test_secret';
  const rawBody = JSON.stringify({ event: { id: 'evt_replay' } });
  const signedAtMs = 1_700_000_000_000;
  const req = signedReq(secret, Math.floor(signedAtMs / 1000), rawBody);

  const justOutsideWindow = signedAtMs + SIGNATURE_FRESHNESS_WINDOW_MS + 1_000;
  assert.equal(verifySignature(req, secret, justOutsideWindow), false, 'a stale-but-validly-signed replay must be rejected');
});

test('verifySignature (L1): accepts a signature right at the edge of the freshness window, rejects just past it', () => {
  const secret = 'test_secret';
  const rawBody = JSON.stringify({ event: { id: 'evt_edge' } });
  const signedAtMs = 1_700_000_000_000;
  const req = signedReq(secret, Math.floor(signedAtMs / 1000), rawBody);

  assert.equal(verifySignature(req, secret, signedAtMs + SIGNATURE_FRESHNESS_WINDOW_MS), true);
  assert.equal(verifySignature(req, secret, signedAtMs + SIGNATURE_FRESHNESS_WINDOW_MS + 1), false);
});

test('verifySignature (L1): also rejects a signature timestamped in the future beyond the window (clock skew abuse)', () => {
  const secret = 'test_secret';
  const rawBody = JSON.stringify({ event: { id: 'evt_future' } });
  const signedAtMs = 1_700_000_000_000;
  const req = signedReq(secret, Math.floor(signedAtMs / 1000), rawBody);

  assert.equal(verifySignature(req, secret, signedAtMs - SIGNATURE_FRESHNESS_WINDOW_MS - 1_000), false);
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

test('isSubscriptionActive: null expiry or a future expiry is active; a past expiry is not', () => {
  assert.equal(isSubscriptionActive(null, 1_000), true);
  assert.equal(isSubscriptionActive(1_001, 1_000), true);
  assert.equal(isSubscriptionActive(999, 1_000), false);
});

test('resolveReconciliation: same-source or no-existing-source incoming always wins, no conflict', () => {
  const now = 1_000;
  assert.deepEqual(
    resolveReconciliation(
      { source: null, tier: 'FREE', expiryDate: null },
      { source: 'REVENUECAT', tier: 'PRO', expiryDate: 5_000 },
      now
    ),
    { tier: 'PRO', expiryDate: 5_000, source: 'REVENUECAT', conflict: false }
  );
  assert.deepEqual(
    resolveReconciliation(
      { source: 'REVENUECAT', tier: 'PRO', expiryDate: 5_000 },
      { source: 'REVENUECAT', tier: 'PREMIUM', expiryDate: 6_000 },
      now
    ),
    { tier: 'PREMIUM', expiryDate: 6_000, source: 'REVENUECAT', conflict: false }
  );
});

test('resolveReconciliation: an expired other-source doc does not block the incoming write', () => {
  const resolved = resolveReconciliation(
    { source: 'RAZORPAY', tier: 'PRO', expiryDate: 500 },
    { source: 'REVENUECAT', tier: 'BASIC', expiryDate: 5_000 },
    1_000
  );
  assert.deepEqual(resolved, { tier: 'BASIC', expiryDate: 5_000, source: 'REVENUECAT', conflict: false });
});

test('resolveReconciliation: an active other-source doc with a higher tier wins and flags conflict', () => {
  const resolved = resolveReconciliation(
    { source: 'RAZORPAY', tier: 'PREMIUM', expiryDate: 5_000 },
    { source: 'REVENUECAT', tier: 'BASIC', expiryDate: 6_000 },
    1_000
  );
  assert.deepEqual(resolved, { tier: 'PREMIUM', expiryDate: 5_000, source: 'RAZORPAY', conflict: true });
});

test('resolveReconciliation: an active other-source doc with a lower tier loses but still flags conflict', () => {
  const resolved = resolveReconciliation(
    { source: 'RAZORPAY', tier: 'BASIC', expiryDate: 5_000 },
    { source: 'REVENUECAT', tier: 'PREMIUM', expiryDate: 6_000 },
    1_000
  );
  assert.deepEqual(resolved, { tier: 'PREMIUM', expiryDate: 6_000, source: 'REVENUECAT', conflict: true });
});

test('resolveReconciliation: same tier, active other-source doc -- later expiryDate wins, conflict flagged', () => {
  const resolved = resolveReconciliation(
    { source: 'RAZORPAY', tier: 'PRO', expiryDate: 9_000 },
    { source: 'REVENUECAT', tier: 'PRO', expiryDate: 6_000 },
    1_000
  );
  assert.deepEqual(resolved, { tier: 'PRO', expiryDate: 9_000, source: 'RAZORPAY', conflict: true });
});

/**
 * Phase A: transaction-level behavior via `processRevenueCatEvent` + an injected fake db --
 * mirrors `evaluationCore.test.js`'s fake-Firestore convention rather than a live/emulated
 * transaction, since this codebase's other webhook test file (`webhooksTierWrite.test.js`)
 * explicitly avoids that.
 */
test('processRevenueCatEvent: REFUND revokes tier to FREE and writes the idempotency log', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PRO', source: 'REVENUECAT', expiryDate: 5_000, startDate: 100 }
  });
  const event = { id: 'evt_refund_1', app_user_id: 'user1', type: 'REFUND' };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.tier, 'FREE');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].tier, 'FREE');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].startDate, 100, 'startDate is preserved, not cleared');
  assert.equal(db._store[LOG_PATH('evt_refund_1')].status, 'processed');
  assert.equal(db._store[LOG_PATH('evt_refund_1')].tier, 'FREE');
});

test('processRevenueCatEvent: BILLING_ISSUE leaves tier untouched and writes billingIssueAt', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PRO', source: 'REVENUECAT', expiryDate: 9_999_999_999_999, startDate: 100 }
  });
  const event = { id: 'evt_billing_1', app_user_id: 'user1', type: 'BILLING_ISSUE' };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.tier, 'PRO', 'tier must not be revoked on BILLING_ISSUE alone');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].tier, 'PRO');
  assert.equal(typeof db._store[SUBSCRIPTION_PATH('user1')].billingIssueAt, 'number');
});

test('processRevenueCatEvent: duplicate event delivery is idempotent and does not re-process', async () => {
  const db = makeFakeDb({
    [LOG_PATH('evt_dup_1')]: { eventId: 'evt_dup_1', status: 'processed' }
  });
  const event = { id: 'evt_dup_1', app_user_id: 'user1', type: 'BILLING_ISSUE' };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.idempotent, true);
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')], undefined, 'no subscription write on a duplicate delivery');
});

test('processRevenueCatEvent: a following RENEWAL clears a prior billingIssueAt flag', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PRO', source: 'REVENUECAT', expiryDate: 5_000, startDate: 100, billingIssueAt: 12345 }
  });
  const event = {
    id: 'evt_renewal_1',
    app_user_id: 'user1',
    type: 'RENEWAL',
    entitlement_ids: ['pro'],
    expiration_at_ms: 9_999_999_999_999
  };

  await processRevenueCatEvent(event, db);

  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].billingIssueAt, null);
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].tier, 'PRO');
});

test('processRevenueCatEvent: an active Razorpay-sourced doc blocks an RC grant and flags conflictDetectedAt', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PREMIUM', source: 'RAZORPAY', expiryDate: 9_999_999_999_999, startDate: 100 }
  });
  const event = {
    id: 'evt_conflict_1',
    app_user_id: 'user1',
    type: 'INITIAL_PURCHASE',
    entitlement_ids: ['basic'],
    expiration_at_ms: 8_888_888_888_888
  };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.tier, 'PREMIUM', 'the higher, still-active Razorpay tier wins');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].source, 'RAZORPAY');
  assert.ok(db._store[SUBSCRIPTION_PATH('user1')].conflictDetectedAt, 'conflictDetectedAt must be stamped');
});

test('processRevenueCatEvent: an expired Razorpay-sourced doc does not block an RC grant', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PREMIUM', source: 'RAZORPAY', expiryDate: 1, startDate: 100 }
  });
  const event = {
    id: 'evt_no_conflict_1',
    app_user_id: 'user1',
    type: 'INITIAL_PURCHASE',
    entitlement_ids: ['basic'],
    expiration_at_ms: 8_888_888_888_888
  };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.tier, 'BASIC');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].source, 'REVENUECAT');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].conflictDetectedAt, undefined);
});

/**
 * Phase 4 (H4, payment ecosystem hardening plan): `app_user_id` reaching this webhook with no
 * corresponding `users/{uid}` doc means RevenueCat's identity was never actually linked to a real
 * Firebase user -- the "purchase before auth settles" race this phase closes client-side too
 * (`DefaultRevenueCatClient`/`UpgradeViewModel`). Before this, `transaction.set(subscriptionRef,
 * ..., { merge: true })` would happily create an orphan `users/{unknown-id}/data/subscription`
 * doc that no real signed-in session could ever read or reconcile.
 */
test('processRevenueCatEvent: an app_user_id with no users/{uid} doc is rejected, not granted an orphan doc', async () => {
  const db = makeFakeDb(); // no users/user1 doc seeded at all
  const event = {
    id: 'evt_orphan_1',
    app_user_id: 'user1',
    type: 'INITIAL_PURCHASE',
    entitlement_ids: ['premium'],
    expiration_at_ms: 9_999_999_999_999
  };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.rejected, 'unknown_app_user_id');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')], undefined, 'no orphan subscription doc must be created');
  assert.equal(db._store[LOG_PATH('evt_orphan_1')], undefined, 'not logged as processed -- a real signup later must not look like a duplicate delivery');
});

test('processRevenueCatEvent: rejects an unknown app_user_id even for a revoke event type', async () => {
  const db = makeFakeDb();
  const event = { id: 'evt_orphan_2', app_user_id: 'ghost-user', type: 'EXPIRATION' };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.rejected, 'unknown_app_user_id');
});

/**
 * M1 (Phase 11, out-of-order delivery): a stale EXPIRATION arriving after a fresher RENEWAL
 * already applied must not revoke -- this is the exact scenario the plan states the fix for.
 */
test('processRevenueCatEvent (M1): a stale EXPIRATION arriving after a fresher RENEWAL does not revoke', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PRO', source: 'REVENUECAT', expiryDate: 9_999_999_999_999, startDate: 100, lastEventAtMs: 5_000 }
  });
  const staleExpiration = { id: 'evt_stale_exp', app_user_id: 'user1', type: 'EXPIRATION', event_timestamp_ms: 4_000 };

  const result = await processRevenueCatEvent(staleExpiration, db);

  assert.equal(result.stale, true);
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].tier, 'PRO', 'the fresher RENEWAL state must survive the late EXPIRATION');
});

test('processRevenueCatEvent (M1): an event newer than lastEventAtMs is applied and bumps lastEventAtMs', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PRO', source: 'REVENUECAT', expiryDate: 9_999_999_999_999, startDate: 100, lastEventAtMs: 5_000 }
  });
  const freshExpiration = { id: 'evt_fresh_exp', app_user_id: 'user1', type: 'EXPIRATION', event_timestamp_ms: 6_000 };

  const result = await processRevenueCatEvent(freshExpiration, db);

  assert.equal(result.stale, undefined);
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].tier, 'FREE');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].lastEventAtMs, 6_000);
});

test('processRevenueCatEvent (M1): no event_timestamp_ms on the event never blocks processing', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PRO', source: 'REVENUECAT', expiryDate: 9_999_999_999_999, startDate: 100, lastEventAtMs: 5_000 }
  });
  const event = { id: 'evt_no_ts', app_user_id: 'user1', type: 'EXPIRATION' };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.stale, undefined);
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].tier, 'FREE');
});

/**
 * L3 (Phase 12): SUBSCRIPTION_PAUSED (a Google Play user-initiated pause) used to fall through the
 * dispatcher's ignored-event-types filter entirely -- a paused user kept PRO/PREMIUM forever. It's
 * now folded into REVOKE_EVENT_TYPES, so it goes through the exact same `processRevenueCatEvent`
 * path as EXPIRATION/REFUND.
 */
test('processRevenueCatEvent (L3): SUBSCRIPTION_PAUSED revokes to FREE, unlike Razorpay\'s subscription.paused', async () => {
  const db = makeFakeDb({
    [USER_PATH('user1')]: { email: 'user1@example.com' },
    [SUBSCRIPTION_PATH('user1')]: { tier: 'PRO', source: 'REVENUECAT', expiryDate: 9_999_999_999_999, startDate: 100 }
  });
  const event = { id: 'evt_paused_1', app_user_id: 'user1', type: 'SUBSCRIPTION_PAUSED' };

  const result = await processRevenueCatEvent(event, db);

  assert.equal(result.tier, 'FREE');
  assert.equal(db._store[SUBSCRIPTION_PATH('user1')].tier, 'FREE');
});

/**
 * L3 (Phase 12): TRANSFER used to fall through the dispatcher's ignored-event-types filter --
 * the original owner kept their tier forever even after RevenueCat moved the entitlement to
 * someone else. `processRevenueCatTransferEvent` closes exactly that gap: every uid in
 * `transferred_from` that's still RevenueCat-sourced gets downgraded to FREE.
 */
test('processRevenueCatTransferEvent (L3): revokes every transferred_from uid that is still RevenueCat-sourced', async () => {
  const db = makeFakeDb({
    [SUBSCRIPTION_PATH('old_owner')]: { tier: 'PREMIUM', source: 'REVENUECAT', expiryDate: 9_999_999_999_999, startDate: 100 }
  });
  const event = { id: 'evt_transfer_1', type: 'TRANSFER', transferred_from: ['old_owner'], transferred_to: ['new_owner'] };

  const result = await processRevenueCatTransferEvent(event, db);

  assert.deepEqual(result.revokedUserIds, ['old_owner']);
  assert.equal(db._store[SUBSCRIPTION_PATH('old_owner')].tier, 'FREE');
});

test('processRevenueCatTransferEvent (L3): does not touch a transferred_from uid whose doc is no longer RevenueCat-sourced', async () => {
  const db = makeFakeDb({
    [SUBSCRIPTION_PATH('old_owner')]: { tier: 'PRO', source: 'RAZORPAY', expiryDate: 9_999_999_999_999, startDate: 100 }
  });
  const event = { id: 'evt_transfer_2', type: 'TRANSFER', transferred_from: ['old_owner'], transferred_to: ['new_owner'] };

  const result = await processRevenueCatTransferEvent(event, db);

  assert.deepEqual(result.revokedUserIds, [], 'a doc since overwritten by another source must not be touched');
  assert.equal(db._store[SUBSCRIPTION_PATH('old_owner')].tier, 'PRO');
});

test('processRevenueCatTransferEvent (L3): a transferred_from uid with no subscription doc at all is skipped, not thrown', async () => {
  const db = makeFakeDb({});
  const event = { id: 'evt_transfer_3', type: 'TRANSFER', transferred_from: ['ghost_owner'], transferred_to: ['new_owner'] };

  const result = await processRevenueCatTransferEvent(event, db);

  assert.deepEqual(result.revokedUserIds, []);
});

test('processRevenueCatTransferEvent (L3): duplicate event delivery is idempotent', async () => {
  const db = makeFakeDb({
    [SUBSCRIPTION_PATH('old_owner')]: { tier: 'PREMIUM', source: 'REVENUECAT', expiryDate: 9_999_999_999_999, startDate: 100 }
  });
  const event = { id: 'evt_transfer_4', type: 'TRANSFER', transferred_from: ['old_owner'], transferred_to: ['new_owner'] };

  await processRevenueCatTransferEvent(event, db);
  const second = await processRevenueCatTransferEvent(event, db);

  assert.equal(second.idempotent, true);
});

test('handleRevenueCatWebhook (L3): TRANSFER is no longer ignored', async () => {
  delete process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.FUNCTIONS_EMULATOR = 'true';

  const res = createMockRes();
  await handleRevenueCatWebhook(
    {
      headers: {},
      body: { event: { id: 'evt_transfer_dispatch', app_user_id: 'new_owner', type: 'TRANSFER', transferred_from: ['old_owner'] } }
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ignored, undefined, 'TRANSFER must not be reported as ignored any more');
});
