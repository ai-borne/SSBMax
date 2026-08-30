import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineSyncStatus } from '../../../src/components/layout/OfflineSyncStatus';

describe('OfflineSyncStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there is no recent sync result', () => {
    render(<OfflineSyncStatus result={null} />);
    expect(screen.queryByTestId('offline-sync-status')).not.toBeInTheDocument();
  });

  it('renders nothing when the result has no synced, failed, or tampered items', () => {
    render(<OfflineSyncStatus result={{ syncedCount: 0, failedCount: 0, tamperedCount: 0 }} />);
    expect(screen.queryByTestId('offline-sync-status')).not.toBeInTheDocument();
  });

  it('shows a synced-count message when submissions synced successfully', () => {
    render(<OfflineSyncStatus result={{ syncedCount: 2, failedCount: 0, tamperedCount: 0 }} />);
    expect(screen.getByTestId('offline-sync-status')).toBeInTheDocument();
    expect(screen.getByTestId('offline-sync-status-synced')).toHaveTextContent('2 offline submissions synced');
  });

  it('uses singular phrasing for exactly one synced submission', () => {
    render(<OfflineSyncStatus result={{ syncedCount: 1, failedCount: 0, tamperedCount: 0 }} />);
    expect(screen.getByTestId('offline-sync-status-synced')).toHaveTextContent('1 offline submission synced');
  });

  it('shows a failed-count message alongside a synced-count message when both are non-zero', () => {
    render(<OfflineSyncStatus result={{ syncedCount: 1, failedCount: 1, tamperedCount: 0 }} />);
    expect(screen.getByTestId('offline-sync-status-synced')).toBeInTheDocument();
    expect(screen.getByTestId('offline-sync-status-failed')).toHaveTextContent('1 failed, will retry');
  });

  it('shows a tampered-count message when a queued payload failed the checksum check', () => {
    render(<OfflineSyncStatus result={{ syncedCount: 0, failedCount: 0, tamperedCount: 1 }} />);
    expect(screen.getByTestId('offline-sync-status-tampered')).toHaveTextContent('1 rejected (data changed while offline)');
  });

  it('auto-dismisses after the timeout so it does not linger indefinitely', () => {
    render(<OfflineSyncStatus result={{ syncedCount: 2, failedCount: 0, tamperedCount: 0 }} />);
    expect(screen.getByTestId('offline-sync-status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.queryByTestId('offline-sync-status')).not.toBeInTheDocument();
  });
});
