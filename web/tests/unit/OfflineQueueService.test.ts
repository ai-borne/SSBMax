import { describe, it, expect, vi } from 'vitest';
import { OfflineQueueService } from '../../src/services/OfflineQueueService';

vi.mock('../../src/config/firebase', () => ({
  auth: {
    currentUser: { uid: 'test_user_123', email: 'test@ssbmax.in' }
  }
}));

describe('OfflineQueueService Unit Tests', () => {
  const queueService = new OfflineQueueService();

  it('should compute valid SHA-256 checksum for offline payload', async () => {
    const data = {
      testType: 'OIR',
      userId: 'user_123',
      payload: { answers: [1, 2, 3] },
      timestamp: 1700000000000
    };

    const checksum1 = await OfflineQueueService.computeChecksum(data);
    const checksum2 = await OfflineQueueService.computeChecksum(data);

    expect(checksum1).toBeDefined();
    expect(checksum1).toBe(checksum2);
  });

  it('should enqueue submission with checksum and verify non-tampered status', async () => {
    const id = await queueService.enqueueSubmission({
      testType: 'OIR',
      userId: 'test_user_123',
      payload: { answers: [1, 2, 3] }
    });

    expect(id).toBeDefined();
    const queued = await queueService.getQueuedSubmissions();
    const item = queued.find((i) => i.id === id);

    expect(item).toBeDefined();
    expect(item?.checksum).toBeDefined();
    expect(item?.isTampered).toBe(false);
  });

  it('should detect tampered payload when checksum mismatch occurs', async () => {
    const id = await queueService.enqueueSubmission({
      testType: 'TAT',
      userId: 'test_user_123',
      payload: { stories: ['original story'] }
    });

    const queued = await queueService.getQueuedSubmissions();
    const item = queued.find((i) => i.id === id);

    if (item) {
      // Simulate local tamper in payload
      item.payload.stories = ['HACKED TAMPERED STORY'];
      item.checksum = 'invalid_tampered_checksum';
    }

    const handler = vi.fn().mockResolvedValue(true);
    const result = await queueService.syncPendingSubmissions(handler);

    expect(result.authRequired).toBe(false);
    expect(result.tamperedCount).toBeGreaterThan(0);
  });

  it('should remove submission after successful sync', async () => {
    const id = await queueService.enqueueSubmission({
      testType: 'WAT',
      userId: 'test_user_123',
      payload: { words: ['bravery'] }
    });

    await queueService.removeSubmission(id);
    const queued = await queueService.getQueuedSubmissions();
    expect(queued.some((item) => item.id === id)).toBe(false);
  });
});
