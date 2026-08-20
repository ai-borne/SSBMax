/**
 * Idempotent create-if-absent + `--verify` logic for `set-ops-alerting.js` (Phase 8, Payment
 * Ecosystem Hardening plan). Split out of that file purely to keep it under the 300-LOC cap.
 * Every network call goes through an injectable `client.request()` (mirroring
 * `lib/razorpayClient.js`'s `fetchImpl` convention), so this module is testable against a fake
 * client, never a live GCP project.
 */

const { ALERT_KINDS, SEVERITIES, emitOpsAlert } = require('../../src/lib/opsAlert');
const {
  METRIC_TYPE,
  CHANNEL_DISPLAY_NAME,
  IMMEDIATE_POLICY_DISPLAY_NAME,
  ROLLUP_POLICY_DISPLAY_NAME,
  LOGGING_API,
  MONITORING_API,
  buildMetricPayload,
  buildNotificationChannelPayload,
  buildAlertPolicyPayloads
} = require('./opsAlertingPayloads');

/** Thin wrapper over an authorized `google-auth-library` client's `.request()` -- kept as its own
 * function purely so tests can inject a fake `{ request }` instead of ever touching the network. */
async function apiRequest(client, { method, url, data }) {
  return client.request({ method, url, data, validateStatus: () => true });
}

async function findByDisplayName(client, listUrl, displayName, itemsKey) {
  const response = await apiRequest(client, { method: 'GET', url: listUrl });
  const items = response.data?.[itemsKey] || [];
  return items.find((item) => item.displayName === displayName) || null;
}

/**
 * Looks up the metric by name (metrics are keyed by `name`, not `displayName`) and creates it only
 * if absent. Returns `{ existed, metric }`.
 */
async function ensureMetric(client, projectId, { dryRun = false } = {}) {
  const payload = buildMetricPayload();
  const getUrl = `${LOGGING_API}/projects/${projectId}/metrics/${encodeURIComponent(payload.name)}`;

  if (dryRun) {
    return { existed: null, metric: null, payload, dryRun: true };
  }

  const existing = await apiRequest(client, { method: 'GET', url: getUrl });
  if (existing.data && existing.data.name) {
    return { existed: true, metric: existing.data, payload };
  }

  const created = await apiRequest(client, {
    method: 'POST',
    url: `${LOGGING_API}/projects/${projectId}/metrics`,
    data: payload
  });
  return { existed: false, metric: created.data, payload };
}

async function ensureNotificationChannel(client, projectId, email, { dryRun = false } = {}) {
  const payload = buildNotificationChannelPayload(email);
  const listUrl = `${MONITORING_API}/projects/${projectId}/notificationChannels`;

  if (dryRun) {
    return { existed: null, channel: null, payload, dryRun: true };
  }

  const existing = await findByDisplayName(client, listUrl, payload.displayName, 'notificationChannels');
  if (existing) {
    return { existed: true, channel: existing, payload };
  }

  const created = await apiRequest(client, { method: 'POST', url: listUrl, data: payload });
  return { existed: false, channel: created.data, payload };
}

async function ensureAlertPolicies(client, projectId, channelName, { dryRun = false } = {}) {
  const payloads = buildAlertPolicyPayloads(channelName);
  const listUrl = `${MONITORING_API}/projects/${projectId}/alertPolicies`;

  if (dryRun) {
    return payloads.map((payload) => ({ existed: null, policy: null, payload, dryRun: true }));
  }

  const results = [];
  for (const payload of payloads) {
    const existing = await findByDisplayName(client, listUrl, payload.displayName, 'alertPolicies');
    if (existing) {
      results.push({ existed: true, policy: existing, payload });
      continue;
    }
    const created = await apiRequest(client, { method: 'POST', url: listUrl, data: payload });
    results.push({ existed: false, policy: created.data, payload });
  }
  return results;
}

/** `--verify`: all three objects must exist, and every alert policy must reference at least one
 * enabled notification channel. Returns `{ ok, reasons }` -- never throws, so the CLI wrapper (and
 * a test) can inspect exactly what's missing rather than parsing a stack trace. */
async function runVerify(client, projectId) {
  const reasons = [];

  const metricRes = await apiRequest(client, {
    method: 'GET',
    url: `${LOGGING_API}/projects/${projectId}/metrics/${encodeURIComponent(METRIC_TYPE)}`
  });
  if (!metricRes.data || !metricRes.data.name) {
    reasons.push(`log-based metric "${METRIC_TYPE}" does not exist`);
  }

  const channelsRes = await apiRequest(client, {
    method: 'GET',
    url: `${MONITORING_API}/projects/${projectId}/notificationChannels`
  });
  const channels = channelsRes.data?.notificationChannels || [];
  const channel = channels.find((c) => c.displayName === CHANNEL_DISPLAY_NAME);
  if (!channel) {
    reasons.push(`notification channel "${CHANNEL_DISPLAY_NAME}" does not exist`);
  } else if (channel.enabled === false) {
    reasons.push(`notification channel "${CHANNEL_DISPLAY_NAME}" exists but is disabled`);
  }

  const policiesRes = await apiRequest(client, {
    method: 'GET',
    url: `${MONITORING_API}/projects/${projectId}/alertPolicies`
  });
  const policies = policiesRes.data?.alertPolicies || [];
  for (const displayName of [IMMEDIATE_POLICY_DISPLAY_NAME, ROLLUP_POLICY_DISPLAY_NAME]) {
    const policy = policies.find((p) => p.displayName === displayName);
    if (!policy) {
      reasons.push(`alert policy "${displayName}" does not exist`);
      continue;
    }
    const enabledChannels = (policy.notificationChannels || []).filter((chName) => {
      const referenced = channels.find((c) => c.name === chName);
      return referenced && referenced.enabled !== false;
    });
    if (enabledChannels.length === 0) {
      reasons.push(`alert policy "${displayName}" has zero enabled notification channels attached`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

async function runSmoke(firestoreDb) {
  await emitOpsAlert(firestoreDb, {
    kind: ALERT_KINDS.SYNTHETIC_PROBE,
    severity: SEVERITIES.CRITICAL,
    detail: { triggeredBy: 'set-ops-alerting.js --smoke', at: new Date().toISOString() }
  });
}

module.exports = {
  apiRequest,
  findByDisplayName,
  ensureMetric,
  ensureNotificationChannel,
  ensureAlertPolicies,
  runVerify,
  runSmoke
};
