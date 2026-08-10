import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentRepository } from '../../../src/repositories/ContentRepository';
import { getDocs, getDoc, collection } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, collectionName) => ({ id: collectionName })),
  doc: vi.fn((_db, collectionName, id) => ({ collectionName, id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((ref) => ref),
  limit: vi.fn((n) => n)
}));

vi.mock('../../../src/config/firebase', () => ({
  db: {}
}));

describe('Firestore Schema SSOT Contract Tests', () => {
  let repository: ContentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ContentRepository();
  });

  it('CONTRACT: MUST query primary SSOT collection "study_materials" (used by Android & iOS)', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      forEach: (cb: any) =>
        cb({
          id: 'mat_oir_101',
          data: () => ({
            title: 'SSOT OIR Guide',
            topicType: 'OIR',
            contentMarkdown: '# Full OIR Guide Content',
            readTime: '6 min read'
          })
        })
    } as any);

    const materials = await repository.getStudyMaterials();

    // Verify first call to collection is 'study_materials' (snake_case)
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'study_materials');
    expect(materials).toHaveLength(1);
    expect(materials[0].title).toBe('SSOT OIR Guide');
    expect(materials[0].contentMarkdown).toBe('# Full OIR Guide Content');
  });

  it('CONTRACT: MUST NOT query the orphaned "studyMaterials" collection -- "study_materials" is the only SSOT path; zero docs falls back to offline content, not a second Firestore guess', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: true,
      forEach: vi.fn()
    } as any);

    const materials = await repository.getStudyMaterials();

    expect(collection).toHaveBeenCalledTimes(1);
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'study_materials');
    expect(materials.length).toBeGreaterThan(0); // offline fallback content, not a Firestore guess
  });

  it('CONTRACT: MUST map "introduction" field from topic_content to contentMarkdown when contentMarkdown is absent', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      forEach: (cb: any) =>
        cb({
          id: 'topic_gto',
          data: () => ({
            title: 'GTO Tasks Masterclass',
            topicType: 'GTO',
            introduction: '# GTO Overview\n\nComprehensive 8 task breakdown...'
          })
        })
    } as any);

    const materials = await repository.getStudyMaterials();
    expect(materials).toHaveLength(1);
    expect(materials[0].contentMarkdown).toContain('Comprehensive 8 task breakdown');
  });

  it('CONTRACT: MUST parse readTime string ("8 min read") into integer estimatedReadTimeMinutes', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      forEach: (cb: any) =>
        cb({
          id: 'mat_read_time',
          data: () => ({
            title: 'Timed Guide',
            topicType: 'INTERVIEW',
            readTime: '8 min read'
          })
        })
    } as any);

    const materials = await repository.getStudyMaterials();
    expect(materials[0].estimatedReadTimeMinutes).toBe(8);
  });

  it('CONTRACT: MUST fetch single document by ID from "study_materials" primary collection', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'doc_ssot_123',
      data: () => ({
        title: 'Single SSOT Guide',
        topicType: 'PPDT',
        contentMarkdown: '# Full PPDT Guide Content'
      })
    } as any);

    const material = await repository.getStudyMaterialById('doc_ssot_123');

    expect(material).not.toBeNull();
    expect(material?.id).toBe('doc_ssot_123');
    expect(material?.contentMarkdown).toBe('# Full PPDT Guide Content');
  });
});
