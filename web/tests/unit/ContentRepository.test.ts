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
    forEach: vi.fn(),
    docs: []
  }),
  query: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn()
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

  it('should derive testTypeId from an explicit topicType field for unambiguous topics, and dayNumber from Firestore snapshots', async () => {
    const mockDocSnapshots = [
      {
        id: 'doc_1',
        data: () => ({
          title: 'Firestore PPDT Guide',
          topicType: 'PPDT',
          dayNumber: '1',
          summary: 'PPDT summary text'
        })
      },
      {
        id: 'doc_2',
        data: () => ({
          title: 'Firestore OIR Guide',
          topicType: 'OIR',
          dayNumber: 1,
          summary: 'OIR summary text'
        })
      }
    ];

    vi.mocked(getDocs).mockResolvedValueOnce({
      forEach: (callback: (doc: any) => void) => mockDocSnapshots.forEach(callback)
    } as any);

    const materials = await repository.getStudyMaterials();
    expect(materials).toHaveLength(2);
    expect(materials[0].testTypeId).toBe('ppdt');
    expect(materials[0].dayNumber).toBe('1');
    expect(materials[1].testTypeId).toBe('oir');
    expect(materials[1].dayNumber).toBe('1');
  });

  it('does not guess a testTypeId for a topicType covering several test types (Phase 7, no fuzzy fallback)', async () => {
    const mockDocSnapshots = [
      { id: 'gto_1', data: () => ({ title: 'GTO Guide', topicType: 'GTO', category: 'GTO Preparation' }) },
      { id: 'psy_1', data: () => ({ title: 'Psychology Guide', topicType: 'PSYCHOLOGY', category: 'Psychology Tests' }) }
    ];
    vi.mocked(getDocs).mockResolvedValueOnce({
      forEach: (callback: (doc: any) => void) => mockDocSnapshots.forEach(callback)
    } as any);

    const materials = await repository.getStudyMaterials();
    expect(materials[0].testTypeId).toBeUndefined();
    expect(materials[0].topicType).toBe('GTO');
    expect(materials[1].testTypeId).toBeUndefined();
    expect(materials[1].topicType).toBe('PSYCHOLOGY');
  });

  it('does not mis-map MEDICALS onto the conference testTypeId (Phase 7 regression, MEDIUM 4c)', async () => {
    const mockDocSnapshots = [
      { id: 'med_1', data: () => ({ title: 'Medical Guide', topicType: 'MEDICALS', category: 'SSB Preparation' }) }
    ];
    vi.mocked(getDocs).mockResolvedValueOnce({
      forEach: (callback: (doc: any) => void) => mockDocSnapshots.forEach(callback)
    } as any);

    const materials = await repository.getStudyMaterials();
    expect(materials[0].testTypeId).toBeUndefined();
    expect(materials[0].testTypeId).not.toBe('conference');
  });

  it('should return study material by id from fallback when not found', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: []
    } as any);

    const material = await repository.getStudyMaterialById('ssb-overview-01');
    expect(material).not.toBeNull();
    expect(material?.id).toBe('ssb-overview-01');
  });

  it('should return study material by id from Firestore, looked up by the id field (not doc path)', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        {
          id: 'doc_wat',
          data: () => ({
            title: 'Firestore WAT Guide',
            testTypeId: 'wat',
            dayNumber: '2',
            summary: 'WAT guide summary'
          })
        }
      ]
    } as any);

    const material = await repository.getStudyMaterialById('doc_wat');
    expect(material).not.toBeNull();
    expect(material?.id).toBe('doc_wat');
    expect(material?.testTypeId).toBe('wat');
    expect(material?.dayNumber).toBe('2');
  });

  it('should return null for non-existent material id', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: []
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

  // Phase 5 (docs/plans/write-the-phased-plan-wobbly-pancake.md, D2 side documents).
  describe('getStudyMaterialSections', () => {
    it('returns null when no study_material_sections doc has been published for this material', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any);

      expect(await repository.getStudyMaterialSections('mat_1')).toBeNull();
    });

    it('returns null (never throws) when the fetch itself fails', async () => {
      vi.mocked(getDoc).mockRejectedValueOnce(new Error('offline'));

      expect(await repository.getStudyMaterialSections('mat_1')).toBeNull();
    });

    it('unwraps table rows from publishContent.js\'s { cells } wrapping back into string[][]', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          sections: [
            {
              id: 's#0',
              slug: 'a',
              heading: null,
              level: 0,
              blocks: [
                { type: 'paragraph', text: 'Hello' },
                { type: 'table', rows: [{ cells: ['H1', 'H2'] }, { cells: ['a', 'b'] }] }
              ]
            }
          ]
        })
      } as any);

      const model = await repository.getStudyMaterialSections('mat_1');

      expect(model?.sections[0].blocks[0]).toEqual({ type: 'paragraph', text: 'Hello' });
      expect(model?.sections[0].blocks[1]).toEqual({
        type: 'table',
        rows: [
          ['H1', 'H2'],
          ['a', 'b']
        ]
      });
    });
  });
});

