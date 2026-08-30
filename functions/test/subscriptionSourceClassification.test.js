/**
 * Phase 10 (Payment Ecosystem Hardening plan): tests for
 * `src/lib/subscriptionSourceClassification.js`'s pure `classifySubscriptionSource`. Each case
 * asserts *why* it matters (root CLAUDE.md Rule 9) -- the whole point of this file is that
 * "RAZORPAY_INCOMPLETE" and "NONE" must never collapse into the same rendered message, so that
 * distinction is what's pinned first.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifySubscriptionSource, SOURCE_KINDS } = require('../src/lib/subscriptionSourceClassification');

test('source RAZORPAY + subscriptionId present -> RAZORPAY', () => {
  assert.equal(
    classifySubscriptionSource({ source: 'RAZORPAY', subscriptionId: 'sub_abc', tier: 'PRO' }),
    SOURCE_KINDS.RAZORPAY
  );
});

test('source RAZORPAY + no subscriptionId -> RAZORPAY_INCOMPLETE (the live issue-1 case: a legacy doc predating Phase 5, unverifiable against Razorpay -- must not read as "no purchase")', () => {
  assert.equal(
    classifySubscriptionSource({ source: 'RAZORPAY', tier: 'PRO' }),
    SOURCE_KINDS.RAZORPAY_INCOMPLETE
  );
});

test('source REVENUECAT -> REVENUECAT', () => {
  assert.equal(classifySubscriptionSource({ source: 'REVENUECAT', tier: 'PREMIUM' }), SOURCE_KINDS.REVENUECAT);
});

test('a source value that is none of the known ones -> LEGACY_OR_UNKNOWN, distinct from a clean "no purchase" state (issue 4)', () => {
  assert.equal(classifySubscriptionSource({ source: 'STRIPE', tier: 'PRO' }), SOURCE_KINDS.LEGACY_OR_UNKNOWN);
});

test('no source field and tier FREE -> NONE', () => {
  assert.equal(classifySubscriptionSource({ tier: 'FREE' }), SOURCE_KINDS.NONE);
  assert.equal(classifySubscriptionSource({ exists: false, tier: 'FREE' }), SOURCE_KINDS.NONE);
});

test('no source field but tier is not FREE -> LEGACY_OR_UNKNOWN (a pre-Phase-4 doc that never recorded provenance is not the same fact as "no purchase")', () => {
  assert.equal(classifySubscriptionSource({ tier: 'PRO' }), SOURCE_KINDS.LEGACY_OR_UNKNOWN);
});
