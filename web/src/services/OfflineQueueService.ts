import { auth } from '../config/firebase';

export interface QueuedSubmission {
  id: string;
  testType: 'OIR' | 'TAT' | 'WAT' | 'SRT' | 'SD' | 'PPDT';
  userId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  checksum?: string;
  isTampered?: boolean;
}

export class OfflineQueueService {
  private static DB_NAME = 'SSBMax_OfflineDB';
  private static STORE_NAME = 'pendingSubmissions';
  private static memoryFallback: QueuedSubmission[] = [];

  public static async computeChecksum(data: { testType: string; userId: string; payload: Record<string, unknown>; timestamp: number }): Promise<string> {
    const serialized = JSON.stringify({
      testType: data.testType,
      userId: data.userId,
      payload: data.payload,
      timestamp: data.timestamp
    });

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(serialized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Basic fallback hash for non-subtle crypto environments
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      hash = (hash << 5) - hash + serialized.charCodeAt(i);
      hash |= 0;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  private async openDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(OfflineQueueService.DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OfflineQueueService.STORE_NAME)) {
          db.createObjectStore(OfflineQueueService.STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async enqueueSubmission(submission: Omit<QueuedSubmission, 'id' | 'timestamp' | 'checksum'>): Promise<string> {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = Date.now();
    const checksum = await OfflineQueueService.computeChecksum({
      testType: submission.testType,
      userId: submission.userId,
      payload: submission.payload,
      timestamp
    });

    const fullSubmission: QueuedSubmission = {
      ...submission,
      id,
      timestamp,
      checksum
    };

    const db = await this.openDB();
    if (!db) {
      OfflineQueueService.memoryFallback.push(fullSubmission);
      return id;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(OfflineQueueService.STORE_NAME, 'readwrite');
      const store = tx.objectStore(OfflineQueueService.STORE_NAME);
      const req = store.add(fullSubmission);
      req.onsuccess = () => resolve(id);
      req.onerror = () => {
        OfflineQueueService.memoryFallback.push(fullSubmission);
        resolve(id);
      };
    });
  }

  async getQueuedSubmissions(): Promise<QueuedSubmission[]> {
    const db = await this.openDB();
    let rawItems: QueuedSubmission[];

    if (!db) {
      rawItems = [...OfflineQueueService.memoryFallback];
    } else {
      rawItems = await new Promise((resolve) => {
        const tx = db.transaction(OfflineQueueService.STORE_NAME, 'readonly');
        const store = tx.objectStore(OfflineQueueService.STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          resolve([...items, ...OfflineQueueService.memoryFallback]);
        };
        req.onerror = () => resolve([...OfflineQueueService.memoryFallback]);
      });
    }

    // Verify tamper checksums
    const verifiedItems: QueuedSubmission[] = [];
    for (const item of rawItems) {
      if (!item.checksum) {
        verifiedItems.push({ ...item, isTampered: true });
        continue;
      }

      const expectedChecksum = await OfflineQueueService.computeChecksum({
        testType: item.testType,
        userId: item.userId,
        payload: item.payload,
        timestamp: item.timestamp
      });

      if (expectedChecksum !== item.checksum) {
        verifiedItems.push({ ...item, isTampered: true });
      } else {
        verifiedItems.push({ ...item, isTampered: false });
      }
    }

    return verifiedItems;
  }

  async removeSubmission(id: string): Promise<void> {
    OfflineQueueService.memoryFallback = OfflineQueueService.memoryFallback.filter((s) => s.id !== id);

    const db = await this.openDB();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(OfflineQueueService.STORE_NAME, 'readwrite');
      const store = tx.objectStore(OfflineQueueService.STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  async syncPendingSubmissions(
    syncHandler: (submission: QueuedSubmission) => Promise<boolean>
  ): Promise<{ syncedCount: number; failedCount: number; tamperedCount: number; authRequired: boolean }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { syncedCount: 0, failedCount: 0, tamperedCount: 0, authRequired: true };
    }

    const pending = await this.getQueuedSubmissions();
    let syncedCount = 0;
    let failedCount = 0;
    let tamperedCount = 0;

    for (const item of pending) {
      if (item.isTampered) {
        console.error(`OfflineQueueService: Rejecting tampered payload for submission ${item.id}`);
        await this.removeSubmission(item.id);
        tamperedCount++;
        continue;
      }

      try {
        const success = await syncHandler(item);
        if (success) {
          await this.removeSubmission(item.id);
          syncedCount++;
        } else {
          failedCount++;
        }
      } catch {
        failedCount++;
      }
    }

    return { syncedCount, failedCount, tamperedCount, authRequired: false };
  }
}
