import { useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { useFeatureFlag } from '../viewmodels/useFeatureFlag';
import { OfflineQueueService } from '../services/OfflineQueueService';
import { SubmissionService } from '../services/SubmissionService';
import { EligibilityService } from '../services/EligibilityService';
import { resyncQueuedSubmission } from '../services/offlineSubmissionSync';

export interface OfflineSyncResult {
  syncedCount: number;
  failedCount: number;
  tamperedCount: number;
}

/**
 * Fires `syncPendingSubmissions` on the offline -> online transition (and once on mount if
 * already online), gated behind `offline_resync_enabled` so it fails closed on an unreachable
 * flags doc. `hasSyncedRef` resets whenever the connection drops, so each reconnect gets its own
 * sync attempt, and re-arms once `userId` becomes available -- auth often resolves just after
 * mount, after the initial "already online" check would otherwise have run with no user yet.
 */
export function useOfflineQueueSync(
  userId?: string,
  offlineQueueService: OfflineQueueService = new OfflineQueueService(),
  submissionService: SubmissionService = new SubmissionService(),
  eligibilityService: EligibilityService = new EligibilityService()
): OfflineSyncResult | null {
  const isOnline = useOnlineStatus();
  const resyncEnabled = useFeatureFlag('offline_resync_enabled');
  const [lastResult, setLastResult] = useState<OfflineSyncResult | null>(null);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      hasSyncedRef.current = false;
      return;
    }
    if (hasSyncedRef.current || !resyncEnabled || !userId) return;

    hasSyncedRef.current = true;
    let cancelled = false;

    offlineQueueService
      .syncPendingSubmissions((item) => resyncQueuedSubmission(item, submissionService, eligibilityService))
      .then((result) => {
        if (cancelled) return;
        setLastResult({
          syncedCount: result.syncedCount,
          failedCount: result.failedCount,
          tamperedCount: result.tamperedCount
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline, resyncEnabled, userId, offlineQueueService, submissionService, eligibilityService]);

  return lastResult;
}
