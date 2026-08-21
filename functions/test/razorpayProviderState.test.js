/**
 * Phase 10 (Payment Ecosystem Hardening plan): tests for `src/lib/razorpayProviderState.js`'s pure
 * `normalizeRazorpayProviderState`. Asserts *why* each mapping matters (root CLAUDE.md Rule 9),
 * mirroring `subscriptionDrift.test.js`'s convention for the pure function this one feeds.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRazorpayProviderState } = require('../src/lib/razorpayProviderState');

const planIdToTier = (planId) => (planId.split('_')[0] || '').toUpperCase();

test('status "active" -> ACTIVE', () => {
  const result = normalizeRazorpayProviderState({ status: 'active', notes: { planId: 'pro_monthly' }, current_end: 1700000000 }, planIdToTier);
  assert.equal(result.status, 'ACTIVE');
  assert.equal(result.tier, 'PRO');
  assert.equal(result.expiryDate, 1700000000000);
});

test('status "cancelled"/"expired"/"completed" -> CANCELLED (a definite, known end)', () => {
  for (const rawStatus of ['cancelled', 'expired', 'completed']) {
    const result = normalizeRazorpayProviderState({ status: rawStatus, notes: {} }, planIdToTier);
    assert.equal(result.status, 'CANCELLED', `expected ${rawStatus} -> CANCELLED`);
  }
});

test('any other status ("created", "authenticated", "pending", "halted") -> UNKNOWN, matching resolveSubscriptionDrift\'s fail-closed stance rather than a second, looser mapping', () => {
  for (const rawStatus of ['created', 'authenticated', 'pending', 'halted']) {
    const result = normalizeRazorpayProviderState({ status: rawStatus, notes: {} }, planIdToTier);
    assert.equal(result.status, 'UNKNOWN', `expected ${rawStatus} -> UNKNOWN`);
  }
});

test('tier is derived via the injected planIdToTierFn, not a second hand-typed table', () => {
  const result = normalizeRazorpayProviderState({ status: 'active', notes: { planId: 'premium_monthly' } }, planIdToTier);
  assert.equal(result.tier, 'PREMIUM');
});

test('missing notes.planId falls back to pro_monthly, matching the sweep\'s existing convention', () => {
  const result = normalizeRazorpayProviderState({ status: 'active', notes: {} }, planIdToTier);
  assert.equal(result.tier, 'PRO');
});

test('expiryDate is null when current_end is absent', () => {
  const result = normalizeRazorpayProviderState({ status: 'active', notes: {} }, planIdToTier);
  assert.equal(result.expiryDate, null);
});
