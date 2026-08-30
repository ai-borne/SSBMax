import { FC, useEffect, useState } from 'react';
import { strings } from '../../constants/strings';
import type { OfflineSyncResult } from '../../hooks/useOfflineQueueSync';

const AUTO_DISMISS_MS = 6000;

export interface OfflineSyncStatusProps {
  result: OfflineSyncResult | null;
}

/**
 * Transient, auto-dismissing summary of the last offline-queue resync -- rendered near the
 * header's `online-status-badge`. Renders nothing when there's no recent result to show.
 */
export const OfflineSyncStatus: FC<OfflineSyncStatusProps> = ({ result }) => {
  // Tracks which `result` reference has already auto-dismissed, rather than a plain visible
  // boolean, so showing a new result needs no synchronous setState in the effect body -- the
  // dismiss timer is the only state write, and it fires from the timeout callback, not inline.
  const [dismissedResult, setDismissedResult] = useState<OfflineSyncResult | null>(null);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setDismissedResult(result), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const visible = result !== null && result !== dismissedResult;
  if (!result || !visible) return null;
  if (result.syncedCount === 0 && result.failedCount === 0 && result.tamperedCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-sync-status"
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
    >
      {result.syncedCount > 0 && <span data-testid="offline-sync-status-synced">{strings.offlineSync.synced(result.syncedCount)}</span>}
      {result.failedCount > 0 && <span data-testid="offline-sync-status-failed">{strings.offlineSync.failed(result.failedCount)}</span>}
      {result.tamperedCount > 0 && <span data-testid="offline-sync-status-tampered">{strings.offlineSync.tampered(result.tamperedCount)}</span>}
    </div>
  );
};

export default OfflineSyncStatus;
