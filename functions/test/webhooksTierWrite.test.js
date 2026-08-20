/**
 * Phase 4 (RevenueCat integration) amendment: `handleRazorpayWebhook` used to update
 * `isPaidMember` on the root `users/{uid}` doc but never `users/{uid}/data/subscription.tier`
 * -- the doc every real gating read path (`GitLiveSubscriptionRepository`/web's
 * `SubscriptionRepository`/`eligibility.js`) actually consults. `planIdToTier` is the pure
 * mapping piece of that fix; the Firestore write itself isn't covered here, matching this
 * test suite's existing convention (see `security.test.js`) of not exercising a live/emulated
 * Firestore transaction.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { planIdToTier } = require('../src/webhooks');

test('planIdToTier maps every real planId to its tier', () => {
  assert.equal(planIdToTier('basic_monthly'), 'BASIC');
  assert.equal(planIdToTier('pro_monthly'), 'PRO');
  assert.equal(planIdToTier('premium_monthly'), 'PREMIUM');
});

test('planIdToTier falls back to PRO for an unrecognized planId', () => {
  assert.equal(planIdToTier('not_a_real_plan'), 'PRO');
});
