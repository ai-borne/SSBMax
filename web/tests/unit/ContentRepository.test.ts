import { describe, it, expect, vi } from 'vitest';
import { ContentRepository } from '../../src/repositories/ContentRepository';

// Mock Firebase firestore methods
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => false,
    data: () => null
  }),
  getDocs: vi.fn().mockResolvedValue({
    forEach: vi.fn()
  }),
  query: vi.fn(),
  limit: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  db: {}
}));

describe('ContentRepository Unit Tests', () => {
  const repository = new ContentRepository();

  it('should return fallback study materials when firestore is empty or offline', async () => {
    const materials = await repository.getStudyMaterials();
    expect(materials).toBeDefined();
    expect(materials.length).toBeGreaterThan(0);
    expect(materials[0]).toHaveProperty('title');
    expect(materials[0]).toHaveProperty('category');
  });

  it('should return study material by id from fallback when not found', async () => {
    const material = await repository.getStudyMaterialById('ssb-overview-01');
    expect(material).not.toBeNull();
    expect(material?.id).toBe('ssb-overview-01');
  });

  it('should return null for non-existent material id', async () => {
    const material = await repository.getStudyMaterialById('invalid_id_999');
    expect(material).toBeNull();
  });

  it('should return capped batch of maximum 50 OIR items', async () => {
    const batch = await repository.getCappedBatch('oirQuestions', 0, 50);
    expect(batch.items.length).toBeLessThanOrEqual(50);
    expect(batch.batchIndex).toBe(0);
  });
});
