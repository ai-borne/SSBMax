import { describe, it, expect, vi } from 'vitest';
import { ContentRepository } from '../../src/repositories/ContentRepository';
import { getDocs, getDoc } from 'firebase/firestore';

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
    vi.mocked(getDocs).mockResolvedValueOnce({
      forEach: vi.fn()
    } as any);

    const materials = await repository.getStudyMaterials();
    expect(materials).toBeDefined();
    expect(materials.length).toBeGreaterThanOrEqual(16);
    expect(materials[0]).toHaveProperty('title');
    expect(materials[0]).toHaveProperty('category');
  });

  it('should parse testTypeId and dayNumber from Firestore snapshots with topicType fallback', async () => {
    const mockDocSnapshots = [
      {
        id: 'doc_1',
        data: () => ({
          title: 'Firestore TAT Guide',
          topicType: 'tat',
          dayNumber: '2',
          summary: 'TAT summary text'
        })
      },
      {
        id: 'doc_2',
        data: () => ({
          title: 'Firestore PPDT Guide',
          category: 'PPDT Stage 1',
          dayNumber: 1,
          summary: 'PPDT summary text'
        })
      }
    ];

    vi.mocked(getDocs).mockResolvedValueOnce({
      forEach: (callback: (doc: any) => void) => mockDocSnapshots.forEach(callback)
    } as any);

    const materials = await repository.getStudyMaterials();
    expect(materials).toHaveLength(2);
    expect(materials[0].testTypeId).toBe('tat');
    expect(materials[0].dayNumber).toBe('2');
    expect(materials[1].testTypeId).toBe('ppdt');
    expect(materials[1].dayNumber).toBe('1');
  });

  it('should return study material by id from fallback when not found', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null
    } as any);

    const material = await repository.getStudyMaterialById('ssb-overview-01');
    expect(material).not.toBeNull();
    expect(material?.id).toBe('ssb-overview-01');
  });

  it('should return study material by id from Firestore snapshot when found', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'doc_wat',
      data: () => ({
        title: 'Firestore WAT Guide',
        testTypeId: 'wat',
        dayNumber: '2',
        summary: 'WAT guide summary'
      })
    } as any);

    const material = await repository.getStudyMaterialById('doc_wat');
    expect(material).not.toBeNull();
    expect(material?.id).toBe('doc_wat');
    expect(material?.testTypeId).toBe('wat');
    expect(material?.dayNumber).toBe('2');
  });

  it('should return null for non-existent material id', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null
    } as any);

    const material = await repository.getStudyMaterialById('invalid_id_999');
    expect(material).toBeNull();
  });

  it('should return capped batch of maximum 50 OIR items', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null
    } as any);

    const batch = await repository.getCappedBatch('oirQuestions', 0, 50);
    expect(batch.items.length).toBeLessThanOrEqual(50);
    expect(batch.batchIndex).toBe(0);
  });
});
