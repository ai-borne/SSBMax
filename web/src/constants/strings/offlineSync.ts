/**
 * Copy for the reconnect-triggered offline submission resync status
 * (Offline Queue Resync plan, Phase 4). Shown transiently near the header's
 * online status badge once `useOfflineQueueSync` finishes a sync pass.
 */
export const offlineSyncStrings = {
  synced: (count: number) => `${count} offline submission${count === 1 ? '' : 's'} synced`,
  failed: (count: number) => `${count} failed, will retry`,
  tampered: (count: number) => `${count} rejected (data changed while offline)`
} as const;
