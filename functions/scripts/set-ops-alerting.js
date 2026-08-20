#!/usr/bin/env node
/**
 * Provisions the Cloud Monitoring delivery channel for `functions/src/lib/opsAlert.js`'s alert
 * log lines (Phase 8, Payment Ecosystem Hardening plan, "One alert destination").
 *
 * Mirrors `set-feature-flags.js`'s convention exactly: a plain Node script, run with Application
 * Default Credentials (`gcloud auth application-default login`), no new dependency shipped in the
 * functions runtime bundle -- `google-auth-library` is already present transitively (firebase-admin
 * depends on it), so requiring it here adds nothing to what a deployed function's `npm install
 * --production` pulls in, and this file is never `require`d by `index.js` regardless.
 *
 * The actual payload shapes (`scripts/lib/opsAlertingPayloads.js`) and the idempotent
 * create-if-absent/`--verify` logic (`scripts/lib/opsAlertingProvisioning.js`) live in their own
 * files -- this one is deliberately just the CLI: parse args, refuse a mismatched project, dispatch
 * to a mode, print a human-readable summary. See those two files' headers for what gets
 * provisioned and why (log-based metric, email channel, two severity-split alert policies).
 *
 * Modes:
 *   --dry-run   prints the exact API payloads and issues zero API calls (what the unit tests assert
 *               against).
 *   --verify    exits non-zero unless all three objects exist and both policies have at least one
 *               enabled notification channel attached -- a release-checklist command, and the thing
 *               that catches someone deleting the channel in the console six months from now.
 *   --smoke     emits one synthetic SYNTHETIC_PROBE alert through the real `emitOpsAlert` path so a
 *               human can confirm an email actually arrives, end to end.
 *   (no flag)   idempotently creates whatever of the three is missing.
 *
 * `--project=<id>` must match `EXPECTED_PROJECT_ID` (defaults to it if omitted) -- a mis-typed
 * `--project` silently provisioning alerting on the wrong GCP project is worse than provisioning
 * nothing, so this refuses rather than guessing.
 */

const { GoogleAuth } = require('google-auth-library');
const {
  METRIC_TYPE,
  CHANNEL_DISPLAY_NAME,
  IMMEDIATE_POLICY_DISPLAY_NAME,
  ROLLUP_POLICY_DISPLAY_NAME,
  alertKindPattern,
  buildMetricPayload,
  buildNotificationChannelPayload,
  buildAlertPolicyPayloads
} = require('./lib/opsAlertingPayloads');
const {
  ensureMetric,
  ensureNotificationChannel,
  ensureAlertPolicies,
  runVerify,
  runSmoke
} = require('./lib/opsAlertingProvisioning');

// Same project every other one-off script in this directory targets (see set-feature-flags.js).
const EXPECTED_PROJECT_ID = 'ssbmax-49e68';

function assertProjectMatches(projectId) {
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `refusing to provision ops alerting against project "${projectId}" -- expected "${EXPECTED_PROJECT_ID}". ` +
        'Pass --project explicitly only when you intend to target a different (e.g. staging) project.'
    );
  }
}

function parseArgs(argv) {
  const args = { dryRun: false, verify: false, smoke: false, project: EXPECTED_PROJECT_ID, email: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--verify') args.verify = true;
    else if (arg === '--smoke') args.smoke = true;
    else if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length);
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertProjectMatches(args.project);

  if (args.dryRun) {
    const metric = buildMetricPayload();
    const email = args.email || process.env.OPS_ALERT_EMAIL || '<OPS_ALERT_EMAIL not set>';
    const channel = buildNotificationChannelPayload(email);
    const policies = buildAlertPolicyPayloads('projects/PROJECT_ID/notificationChannels/CHANNEL_ID');
    console.log(JSON.stringify({ metric, channel, policies }, null, 2));
    return;
  }

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();

  if (args.verify) {
    const result = await runVerify(client, args.project);
    if (!result.ok) {
      console.error('ops alerting --verify FAILED:');
      for (const reason of result.reasons) console.error(`  - ${reason}`);
      process.exitCode = 1;
      return;
    }
    console.log('ops alerting --verify OK: metric, channel, and both alert policies are all provisioned.');
    return;
  }

  if (args.smoke) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: args.project });
    await runSmoke(admin.firestore());
    console.log('Emitted one SYNTHETIC_PROBE alert -- check the ops inbox and the ops_alerts collection.');
    return;
  }

  const email = args.email || process.env.OPS_ALERT_EMAIL;
  if (!email) {
    throw new Error('an email address is required to create the notification channel -- pass --email=<address> or set OPS_ALERT_EMAIL');
  }

  const metricResult = await ensureMetric(client, args.project);
  console.log(`metric "${METRIC_TYPE}": ${metricResult.existed ? 'already existed' : 'created'}`);

  const channelResult = await ensureNotificationChannel(client, args.project, email);
  console.log(`notification channel "${CHANNEL_DISPLAY_NAME}": ${channelResult.existed ? 'already existed' : 'created'}`);
  const channelName = channelResult.channel.name;

  const policyResults = await ensureAlertPolicies(client, args.project, channelName);
  for (const result of policyResults) {
    console.log(`alert policy "${result.payload.displayName}": ${result.existed ? 'already existed' : 'created'}`);
  }
}

// Re-exported for backward compatibility with existing test imports -- the implementations now
// live in scripts/lib/opsAlertingPayloads.js and scripts/lib/opsAlertingProvisioning.js (this
// file's 300-LOC split).
module.exports = {
  EXPECTED_PROJECT_ID,
  METRIC_TYPE,
  CHANNEL_DISPLAY_NAME,
  IMMEDIATE_POLICY_DISPLAY_NAME,
  ROLLUP_POLICY_DISPLAY_NAME,
  alertKindPattern,
  buildMetricPayload,
  buildNotificationChannelPayload,
  buildAlertPolicyPayloads,
  ensureMetric,
  ensureNotificationChannel,
  ensureAlertPolicies,
  runVerify,
  runSmoke,
  assertProjectMatches,
  parseArgs
};

if (require.main === module) {
  main().catch((error) => {
    console.error('set-ops-alerting.js failed:', error.message || error);
    process.exitCode = 1;
  });
}
