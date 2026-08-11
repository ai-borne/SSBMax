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

  it('should return an empty list (not fictional fallback batches) when a module has no batches in Firestore', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: true,
      forEach: vi.fn()
    } as any);

    const batches = await repository.getAvailableBatches('wat');
    expect(batches).toEqual([]);
  });

  it('should return an empty list for an unmapped module rather than guessing a path', async () => {
    const batches = await repository.getAvailableBatches('unknown_module');
    expect(batches).toEqual([]);
  });

  it('should return WAT batch and map polymorphic words payload', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'wat_batch_1',
      data: () => ({
        words: ['COURAGE', 'HONESTY'],
        displayDurationSeconds: 15
      })
    } as any);

    const wat = await repository.getWATBatch('wat_batch_1');
    expect(wat.id).toBe('wat_batch_1');
    expect(wat.words).toEqual(['COURAGE', 'HONESTY']);
  });

  it('should return GPE batch and strip the solution answer-key field', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'batch_001',
      data: () => ({
        images: [
          { id: 'gpe_1', imageUrl: 'gs://bucket/gpe/scenario_1.png', scenario: 'A flooded village.', solution: 'Build a bridge.', resources: ['rope'] }
        ]
      })
    } as any);

    const gpe = await repository.getGPEBatch('batch_001');
    expect(gpe.items).toHaveLength(1);
    expect(gpe.items[0].scenario).toBe('A flooded village.');
    expect((gpe.items[0] as any).solution).toBeUndefined();
  });

  it('should throw ContentUnavailableError when the GPE batch is missing', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null
    } as any);

    await expect(repository.getGPEBatch('missing_batch')).rejects.toThrow();
  });

  it('should return OIR content version from the meta/config doc', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ batchCount: 28, contentVersion: 2 })
    } as any);

    const meta = await repository.getOIRContentVersion();
    expect(meta.batchCount).toBe(28);
    expect(meta.contentVersion).toBe(2);
  });

  it('should throw ContentUnavailableError when the OIR meta/config doc is missing', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null
    } as any);

    await expect(repository.getOIRContentVersion()).rejects.toThrow();
  });
});

