/**
 * Phase 2 (H1, payment ecosystem hardening plan): `deriveEffectiveTier` is the SSOT for "does
 * this stored tier still read as active" -- consumed by `eligibility.js`'s quota gate and the
 * reconciliation cron's `shouldReconcile`, mirroring KMP's `GitLiveSubscriptionRepository` and
 * web's `SubscriptionRepository.ts` copies of the same rule.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveEffectiveTier } = require('../src/lib/effectiveTier');

test('deriveEffectiveTier downgrades to FREE once expiryDate is in the past', () => {
  const now = Date.now();
  assert.equal(deriveEffectiveTier('PREMIUM', now - 1, now), 'FREE');
});

test('deriveEffectiveTier honors the stored tier while expiryDate is still in the future', () => {
  const now = Date.now();
  assert.equal(deriveEffectiveTier('PREMIUM', now + 1, now), 'PREMIUM');
});

test('deriveEffectiveTier honors the stored tier when expiryDate is null (legacy grandfathering)', () => {
  const now = Date.now();
  assert.equal(deriveEffectiveTier('PRO', null, now), 'PRO');
});

test('deriveEffectiveTier treats expiryDate == now as not-yet-expired (strict less-than)', () => {
  const now = Date.now();
  assert.equal(deriveEffectiveTier('PRO', now, now), 'PRO');
});
