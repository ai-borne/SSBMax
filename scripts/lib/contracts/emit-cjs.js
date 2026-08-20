'use strict';

const { header, ALL_SOURCE_FILES } = require('./header');

function emitCjs(data) {
  const { firestorePaths, enums, subscription, pricing, testConfig, events, routes, tokens } = data;
  const out = [];
  out.push(header('cjs', ALL_SOURCE_FILES));

  const FirestorePaths = {};
  for (const c of firestorePaths.collections) FirestorePaths[c.name] = c.path;
  FirestorePaths.TestContent = {};
  for (const tc of firestorePaths.testContent) {
    FirestorePaths.TestContent[`${tc.testType}_BATCHES`] = tc.batchesPath;
    if (tc.metaConfigPath) FirestorePaths.TestContent[`${tc.testType}_META_CONFIG`] = tc.metaConfigPath;
  }

  const EnumsOut = {};
  for (const e of enums.enums) {
    const isObjectMembers = e.members.length > 0 && typeof e.members[0] === 'object' && e.members[0] !== null;
    if (!isObjectMembers) {
      EnumsOut[e.name] = e.members;
    } else {
      const rec = {};
      for (const m of e.members) rec[m.id] = { id: m.id, displayName: m.displayName, category: m.category, critical: !!m.critical };
      EnumsOut[e.name] = rec;
    }
  }

  const SubscriptionLimits = subscription.limits.map((l) => ({ bucket: l.bucket, testTypes: l.testTypes, free: l.FREE, basic: l.BASIC, pro: l.PRO, premium: l.PREMIUM }));

  const PricingTiers = Object.entries(pricing.tiers).map(([tier, monthlyInr]) => ({ tier, monthlyInr }));
  const PricingAddons = { ...pricing.addons };

  const TestConfig = testConfig.tests.map((t) => {
    const values = {};
    for (const [k, v] of Object.entries(t)) {
      if (!['testType', 'source', 'note'].includes(k)) values[k] = v;
    }
    return { testType: t.testType, values };
  });

  const SecurityEvents = {};
  for (const ev of events.securityEvents) SecurityEvents[ev.name] = ev.value;

  const Routes = { MINIMUM_SUPPORTED_APP_VERSION: routes.minimumSupportedAppVersion };
  for (const r of routes.routes) Routes[r.name] = r.path;

  const DesignTokens = { light: {}, dark: {} };
  for (const t of tokens.tokens) {
    DesignTokens.light[t.name] = t.light;
    DesignTokens.dark[t.name] = t.dark;
  }

  out.push(`const FirestorePaths = ${JSON.stringify(FirestorePaths, null, 2)};`);
  out.push('');
  out.push(`const Enums = ${JSON.stringify(EnumsOut, null, 2)};`);
  out.push('');
  out.push(`const SubscriptionLimits = ${JSON.stringify(SubscriptionLimits, null, 2)};`);
  out.push('');
  out.push(`const PricingTiers = ${JSON.stringify(PricingTiers, null, 2)};`);
  out.push('');
  out.push(`const PricingAddons = ${JSON.stringify(PricingAddons, null, 2)};`);
  out.push('');
  out.push(`const TestConfig = ${JSON.stringify(TestConfig, null, 2)};`);
  out.push('');
  out.push(`const SecurityEvents = ${JSON.stringify(SecurityEvents, null, 2)};`);
  out.push('');
  out.push(`const Routes = ${JSON.stringify(Routes, null, 2)};`);
  out.push('');
  out.push(`const DesignTokens = ${JSON.stringify(DesignTokens, null, 2)};`);
  out.push('');
  out.push('module.exports = { FirestorePaths, Enums, SubscriptionLimits, PricingTiers, PricingAddons, TestConfig, SecurityEvents, Routes, DesignTokens };');
  out.push('');

  return out.join('\n');
}

module.exports = { emitCjs };
