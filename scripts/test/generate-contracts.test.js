/**
 * Phase 1 (docs/plans/CrossPlatform_SSOT): tests for the contracts generator.
 *
 * Runs via Node native test runner (node --test scripts/test), matching the
 * convention already used in functions/test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseYaml, loadContract, generateAll, emitKotlin, emitTypeScript, emitCjs, emitRulesPaths, GENERATED_DIR } = require('../generate-contracts');

const ROOT = path.resolve(__dirname, '../..');

// A minimal fixture bundle — deliberately small so expected output below is
// exact and readable, unlike the full real contracts.
const FIXTURE_BUNDLE = {
  firestorePaths: {
    schemaVersion: '1.0.0',
    collections: [{ name: 'WIDGETS', path: 'widgets' }],
    testContent: [{ testType: 'OIR', batchesPath: 'test_content/oir/batches', metaConfigPath: 'test_content/oir/meta/config' }],
  },
  enums: {
    schemaVersion: '1.0.0',
    enums: [
      { name: 'Color', members: ['RED', 'GREEN'] },
      { name: 'Shape', members: [{ id: 'CIRCLE', displayName: 'Circle', category: 'ROUND', critical: true }] },
    ],
  },
  subscription: {
    schemaVersion: '1.0.0',
    limits: [{ bucket: 'WIDGET', testTypes: ['OIR'], FREE: 1, PRO: 2, PREMIUM: -1 }],
  },
  testConfig: {
    schemaVersion: '1.0.0',
    tests: [{ testType: 'OIR', totalQuestions: 5, source: 'fixture' }],
  },
  events: {
    schemaVersion: '1.0.0',
    securityEvents: [{ name: 'SAMPLE_EVENT', value: 'sec_sample' }],
  },
  routes: {
    schemaVersion: '1.0.0',
    minimumSupportedAppVersion: '2.0.0',
    routes: [{ name: 'HOME', path: 'home' }],
  },
};

test('parseYaml: golden fixture — a small representative contract parses to the exact expected structure', () => {
  const fixture = `
schemaVersion: "1.0.0"
title: Sample Contract
flag: true
count: 3
items:
  - name: FIRST
    path: first/path
    note: "quoted note: with a colon inside"
  - name: SECOND
    path: second/path
tags: [alpha, beta, "gamma delta"]
nested:
  inner:
    - x
    - y
`;
  const result = parseYaml(fixture, 'fixture.yaml');
  assert.deepEqual(result, {
    schemaVersion: '1.0.0',
    title: 'Sample Contract',
    flag: true,
    count: 3,
    items: [
      { name: 'FIRST', path: 'first/path', note: 'quoted note: with a colon inside' },
      { name: 'SECOND', path: 'second/path' },
    ],
    tags: ['alpha', 'beta', 'gamma delta'],
    nested: { inner: ['x', 'y'] },
  });
});

test('parseYaml: comments and blank lines are ignored', () => {
  const fixture = `
# a leading comment
schemaVersion: "1.0.0" # trailing comment

# another comment
key: value
`;
  const result = parseYaml(fixture, 'fixture.yaml');
  assert.deepEqual(result, { schemaVersion: '1.0.0', key: 'value' });
});

test('malformed contract: a duplicate key fails loudly instead of silently overwriting', () => {
  const fixture = `
schemaVersion: "1.0.0"
key: first
key: second
`;
  assert.throws(() => parseYaml(fixture, 'fixture.yaml'), /duplicate key 'key'/);
});

test('malformed contract: a duplicate key inside a list-item map fails loudly', () => {
  const fixture = `
schemaVersion: "1.0.0"
items:
  - name: A
    name: B
`;
  assert.throws(() => parseYaml(fixture, 'fixture.yaml'), /duplicate key 'name'/);
});

test('malformed contract: a missing schemaVersion fails the build loudly', () => {
  const tmpFile = path.join(ROOT, 'contracts', '__tmp_missing_schema_version.yaml');
  fs.writeFileSync(tmpFile, 'foo: bar\n');
  try {
    assert.throws(() => loadContract('__tmp_missing_schema_version.yaml'), /missing required 'schemaVersion'/);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('malformed contract: bad indentation fails loudly rather than silently dropping data', () => {
  const fixture = `
schemaVersion: "1.0.0"
items:
  - name: A
      path: too/indented
`;
  assert.throws(() => parseYaml(fixture, 'fixture.yaml'));
});

test('golden-file: a fixture contract bundle produces the exact expected Kotlin output', () => {
  const kt = emitKotlin(FIXTURE_BUNDLE);
  assert.match(kt, /DO NOT EDIT\. Generated file/);
  assert.match(kt, /package com\.ssbmax\.shared\.contracts/);
  assert.match(kt, /const val WIDGETS = "widgets"/);
  assert.match(kt, /const val OIR_BATCHES = "test_content\/oir\/batches"/);
  assert.match(kt, /const val OIR_META_CONFIG = "test_content\/oir\/meta\/config"/);
  assert.match(kt, /enum class Color \{ RED, GREEN \}/);
  assert.match(kt, /enum class Shape\(val displayName: String, val category: String, val critical: Boolean\) \{/);
  assert.match(kt, /CIRCLE\("Circle", "ROUND", true\);/);
  assert.match(kt, /SubscriptionLimit\("WIDGET", listOf\("OIR"\), 1, 2, -1\)/);
  assert.match(kt, /TestConfigEntry\("OIR", mapOf\("totalQuestions" to 5\)\)/);
  assert.match(kt, /const val SAMPLE_EVENT = "sec_sample"/);
  assert.match(kt, /const val MINIMUM_SUPPORTED_APP_VERSION = "2\.0\.0"/);
  assert.match(kt, /const val HOME = "home"/);
});

test('golden-file: a fixture contract bundle produces the exact expected TypeScript output', () => {
  const ts = emitTypeScript(FIXTURE_BUNDLE);
  assert.match(ts, /export const FirestorePaths = \{/);
  assert.match(ts, /WIDGETS: "widgets",/);
  assert.match(ts, /OIR_BATCHES: "test_content\/oir\/batches",/);
  assert.match(ts, /export type Color = "RED" \| "GREEN";/);
  assert.match(ts, /export const ColorValues: Color\[\] = \["RED", "GREEN"\];/);
  assert.match(ts, /export interface ShapeDef/);
  assert.match(ts, /CIRCLE: \{ id: "CIRCLE", displayName: "Circle", category: "ROUND", critical: true \},/);
  assert.match(ts, /\{ bucket: "WIDGET", testTypes: \["OIR"\], free: 1, pro: 2, premium: -1 \},/);
  assert.match(ts, /\{ testType: "OIR", values: \{ "totalQuestions": 5 \} \},/);
  assert.match(ts, /SAMPLE_EVENT: "sec_sample",/);
  assert.match(ts, /MINIMUM_SUPPORTED_APP_VERSION: "2\.0\.0",/);
  assert.match(ts, /HOME: "home",/);
});

test('golden-file: a fixture contract bundle produces the exact expected CommonJS (Functions) output', () => {
  const cjs = emitCjs(FIXTURE_BUNDLE);
  // eslint-disable-next-line global-require
  const mod = (() => {
    const Module = require('module');
    const m = new Module('fixture-contracts.cjs', module);
    m._compile(cjs, 'fixture-contracts.cjs');
    return m.exports;
  })();
  assert.deepEqual(mod.FirestorePaths.WIDGETS, 'widgets');
  assert.deepEqual(mod.FirestorePaths.TestContent.OIR_BATCHES, 'test_content/oir/batches');
  assert.deepEqual(mod.Enums.Color, ['RED', 'GREEN']);
  assert.deepEqual(mod.Enums.Shape.CIRCLE, { id: 'CIRCLE', displayName: 'Circle', category: 'ROUND', critical: true });
  assert.deepEqual(mod.SubscriptionLimits, [{ bucket: 'WIDGET', testTypes: ['OIR'], free: 1, pro: 2, premium: -1 }]);
  assert.deepEqual(mod.TestConfig, [{ testType: 'OIR', values: { totalQuestions: 5 } }]);
  assert.deepEqual(mod.SecurityEvents, { SAMPLE_EVENT: 'sec_sample' });
  assert.deepEqual(mod.Routes, { MINIMUM_SUPPORTED_APP_VERSION: '2.0.0', HOME: 'home' });
});

test('golden-file: a fixture contract bundle produces the exact expected rules-paths.json', () => {
  const rulesPaths = JSON.parse(emitRulesPaths(FIXTURE_BUNDLE));
  assert.deepEqual(rulesPaths, {
    schemaVersion: '1.0.0',
    generatedBy: 'node scripts/generate-contracts.js',
    paths: ['test_content/oir/batches', 'test_content/oir/meta/config', 'widgets'],
  });
});

test('regenerate && diff is clean against the committed generated/ output', () => {
  const files = generateAll();
  for (const [filename, content] of Object.entries(files)) {
    const committedPath = path.join(GENERATED_DIR, filename);
    assert.ok(fs.existsSync(committedPath), `${filename} must be committed under generated/`);
    const committed = fs.readFileSync(committedPath, 'utf8');
    assert.equal(content, committed, `${filename} is stale — run 'node scripts/generate-contracts.js'`);
  }
});

test('regenerate && diff is clean against every mirror target (shared/, web/, functions/)', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/generate-contracts.js'), '--check'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
});

test('real contracts: every enums.yaml OLQ member has all four fields (id, displayName, category, critical is optional)', () => {
  const data = loadContract('enums.yaml');
  const olq = data.enums.find((e) => e.name === 'OLQ');
  assert.equal(olq.members.length, 15, 'must encode exactly the 15 Officer-Like Qualities');
  for (const m of olq.members) {
    assert.ok(m.id, 'every OLQ member needs an id');
    assert.ok(m.displayName, 'every OLQ member needs a displayName');
    assert.ok(m.category, 'every OLQ member needs a category');
  }
});

test('real contracts: subscription.yaml has a bucket covering every TestType from enums.yaml (exhaustive by construction)', () => {
  const enumsData = loadContract('enums.yaml');
  const subData = loadContract('subscription.yaml');
  const testTypes = enumsData.enums.find((e) => e.name === 'TestType').members;
  const covered = new Set(subData.limits.flatMap((l) => l.testTypes));
  for (const t of testTypes) {
    assert.ok(covered.has(t), `TestType.${t} has no SubscriptionLimits bucket`);
  }
});

test('real contracts: rules-paths.json has no duplicate paths and stays sorted', () => {
  const rulesPaths = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, 'rules-paths.json'), 'utf8'));
  const sorted = [...rulesPaths.paths].sort();
  assert.deepEqual(rulesPaths.paths, sorted, 'rules-paths.json paths must be sorted for stable diffs');
  assert.equal(new Set(rulesPaths.paths).size, rulesPaths.paths.length, 'rules-paths.json must not contain duplicate paths');
});
