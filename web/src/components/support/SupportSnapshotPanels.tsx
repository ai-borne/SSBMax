import { FC } from 'react';
import { strings } from '../../constants/strings';
import type { SupportSnapshotRazorpay, SubscriptionSupportSnapshot, SupportSnapshotSource } from '../../repositories/SupportRepository';
import { formatSupportTimestamp, SUPPORT_TIMESTAMP_KEYS } from './supportFormatting';

/** Sibling component split out of `SupportSubscriptionPage.tsx` per the
 * `SubscriptionPlanCards.tsx`/`SubscriptionFAQ.tsx` precedent -- keeps the page itself under the
 * 300-LOC cap once the snapshot rendering grows past a single panel. */
export interface SupportSnapshotPanelsProps {
  snapshot: SubscriptionSupportSnapshot;
}

function isUnavailable(source: SupportSnapshotSource | null): source is { unavailable: true; reason?: string } {
  return source != null && (source as { unavailable?: boolean }).unavailable === true;
}

/** Phase 10, issue 1: a RAZORPAY-sourced doc with no `subscriptionId` is unverifiable against the
 * Razorpay API -- distinct from `data === null` (genuinely no Razorpay purchase), so it must not
 * fall through to `emptyMessage`. */
function isDataIncomplete(data: SupportSnapshotRazorpay): data is { dataIncomplete: true; reason: string } {
  return data != null && (data as { dataIncomplete?: boolean }).dataIncomplete === true;
}

const SourcePanel: FC<{ title: string; data: SupportSnapshotSource | SupportSnapshotRazorpay; emptyMessage: string }> = ({ title, data, emptyMessage }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 p-4" data-testid={`support-panel-${title}`}>
    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
    {isDataIncomplete(data) ? (
      <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="support-razorpay-incomplete">
        {strings.support.razorpayDataIncomplete}
      </p>
    ) : data === null ? (
      <p className="text-xs text-slate-500 dark:text-slate-400">{emptyMessage}</p>
    ) : isUnavailable(data) ? (
      <p className="text-xs text-amber-600 dark:text-amber-400">{strings.support.sourceUnavailable}</p>
    ) : (
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-slate-500 dark:text-slate-400">{key}</dt>
            <dd className="text-slate-900 dark:text-slate-100 break-all">
              {key === 'sourceKind' ? (
                <SourceKindLabel value={String(value)} />
              ) : SUPPORT_TIMESTAMP_KEYS.has(key) ? (
                formatSupportTimestamp(value)
              ) : (
                String(value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    )}
  </div>
);

/** Phase 10, issue 4: `LEGACY_OR_UNKNOWN` (an unrecognized or missing `source`) gets its own
 * distinct label rather than falling through to the generic key/value dump indistinguishable from
 * a clean `NONE` state. */
const SourceKindLabel: FC<{ value: string }> = ({ value }) =>
  value === 'LEGACY_OR_UNKNOWN' ? (
    <span className="text-amber-600 dark:text-amber-400" data-testid="support-sourcekind-legacy">
      {strings.support.legacyOrUnknownSource}
    </span>
  ) : (
    <>{value}</>
  );

const ConflictBanner: FC<{ conflict: SubscriptionSupportSnapshot['conflict'] }> = ({ conflict }) =>
  conflict?.detected ? (
    <div
      className="rounded-xl border border-red-300 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20 p-4 sm:col-span-2 text-xs text-red-700 dark:text-red-300"
      data-testid="support-conflict-banner"
    >
      {strings.support.conflictDetected}
    </div>
  ) : null;

export const SupportSnapshotPanels: FC<SupportSnapshotPanelsProps> = ({ snapshot }) => (
  <div className="grid gap-4 sm:grid-cols-2" data-testid="support-snapshot">
    <ConflictBanner conflict={snapshot.conflict} />
    <SourcePanel title={strings.support.firestorePanel} data={snapshot.firestore} emptyMessage="" />
    <SourcePanel title={strings.support.razorpayPanel} data={snapshot.razorpay} emptyMessage={strings.support.noRazorpaySubscription} />
    <SourcePanel title={strings.support.revenueCatPanel} data={snapshot.revenueCat} emptyMessage="" />

    <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 p-4 sm:col-span-2" data-testid="support-panel-alerts">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{strings.support.alertsPanel}</h3>
      {!('items' in snapshot.alerts) ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">{strings.support.sourceUnavailable}</p>
      ) : snapshot.alerts.items.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{strings.support.noAlerts}</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {snapshot.alerts.items.map((alert) => (
              <li key={alert.id} className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap gap-x-2">
                <span className="font-mono text-slate-400 dark:text-slate-500">{formatSupportTimestamp(alert.createdAt)}</span>
                <span className="font-semibold">{alert.kind}</span>
                <span className="text-slate-500 dark:text-slate-400">{alert.severity}</span>
              </li>
            ))}
          </ul>
          {snapshot.alerts.hasMore && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2" data-testid="support-alerts-has-more">
              {strings.support.moreAlertsExist}
            </p>
          )}
        </>
      )}
    </div>
  </div>
);
