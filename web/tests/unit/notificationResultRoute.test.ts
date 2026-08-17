import { describe, it, expect } from 'vitest';
import { resolveNotificationResultTarget } from '../../src/utils/notificationResultRoute';
import type { SSBMaxNotification } from '../../src/types/notification';

function notification(testType?: string, submissionId?: string): SSBMaxNotification {
  return {
    id: 'n1',
    userId: 'u1',
    type: 'GRADING_COMPLETE',
    priority: 'NORMAL',
    title: 'Your result is ready',
    message: 'graded',
    actionUrl: 'notifications/center',
    actionData: { ...(submissionId ? { submissionId } : {}), ...(testType ? { testType } : {}) },
    isRead: false,
    createdAt: 0
  };
}

// Regression: reported live (2026-08-17) -- clicking an OIR "your result is ready" notification
// on web did nothing, because OIR was entirely absent from the testType -> target mapping (only
// OLQ-scored types were covered). OIR needed its own `kind` since its result shape isn't OLQ-based.
describe('resolveNotificationResultTarget', () => {
  it('resolves OIR to its own kind, not an OLQ result collection', () => {
    expect(resolveNotificationResultTarget(notification('OIR', 'sub1'))).toEqual({ kind: 'oir', submissionId: 'sub1' });
  });

  it('resolves an OLQ-scored type to its result collection', () => {
    const target = resolveNotificationResultTarget(notification('WAT', 'sub1'));
    expect(target).toMatchObject({ kind: 'olq', submissionId: 'sub1' });
  });

  it('returns null for an unported GTO sub-type', () => {
    expect(resolveNotificationResultTarget(notification('GTO_PGT', 'sub1'))).toBeNull();
  });

  it('returns null when actionData is missing submissionId or testType', () => {
    expect(resolveNotificationResultTarget(notification('WAT'))).toBeNull();
    expect(resolveNotificationResultTarget(notification(undefined, 'sub1'))).toBeNull();
  });
});
