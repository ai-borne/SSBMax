/**
 * Phase 8 (Payment Ecosystem Hardening plan, "deployed-rules drift detection"): tests for
 * `scripts/check-rules-drift.js`. Every API call goes through an injectable `{ request }` client,
 * mirroring `setOpsAlerting.test.js`'s convention -- never a live GCP project.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchDeployedRulesSource, compareRulesSource, runCheck } = require('../scripts/check-rules-drift');

const PROJECT_ID = 'ssbmax-49e68';

function makeFakeClient({ releaseData, rulesetData, failOn = null }) {
  return {
    async request({ url }) {
      if (failOn && url.includes(failOn)) {
        throw new Error('simulated network failure');
      }
      if (url.includes('/releases/')) return { data: releaseData };
      if (url.includes('/rulesets/')) return { data: rulesetData };
      throw new Error(`unexpected url ${url}`);
    }
  };
}

const RULESET_NAME = `projects/${PROJECT_ID}/rulesets/abc123`;

test('fetchDeployedRulesSource follows release -> ruleset and returns the firestore.rules file content', async () => {
  const client = makeFakeClient({
    releaseData: { name: `projects/${PROJECT_ID}/releases/cloud.firestore`, rulesetName: RULESET_NAME },
    rulesetData: { name: RULESET_NAME, source: { files: [{ name: 'firestore.rules', content: 'rules_version = \'2\';' }] } }
  });

  const content = await fetchDeployedRulesSource(client, PROJECT_ID);
  assert.equal(content, 'rules_version = \'2\';');
});

test('fetchDeployedRulesSource throws when the release has no rulesetName', async () => {
  const client = makeFakeClient({ releaseData: {}, rulesetData: {} });
  await assert.rejects(() => fetchDeployedRulesSource(client, PROJECT_ID), /no active release found/);
});

test('compareRulesSource is an exact match, not a normalized/whitespace-insensitive one', () => {
  assert.equal(compareRulesSource('a\nb\n', 'a\nb\n'), true);
  assert.equal(compareRulesSource('a\nb\n', 'a\nb'), false, 'even a trailing-newline difference must be flagged, not silently normalized');
});

test('runCheck: identical deployed and local content exits (reports) in sync', async () => {
  const rulesContent = 'rules_version = \'2\';\nservice cloud.firestore { }';
  const client = makeFakeClient({
    releaseData: { rulesetName: RULESET_NAME },
    rulesetData: { source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }
  });

  const result = await runCheck(client, PROJECT_ID, rulesContent);
  assert.equal(result.inSync, true);
  assert.equal(result.reason, 'match');
});

test('runCheck: a real diff between deployed and local content is reported, not in sync', async () => {
  const client = makeFakeClient({
    releaseData: { rulesetName: RULESET_NAME },
    rulesetData: { source: { files: [{ name: 'firestore.rules', content: 'deployed version' }] } }
  });

  const result = await runCheck(client, PROJECT_ID, 'local version -- different');
  assert.equal(result.inSync, false);
  assert.equal(result.reason, 'diff');
});

test('runCheck: an API error is reported as inSync: false with a distinct reason -- never silently "in sync"', async () => {
  const client = makeFakeClient({ releaseData: {}, rulesetData: {}, failOn: '/releases/' });

  const result = await runCheck(client, PROJECT_ID, 'anything');
  assert.equal(result.inSync, false, 'an unknown state must never read as in sync (fail closed)');
  assert.equal(result.reason, 'api-error');
  assert.notEqual(result.reason, 'diff', 'must be distinguishable from a confirmed real diff, not just also non-zero');
});
