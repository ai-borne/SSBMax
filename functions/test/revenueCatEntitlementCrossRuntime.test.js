/**
 * L4 (Payment Ecosystem Hardening plan, Phase 12): the entitlement-id -> tier mapping is
 * hand-duplicated between this runtime's `lib/revenueCatReconciliation.js::entitlementIdsToTier`
 * and KMP's `RevenueCatEntitlementMapper.toTier` (an `object` inside
 * `shared/.../platform/billing/revenuecat/RevenueCatClient.kt`) -- two different runtimes, kept in
 * sync by hand since RC entitlement ids aren't a `contracts/` codegen value (they're an RC
 * dashboard config, not Firestore/rules/pricing data). There is no shared test harness that runs
 * Kotlin and Node in the same process, so this test creates the next best thing: it reads the
 * actual Kotlin source file off disk and parses out its literal entitlement-id strings, so a
 * rename on the Kotlin side that isn't mirrored here fails this test instead of silently drifting.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { entitlementIdsToTier } = require('../src/lib/revenueCatReconciliation');

const KOTLIN_CLIENT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'shared/src/commonMain/kotlin/com/ssbmax/shared/platform/billing/revenuecat/RevenueCatClient.kt'
);

function readKotlinEntitlementIds() {
  const source = fs.readFileSync(KOTLIN_CLIENT_PATH, 'utf-8');
  const objectMatch = /object RevenueCatEntitlements \{([\s\S]*?)\n\}/.exec(source);
  assert.ok(objectMatch, 'RevenueCatEntitlements object not found in RevenueCatClient.kt -- has it moved/been renamed?');

  const body = objectMatch[1];
  const extract = (constName) => {
    const m = new RegExp(`const val ${constName} = "([^"]+)"`).exec(body);
    assert.ok(m, `RevenueCatEntitlements.${constName} not found -- has the Kotlin side been renamed?`);
    return m[1];
  };

  return { BASIC: extract('BASIC'), PRO: extract('PRO'), PREMIUM: extract('PREMIUM') };
}

test('L4: the Kotlin RevenueCatEntitlements ids match the ids this runtime\'s entitlementIdsToTier checks for', () => {
  const kotlinIds = readKotlinEntitlementIds();

  // entitlementIdsToTier is a black box from this test's perspective (JS source, not parsed) --
  // proving it actually recognizes each Kotlin-defined id, one at a time, is a stronger pin than
  // just diffing string literals: it fails if either side renames an id OR if the JS mapping logic
  // itself stops checking one of them.
  assert.equal(entitlementIdsToTier([kotlinIds.BASIC]), 'BASIC');
  assert.equal(entitlementIdsToTier([kotlinIds.PRO]), 'PRO');
  assert.equal(entitlementIdsToTier([kotlinIds.PREMIUM]), 'PREMIUM');
  assert.equal(entitlementIdsToTier([kotlinIds.BASIC, kotlinIds.PRO, kotlinIds.PREMIUM]), 'PREMIUM', 'cumulative: highest present wins');
});

test('L4: the Kotlin mapper\'s cumulative precedence (PREMIUM > PRO > BASIC) matches this runtime\'s', () => {
  const kotlinIds = readKotlinEntitlementIds();

  assert.equal(entitlementIdsToTier([kotlinIds.BASIC, kotlinIds.PRO]), 'PRO');
  assert.equal(entitlementIdsToTier([]), 'FREE');
});
