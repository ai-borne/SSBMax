/**
 * Phase 7 (Payment Ecosystem Hardening plan): tests for `src/lib/subscriptionDrift.js`'s pure
 * `resolveSubscriptionDrift`. Against the pure function only -- no Firestore, no HTTP -- each
 * case asserts *why* it matters (root CLAUDE.md Rule 9), mirroring `effectiveTier.test.js`'s
 * convention for the sibling pure-function file this one consumes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSubscriptionDrift, DRIFT_ACTIONS } = require('../src/lib/subscriptionDrift');

const NOW = 1_700_000_000_000;

test('provider ACTIVE + stored FREE -> REPAIR_UP (the "paid but locked out" case this phase exists for)', () => {
  const result = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'PRO', expiryDate: NOW + 100000 },
    { tier: 'FREE', expiryDate: null },
    NOW
  );
  assert.deepEqual(result, { action: DRIFT_ACTIONS.REPAIR_UP, tier: 'PRO', expiryDate: NOW + 100000 });
});

test('provider ACTIVE + stored same tier, same expiry -> NONE (the sweep must be a no-op in the 99.9% case, or it rewrites every doc every run)', () => {
  const result = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'PRO', expiryDate: NOW + 100000 },
    { tier: 'PRO', expiryDate: NOW + 100000 },
    NOW
  );
  assert.deepEqual(result, { action: DRIFT_ACTIONS.NONE });
});

test('provider ACTIVE + stored higher tier -> FLAG_CONFLICT, not a silent downgrade (dual mobile+web purchase must not have one clobber the other)', () => {
  const result = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'BASIC', expiryDate: NOW + 100000 },
    { tier: 'PREMIUM', expiryDate: NOW + 200000 },
    NOW
  );
  assert.deepEqual(result, { action: DRIFT_ACTIONS.FLAG_CONFLICT });
});

test('provider CANCELLED/HALTED + stored active-but-unexpired -> NONE; the downward cron owns expiry (no two writers for one transition)', () => {
  for (const status of ['CANCELLED', 'HALTED']) {
    const result = resolveSubscriptionDrift(
      { status, tier: 'PRO', expiryDate: NOW + 100000 },
      { tier: 'PRO', expiryDate: NOW + 100000 },
      NOW
    );
    assert.deepEqual(result, { action: DRIFT_ACTIONS.NONE }, `status=${status}`);
  }
});

test('provider ACTIVE + stored active + provider expiry LATER -> REPAIR_UP (a missed subscription.charged leaves a stale expiry -- fine today, locked out next week)', () => {
  const result = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'PRO', expiryDate: NOW + 500000 },
    { tier: 'PRO', expiryDate: NOW + 100000 },
    NOW
  );
  assert.deepEqual(result, { action: DRIFT_ACTIONS.REPAIR_UP, tier: 'PRO', expiryDate: NOW + 500000 });
});

test('unknown/missing provider state -> NONE, never a downgrade (fail closed means never revoking on ambiguity)', () => {
  assert.deepEqual(resolveSubscriptionDrift(null, { tier: 'PRO', expiryDate: NOW + 100000 }, NOW), { action: DRIFT_ACTIONS.NONE });
  assert.deepEqual(
    resolveSubscriptionDrift({ status: 'UNKNOWN' }, { tier: 'PRO', expiryDate: NOW + 100000 }, NOW),
    { action: DRIFT_ACTIONS.NONE }
  );
  assert.deepEqual(
    resolveSubscriptionDrift(undefined, { tier: 'FREE', expiryDate: null }, NOW),
    { action: DRIFT_ACTIONS.NONE }
  );
});

test('provider ACTIVE + stored expired (effectively FREE) -> REPAIR_UP, using deriveEffectiveTier not the raw stored tier', () => {
  // Stored doc still says PRO on disk but its expiryDate is in the past -- the downward cron
  // hasn't run yet. Drift resolution must judge against the EFFECTIVE tier (FREE), the same rule
  // eligibility.js and both clients use, not the stale raw field -- otherwise this looks like a
  // same-tier no-op and the "locked out" user is never repaired.
  const result = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'PRO', expiryDate: NOW + 100000 },
    { tier: 'PRO', expiryDate: NOW - 1 },
    NOW
  );
  assert.deepEqual(result, { action: DRIFT_ACTIONS.REPAIR_UP, tier: 'PRO', expiryDate: NOW + 100000 });
});

test('provider ACTIVE at FREE tier + stored FREE -> NONE (FREE-vs-FREE is never repair-worthy, even with differing expiry noise)', () => {
  const result = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'FREE', expiryDate: NOW + 100000 },
    { tier: 'FREE', expiryDate: null },
    NOW
  );
  assert.deepEqual(result, { action: DRIFT_ACTIONS.NONE });
});

test('provider ACTIVE + stored same tier + provider expiry EARLIER or EQUAL -> NONE (never repair backwards on expiry)', () => {
  const earlier = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'PRO', expiryDate: NOW + 50000 },
    { tier: 'PRO', expiryDate: NOW + 100000 },
    NOW
  );
  assert.deepEqual(earlier, { action: DRIFT_ACTIONS.NONE });

  const equal = resolveSubscriptionDrift(
    { status: 'ACTIVE', tier: 'PRO', expiryDate: NOW + 100000 },
    { tier: 'PRO', expiryDate: NOW + 100000 },
    NOW
  );
  assert.deepEqual(equal, { action: DRIFT_ACTIONS.NONE });
});
