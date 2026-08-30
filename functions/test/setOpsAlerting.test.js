/**
 * Phase 8 (Payment Ecosystem Hardening plan, "One alert destination"): tests for
 * `scripts/set-ops-alerting.js`. Every network call goes through an injectable `{ request }`
 * client (mirroring `lib/razorpayClient.js`'s `fetchImpl` convention) so these run against a fake,
 * never a live GCP project.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { ALERT_KINDS } = require('../src/lib/opsAlert');
const {
  EXPECTED_PROJECT_ID,
  METRIC_TYPE,
  CHANNEL_DISPLAY_NAME,
  IMMEDIATE_POLICY_DISPLAY_NAME,
  ROLLUP_POLICY_DISPLAY_NAME,
  buildMetricPayload,
  ensureMetric,
  ensureNotificationChannel,
  ensureAlertPolicies,
  runVerify,
  assertProjectMatches,
  parseArgs
} = require('../scripts/set-ops-alerting');

/** Fake `google-auth-library` authorized-client stand-in. `getResponses` maps a URL prefix to the
 * `.data` a GET against it should return; every POST is recorded and, by default, echoes back
 * `data` plus a synthetic `name`. */
function makeFakeClient({ getResponses = {}, onPost } = {}) {
  const calls = [];
  return {
    calls,
    async request({ method, url, data }) {
      calls.push({ method, url, data });
      if (method === 'GET') {
        const key = Object.keys(getResponses).find((prefix) => url.startsWith(prefix));
        return { data: key ? getResponses[key] : {} };
      }
      if (method === 'POST') {
        if (onPost) return onPost(url, data);
        return { data: { name: `${url}/generated-id`, ...data } };
      }
      throw new Error(`unexpected method ${method}`);
    }
  };
}

test('the --dry-run metric payload filters on every alertKind value ALERT_KINDS exports', () => {
  const payload = buildMetricPayload();
  for (const kind of Object.values(ALERT_KINDS)) {
    assert.ok(
      payload.filter.includes(`kind=${kind} `),
      `metric filter must match kind=${kind} -- otherwise that alert kind fires into a filter matching nothing`
    );
  }
  // Also pins the SSOT direction: the filter must not reference a kind ALERT_KINDS doesn't export
  // (a copy-pasted stale kind would silently never match a still-referenced real alert either).
  const kindsInFilter = [...payload.filter.matchAll(/kind=([A-Z_]+) /g)].map((m) => m[1]);
  assert.deepEqual(new Set(kindsInFilter), new Set(Object.values(ALERT_KINDS)));
});

test('ensureMetric creates the metric when absent, and issues no create call when it already exists', async () => {
  const missing = makeFakeClient({ getResponses: {} });
  const created = await ensureMetric(missing, EXPECTED_PROJECT_ID);
  assert.equal(created.existed, false);
  assert.equal(missing.calls.filter((c) => c.method === 'POST').length, 1);

  const present = makeFakeClient({
    getResponses: {
      [`https://logging.googleapis.com/v2/projects/${EXPECTED_PROJECT_ID}/metrics/${METRIC_TYPE}`]: { name: `projects/${EXPECTED_PROJECT_ID}/metrics/${METRIC_TYPE}` }
    }
  });
  const result = await ensureMetric(present, EXPECTED_PROJECT_ID);
  assert.equal(result.existed, true);
  assert.equal(present.calls.filter((c) => c.method === 'POST').length, 0, 're-running against an existing metric must issue no create call');
});

test('ensureNotificationChannel issues no create call when a channel with the same displayName already exists', async () => {
  const client = makeFakeClient({
    getResponses: {
      'https://monitoring.googleapis.com/v3/projects/': {
        notificationChannels: [{ name: 'projects/x/notificationChannels/1', displayName: CHANNEL_DISPLAY_NAME, enabled: true }]
      }
    }
  });

  const result = await ensureNotificationChannel(client, EXPECTED_PROJECT_ID, 'ops@example.com');
  assert.equal(result.existed, true);
  assert.equal(client.calls.filter((c) => c.method === 'POST').length, 0, 'idempotency: no duplicate channel created');
});

test('ensureAlertPolicies issues no create call for a policy that already exists by displayName', async () => {
  const channelName = 'projects/x/notificationChannels/1';
  const client = makeFakeClient({
    getResponses: {
      'https://monitoring.googleapis.com/v3/projects/': {
        alertPolicies: [
          { name: 'projects/x/alertPolicies/1', displayName: IMMEDIATE_POLICY_DISPLAY_NAME, notificationChannels: [channelName] },
          { name: 'projects/x/alertPolicies/2', displayName: ROLLUP_POLICY_DISPLAY_NAME, notificationChannels: [channelName] }
        ]
      }
    }
  });

  const results = await ensureAlertPolicies(client, EXPECTED_PROJECT_ID, channelName);
  assert.equal(results.length, 2);
  assert.ok(results.every((r) => r.existed === true));
  assert.equal(client.calls.filter((c) => c.method === 'POST').length, 0, 'a redeploy must not accumulate duplicate policies');
});

test('runVerify fails when a policy exists but has zero enabled notification channels attached', async () => {
  // notificationChannels and alertPolicies share a URL prefix -- route by exact suffix instead of
  // makeFakeClient's prefix match.
  const client = { calls: [] };
  client.request = async ({ method, url }) => {
    client.calls.push({ method, url });
    if (url.endsWith('/notificationChannels')) {
      return { data: { notificationChannels: [{ name: 'projects/x/notificationChannels/1', displayName: CHANNEL_DISPLAY_NAME, enabled: true }] } };
    }
    if (url.endsWith('/alertPolicies')) {
      return {
        data: {
          alertPolicies: [
            { name: 'p1', displayName: IMMEDIATE_POLICY_DISPLAY_NAME, notificationChannels: [] }, // no channel attached
            { name: 'p2', displayName: ROLLUP_POLICY_DISPLAY_NAME, notificationChannels: ['projects/x/notificationChannels/1'] }
          ]
        }
      };
    }
    return { data: { name: `projects/${EXPECTED_PROJECT_ID}/metrics/${METRIC_TYPE}` } };
  };

  const result = await runVerify(client, EXPECTED_PROJECT_ID);
  assert.equal(result.ok, false);
  assert.ok(
    result.reasons.some((r) => r.includes(IMMEDIATE_POLICY_DISPLAY_NAME) && r.includes('zero enabled notification channels')),
    `expected a reason naming the unattached immediate policy, got: ${JSON.stringify(result.reasons)}`
  );
});

test('runVerify passes when the metric, channel, and both policies (each with an enabled channel) all exist', async () => {
  const client = { calls: [] };
  client.request = async ({ method, url }) => {
    client.calls.push({ method, url });
    if (url.includes('/metrics/')) return { data: { name: `projects/${EXPECTED_PROJECT_ID}/metrics/${METRIC_TYPE}` } };
    if (url.endsWith('/notificationChannels')) {
      return { data: { notificationChannels: [{ name: 'projects/x/notificationChannels/1', displayName: CHANNEL_DISPLAY_NAME, enabled: true }] } };
    }
    if (url.endsWith('/alertPolicies')) {
      return {
        data: {
          alertPolicies: [
            { name: 'p1', displayName: IMMEDIATE_POLICY_DISPLAY_NAME, notificationChannels: ['projects/x/notificationChannels/1'] },
            { name: 'p2', displayName: ROLLUP_POLICY_DISPLAY_NAME, notificationChannels: ['projects/x/notificationChannels/1'] }
          ]
        }
      };
    }
    throw new Error(`unexpected url ${url}`);
  };

  const result = await runVerify(client, EXPECTED_PROJECT_ID);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.ok, true);
});

test('the script refuses to run against a project id that does not match the deploy target', () => {
  assert.doesNotThrow(() => assertProjectMatches(EXPECTED_PROJECT_ID));
  assert.throws(() => assertProjectMatches('some-other-project'), /refusing to provision/);
});

test('parseArgs defaults --project to EXPECTED_PROJECT_ID and reads --email/--dry-run/--verify/--smoke', () => {
  assert.equal(parseArgs([]).project, EXPECTED_PROJECT_ID);
  assert.equal(parseArgs(['--project=other']).project, 'other');
  assert.equal(parseArgs(['--dry-run']).dryRun, true);
  assert.equal(parseArgs(['--verify']).verify, true);
  assert.equal(parseArgs(['--smoke']).smoke, true);
  assert.equal(parseArgs(['--email=ops@example.com']).email, 'ops@example.com');
});
