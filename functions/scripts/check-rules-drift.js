#!/usr/bin/env node
/**
 * Diffs the deployed Firestore ruleset against `firestore.rules` in this repo (Phase 8, Payment
 * Ecosystem Hardening plan, "deployed-rules drift detection").
 *
 * `firestore.rules` is the SSOT for data-access control, C1 (Phase 1) was a rules bug, and rules
 * deploy is manual (`firebase deploy --only firestore:rules`) -- it appears nowhere in CI. Two
 * failure modes follow, neither currently detectable without this: a rules change merges and is
 * never deployed (the repo says secure, production is not), or someone edits rules in the Firebase
 * console and the repo silently stops matching production. This is the same check that was run by
 * hand (two Firebase Rules API calls) to confirm C1's fix was actually live -- see the plan's
 * Verification section, item 1.
 *
 * Uses the Firebase Rules API (`firebaserules.googleapis.com`) via Application Default
 * Credentials, same auth convention as `set-ops-alerting.js`:
 *   1. `GET /v1/projects/{project}/releases/cloud.firestore` -- the active release, which points at
 *      whichever ruleset is actually serving traffic right now.
 *   2. `GET /v1/{rulesetName}` -- that ruleset's source, one file (`firestore.rules`).
 *
 * Exit code is the contract CI/a human reads: 0 only when the deployed source is byte-identical to
 * the repo's `firestore.rules`. Every other outcome -- a real diff, or an API/auth failure -- exits
 * non-zero. An API error must never read as "in sync" (root CLAUDE.md Rule 6, fail closed): silently
 * treating "I couldn't check" the same as "I checked and it's fine" is exactly how a real drift
 * would go unnoticed.
 */

const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const EXPECTED_PROJECT_ID = 'ssbmax-49e68';
const RULES_API = 'https://firebaserules.googleapis.com/v1';
const RELEASE_NAME = 'cloud.firestore';
const DEFAULT_RULES_PATH = path.join(__dirname, '..', '..', 'firestore.rules');

async function apiRequest(client, { method = 'GET', url }) {
  return client.request({ method, url, validateStatus: () => true });
}

/**
 * Fetches the ruleset source currently serving traffic. Throws (never returns a partial/undefined
 * result) on any API failure -- the caller's job is to translate that into "drift status: unknown",
 * never "in sync".
 */
async function fetchDeployedRulesSource(client, projectId) {
  const releaseUrl = `${RULES_API}/projects/${projectId}/releases/${RELEASE_NAME}`;
  const releaseRes = await apiRequest(client, { url: releaseUrl });
  const rulesetName = releaseRes.data?.rulesetName;
  if (!rulesetName) {
    throw new Error(`no active release found at ${releaseUrl} (release missing or no rulesetName)`);
  }

  const rulesetRes = await apiRequest(client, { url: `${RULES_API}/${rulesetName}` });
  const files = rulesetRes.data?.source?.files || [];
  const rulesFile = files.find((f) => f.name === 'firestore.rules') || files[0];
  if (!rulesFile || typeof rulesFile.content !== 'string') {
    throw new Error(`ruleset ${rulesetName} has no readable source content`);
  }

  return rulesFile.content;
}

/** Pure comparison, exact byte match -- no normalization. A whitespace-only difference between
 * repo and deployed is itself worth flagging: it means the deploy didn't run from a clean checkout
 * of what's in git right now. */
function compareRulesSource(deployedContent, localContent) {
  return deployedContent === localContent;
}

/**
 * The full check, fail-closed. Returns `{ inSync, reason, detail }` and never throws -- the CLI
 * wrapper (and tests) read `reason` to distinguish "confirmed different" from "couldn't tell",
 * which the plan requires be distinguishable, not just both "exit non-zero".
 */
async function runCheck(client, projectId, localRulesContent) {
  let deployedContent;
  try {
    deployedContent = await fetchDeployedRulesSource(client, projectId);
  } catch (apiError) {
    return { inSync: false, reason: 'api-error', detail: apiError.message || String(apiError) };
  }

  if (compareRulesSource(deployedContent, localRulesContent)) {
    return { inSync: true, reason: 'match' };
  }
  return { inSync: false, reason: 'diff', detail: 'deployed cloud.firestore ruleset differs from firestore.rules in this checkout' };
}

async function main() {
  const projectId = process.argv.find((a) => a.startsWith('--project='))?.slice('--project='.length) || EXPECTED_PROJECT_ID;
  const rulesPath = process.argv.find((a) => a.startsWith('--rules-path='))?.slice('--rules-path='.length) || DEFAULT_RULES_PATH;

  const localRulesContent = fs.readFileSync(rulesPath, 'utf8');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();

  const result = await runCheck(client, projectId, localRulesContent);

  if (result.inSync) {
    console.log(`check-rules-drift: OK -- deployed cloud.firestore ruleset matches ${rulesPath}.`);
    return;
  }

  console.error(`check-rules-drift: DRIFT DETECTED (${result.reason}) -- ${result.detail}`);
  process.exitCode = 1;
}

module.exports = {
  EXPECTED_PROJECT_ID,
  RULES_API,
  fetchDeployedRulesSource,
  compareRulesSource,
  runCheck
};

if (require.main === module) {
  main().catch((error) => {
    console.error('check-rules-drift.js failed:', error.message || error);
    process.exitCode = 1;
  });
}
