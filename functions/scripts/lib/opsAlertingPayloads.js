/**
 * Pure Cloud Monitoring/Logging API payload builders for `set-ops-alerting.js` (Phase 8, Payment
 * Ecosystem Hardening plan). Split out of that file purely to keep it under the 300-LOC cap --
 * no network calls happen here, which is also what makes `--dry-run` and the unit tests trivial:
 * every function in this file is called the exact same way whether or not a real API is involved.
 */

const { ALERT_KINDS, SEVERITIES } = require('../../src/lib/opsAlert');

const METRIC_TYPE = 'ssbmax_ops_alert';
const CHANNEL_DISPLAY_NAME = 'SSBMax Ops Alerts (email)';
const IMMEDIATE_POLICY_DISPLAY_NAME = 'SSBMax Ops Alert -- Immediate (CRITICAL/HIGH)';
const ROLLUP_POLICY_DISPLAY_NAME = 'SSBMax Ops Alert -- Rollup (INFO)';

const LOGGING_API = 'https://logging.googleapis.com/v2';
const MONITORING_API = 'https://monitoring.googleapis.com/v3';

/**
 * One `textPayload:"..."` substring clause per known kind, OR'd together -- deliberately the `:`
 * ("has") operator, not `=~` regex, so this never has to reason about Cloud Logging's filter-string
 * escaping rules for the literal `[`/`]` around `ops_alert`. The trailing space after each kind is
 * load-bearing: it's what stops `kind=DRIFT_REPAIR` from also matching a `DRIFT_REPAIR_REJECTED`
 * log line as a substring.
 *
 * Sourced from `ALERT_KINDS` (SSOT) every call -- never a second hand-typed list. This is exactly
 * the drift the plan calls out by name: if a new `ALERT_KINDS` entry is added but this script isn't
 * re-run, alerts of that kind fire into a filter that matches nothing, silently.
 */
function alertKindPattern() {
  return Object.values(ALERT_KINDS)
    .map((kind) => `textPayload:"kind=${kind} "`)
    .join(' OR ');
}

function buildMetricPayload() {
  return {
    name: METRIC_TYPE,
    description: 'Count of functions/src/lib/opsAlert.js [ops_alert] log lines, by kind/severity.',
    // gen2 functions run as Cloud Run revisions, not `cloud_function` (verified live 2026-08-28:
    // `[ops_alert]` log entries carry `resource.type="cloud_run_revision"`, `logName` ending
    // `run.googleapis.com%2Fstderr`). Also verified live that a plain-text (non-JSON) stderr line
    // from these functions does NOT carry Cloud Logging severity ERROR -- `console.error` alone
    // isn't enough for that promotion here -- so `severity>=ERROR` excluded every real
    // `[ops_alert]` line ever emitted since this filter was written (Phase 8, 2026-08-20). Dropped
    // rather than "fixed" to some other severity value: `textPayload:"[ops_alert]"` plus the
    // kind-pattern clause already scope this precisely, so no severity gate is needed at all.
    filter: `resource.type="cloud_run_revision" AND textPayload:"[ops_alert]" AND (${alertKindPattern()})`,
    metricDescriptor: {
      metricKind: 'DELTA',
      valueType: 'INT64',
      labels: [
        { key: 'alertKind', valueType: 'STRING', description: 'ALERT_KINDS value' },
        { key: 'severity', valueType: 'STRING', description: 'INFO | HIGH | CRITICAL' }
      ]
    },
    labelExtractors: {
      alertKind: 'REGEXP_EXTRACT(textPayload, "kind=([A-Z_]+)")',
      severity: 'REGEXP_EXTRACT(textPayload, "severity=([A-Z]+)")'
    }
  };
}

function buildNotificationChannelPayload(email) {
  return {
    type: 'email',
    displayName: CHANNEL_DISPLAY_NAME,
    labels: { email_address: email },
    enabled: true
  };
}

/** One alert-policy condition over the log-based metric, optionally scoped to a severity set. */
function metricFilter(severities) {
  // Must match the resource type the metric's own time series are actually recorded under --
  // see buildMetricPayload's comment (verified live 2026-08-28: `cloud_run_revision`, not
  // `cloud_function`, for gen2 functions).
  const base = `resource.type="cloud_run_revision" AND metric.type="logging.googleapis.com/user/${METRIC_TYPE}"`;
  if (!severities) return base;
  const values = severities.map((s) => `metric.label.severity="${s}"`).join(' OR ');
  return `${base} AND (${values})`;
}

/**
 * Two alert policies over the same metric, both attached to `channelName`: one firing immediately
 * for CRITICAL/HIGH severity, one rolling up for INFO -- the documented severity split the phase
 * calls for. Two policies, not one, because a single `conditionThreshold` policy has one filter
 * and one aggregation window; there is no per-severity fan-out within it.
 *
 * The severity split is encoded entirely in each condition's `aggregations[].alignmentPeriod`, NOT
 * `alertStrategy.notificationRateLimit` -- verified live against the real Monitoring API (Phase 8
 * rollout, 2026-08-20): `notificationRateLimit` on a `conditionThreshold` (metric-based) policy is
 * rejected with `INVALID_ARGUMENT: only log-based alert policies may specify a notification rate
 * limit`. A 60s-aligned immediate policy opens an incident within about a minute of the first
 * CRITICAL/HIGH log line; a 3600s-aligned rollup policy only evaluates its threshold once an hour,
 * batching same-hour INFO alerts into one incident-open notification rather than one per alert.
 * Cloud Monitoring's own incident lifecycle (notify on open, notify once more on auto-close) is
 * the rest of the "not a page" behavior for the rollup policy -- no further rate limiting needed.
 */
function buildAlertPolicyPayloads(channelName) {
  const immediate = {
    displayName: IMMEDIATE_POLICY_DISPLAY_NAME,
    combiner: 'OR',
    conditions: [
      {
        displayName: 'CRITICAL/HIGH ops alert observed',
        conditionThreshold: {
          filter: metricFilter(['CRITICAL', SEVERITIES.HIGH]),
          comparison: 'COMPARISON_GT',
          thresholdValue: 0,
          duration: '0s',
          aggregations: [{ alignmentPeriod: '60s', perSeriesAligner: 'ALIGN_COUNT' }]
        }
      }
    ],
    notificationChannels: [channelName]
  };

  const rollup = {
    displayName: ROLLUP_POLICY_DISPLAY_NAME,
    combiner: 'OR',
    conditions: [
      {
        displayName: 'INFO ops alert observed',
        conditionThreshold: {
          filter: metricFilter([SEVERITIES.INFO]),
          comparison: 'COMPARISON_GT',
          thresholdValue: 0,
          duration: '0s',
          aggregations: [{ alignmentPeriod: '3600s', perSeriesAligner: 'ALIGN_COUNT' }]
        }
      }
    ],
    notificationChannels: [channelName]
  };

  return [immediate, rollup];
}

module.exports = {
  METRIC_TYPE,
  CHANNEL_DISPLAY_NAME,
  IMMEDIATE_POLICY_DISPLAY_NAME,
  ROLLUP_POLICY_DISPLAY_NAME,
  LOGGING_API,
  MONITORING_API,
  alertKindPattern,
  buildMetricPayload,
  buildNotificationChannelPayload,
  buildAlertPolicyPayloads
};
