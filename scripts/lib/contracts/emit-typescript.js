'use strict';

const { header, ALL_SOURCE_FILES } = require('./header');

function tsString(s) {
  return JSON.stringify(String(s));
}

function emitTypeScript(data) {
  const { firestorePaths, enums, subscription, testConfig, events, routes, tokens } = data;
  const out = [];
  out.push(header('ts', ALL_SOURCE_FILES));

  out.push('export const FirestorePaths = {');
  for (const c of firestorePaths.collections) {
    out.push(`  ${c.name}: ${tsString(c.path)},`);
  }
  out.push('  TestContent: {');
  for (const tc of firestorePaths.testContent) {
    out.push(`    ${tc.testType}_BATCHES: ${tsString(tc.batchesPath)},`);
    if (tc.metaConfigPath) {
      out.push(`    ${tc.testType}_META_CONFIG: ${tsString(tc.metaConfigPath)},`);
    }
  }
  out.push('  },');
  out.push('} as const;');
  out.push('');

  for (const e of enums.enums) {
    const isObjectMembers = e.members.length > 0 && typeof e.members[0] === 'object' && e.members[0] !== null;
    if (!isObjectMembers) {
      out.push(`export type ${e.name} = ${e.members.map((m) => tsString(m)).join(' | ')};`);
      out.push(`export const ${e.name}Values: ${e.name}[] = [${e.members.map((m) => tsString(m)).join(', ')}];`);
    } else {
      out.push(`export interface ${e.name}Def { id: string; displayName: string; category: string; critical: boolean; }`);
      out.push(`export const ${e.name}: Record<string, ${e.name}Def> = {`);
      for (const m of e.members) {
        out.push(`  ${m.id}: { id: ${tsString(m.id)}, displayName: ${tsString(m.displayName)}, category: ${tsString(m.category)}, critical: ${m.critical ? 'true' : 'false'} },`);
      }
      out.push('};');
    }
    out.push('');
  }

  out.push('export interface SubscriptionLimit { bucket: string; testTypes: string[]; free: number; pro: number; premium: number; }');
  out.push('export const SubscriptionLimits: SubscriptionLimit[] = [');
  for (const l of subscription.limits) {
    out.push(`  { bucket: ${tsString(l.bucket)}, testTypes: [${l.testTypes.map((t) => tsString(t)).join(', ')}], free: ${l.FREE}, pro: ${l.PRO}, premium: ${l.PREMIUM} },`);
  }
  out.push('];');
  out.push('');

  out.push('export interface TestConfigEntry { testType: string; values: Record<string, unknown>; }');
  out.push('export const TestConfig: TestConfigEntry[] = [');
  for (const t of testConfig.tests) {
    const values = Object.entries(t).filter(([k]) => !['testType', 'source', 'note'].includes(k));
    const mapEntries = values.map(([k, v]) => `${JSON.stringify(k)}: ${typeof v === 'string' ? tsString(v) : v}`).join(', ');
    out.push(`  { testType: ${tsString(t.testType)}, values: { ${mapEntries} } },`);
  }
  out.push('];');
  out.push('');

  out.push('export const SecurityEvents = {');
  for (const ev of events.securityEvents) {
    out.push(`  ${ev.name}: ${tsString(ev.value)},`);
  }
  out.push('} as const;');
  out.push('');

  out.push('export const Routes = {');
  out.push(`  MINIMUM_SUPPORTED_APP_VERSION: ${tsString(routes.minimumSupportedAppVersion)},`);
  for (const r of routes.routes) {
    out.push(`  ${r.name}: ${tsString(r.path)},`);
  }
  out.push('} as const;');
  out.push('');

  out.push('export interface Palette {');
  for (const t of tokens.tokens) {
    out.push(`  ${t.name}: string;`);
  }
  out.push('}');
  out.push('export const DesignTokens: { light: Palette; dark: Palette } = {');
  out.push('  light: {');
  for (const t of tokens.tokens) {
    out.push(`    ${t.name}: ${tsString(t.light)},`);
  }
  out.push('  },');
  out.push('  dark: {');
  for (const t of tokens.tokens) {
    out.push(`    ${t.name}: ${tsString(t.dark)},`);
  }
  out.push('  },');
  out.push('};');
  out.push('');

  return out.join('\n');
}

module.exports = { emitTypeScript };
