import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentRepository } from '../../../src/repositories/ContentRepository';
import { ContentUnavailableError } from '../../../src/types/errors';
import { getDocs, getDoc, doc, collection, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...paths) => ({ id: paths.join('/') })),
  doc: vi.fn((_db, ...paths) => ({ path: paths.join('/'), collectionName: paths[0], id: paths[paths.length - 1] })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((ref) => ref),
  limit: vi.fn((n) => n),
  FirestoreError: class FirestoreError extends Error {}
}));

vi.mock('../../../src/config/firebase', () => ({
  db: {}
}));

// Phase 6 (docs/plans/CrossPlatform_SSOT) narrowed this file's scope: cross-platform path
// drift detection (the reason it originally mocked firebase/firestore and asserted call
// args) now lives in sharedCorpusEmulator.test.ts, which reads a real emulator seeded with
// the same fixture data-firebase's Kotlin DTOs are asserted against -- a per-platform mock
// can lock in a wrong path (§3.6 of the plan) but can never catch it forking from KMP. What
// stays here is real, mock-independent value: mapping/normalization business logic
// (blank-card append, gs:// URL rewriting, readTime parsing) and the anti-cheat answer-key
// stripping invariant, none of which the emulator suite re-asserts per field.
describe('Firestore Test Content Schema SSOT Contract Tests (Phase 0b)', () => {
  let repository: ContentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ContentRepository();
  });

  it('CONTRACT: MUST query primary SSOT path "test_content/wat/word_batches/{batchId}" and map polymorphic 60-word WAT batch', async () => {
    const mock60Words = Array.from({ length: 60 }, (_, i) => ({ word: `WORD_${i + 1}` }));
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'batch_0',
      data: () => ({
        words: mock60Words,
        displayDurationSeconds: 15
      })
    } as unknown as DocumentSnapshot);

    const result = await repository.getWATBatch('batch_0');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content/wat/word_batches', 'batch_0');
    expect(result.id).toBe('batch_0');
    expect(result.words).toHaveLength(60);
    expect(result.words[0]).toBe('WORD_1');
    expect(result.displayDurationSeconds).toBe(15);
  });

  it('CONTRACT: a missing WAT batch fails loudly with ContentUnavailableError, not a fabricated word list', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as unknown as DocumentSnapshot);
    await expect(repository.getWATBatch('batch_missing')).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('CONTRACT: MUST query primary SSOT path "test_content/srt/situation_batches/{batchId}" and map polymorphic 60-situation SRT batch', async () => {
    const mock60Situations = Array.from({ length: 60 }, (_, i) => ({ situation: `Situation prompt #${i + 1}` }));
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'batch_0',
      data: () => ({
        situations: mock60Situations,
        totalTimeMinutes: 30
      })
    } as unknown as DocumentSnapshot);

    const result = await repository.getSRTBatch('batch_0');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content/srt/situation_batches', 'batch_0');
    expect(result.id).toBe('batch_0');
    expect(result.situations).toHaveLength(60);
    expect(result.situations[0]).toBe('Situation prompt #1');
    expect(result.totalTimeMinutes).toBe(30);
  });

  it('CONTRACT: a missing SRT batch fails loudly with ContentUnavailableError', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as unknown as DocumentSnapshot);
    await expect(repository.getSRTBatch('batch_missing')).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('CONTRACT: MUST query primary SSOT path "test_content/tat/image_batches/{batchId}" and append 12th blank card per SSB protocol', async () => {
    const mock11Slides = Array.from({ length: 11 }, (_, i) => `gs://ssbmax-prod.appspot.com/tat/slide_${i + 1}.jpg`);
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'tat_set_1',
      data: () => ({
        setName: 'TAT Practice Set Alpha',
        imageUrls: mock11Slides,
        slideDurationSeconds: 240
      })
    } as unknown as DocumentSnapshot);

    const result = await repository.getTATSet('tat_set_1');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content/tat/image_batches', 'tat_set_1');
    expect(result.setName).toBe('TAT Practice Set Alpha');
    expect(result.totalSlides).toBe(12);
    expect(result.imageUrls).toHaveLength(12);
    expect(result.imageUrls[0]).toBe('https://storage.googleapis.com/ssbmax-prod.appspot.com/tat/slide_1.jpg');
    // SSB Protocol: 12th slide MUST be the blank card slide
    expect(result.imageUrls[11]).toBe('blank');
  });

  it('CONTRACT: a missing TAT set fails loudly with ContentUnavailableError', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as unknown as DocumentSnapshot);
    await expect(repository.getTATSet('tat_set_missing')).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('CONTRACT: MUST query the KMP-authoritative path "test_content/oir/batches/{batch_pdf_NNN}" (not question_batches/content_oir/oir_batches) and perform anti-cheating answer key sanitization', async () => {
    const mock50Questions = Array.from({ length: 50 }, (_, i) => ({
      id: `q_${i + 1}`,
      questionNumber: i + 1,
      questionText: `OIR Question ${i + 1}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      type: i % 2 === 0 ? 'VERBAL' : 'NON_VERBAL',
      correctAnswerIndex: 2,
      answerKey: 'Option C',
      explanation: 'Detailed solution logic'
    }));

    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'batch_pdf_001',
      data: () => ({
        batchIndex: 0,
        questions: mock50Questions
      })
    } as unknown as DocumentSnapshot);

    const result = await repository.getOIRQuestions(0);

    // batchIndex 0 -> 1-indexed doc id batch_pdf_001, per GitLiveOIRQuestionCacheManager.batchId
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content/oir/batches', 'batch_pdf_001');
    expect(result.items).toHaveLength(50);
    expect(result.items[0].questionText).toBe('OIR Question 1');

    // Anti-cheating verification: answer key & explanation MUST NOT leak to client
    result.items.forEach((item) => {
      expect((item as unknown as Record<string, unknown>).correctAnswerIndex).toBeUndefined();
      expect((item as unknown as Record<string, unknown>).answerKey).toBeUndefined();
      expect((item as unknown as Record<string, unknown>).explanation).toBeUndefined();
    });
  });

  it('CONTRACT: a missing OIR batch fails loudly with ContentUnavailableError, never scores/renders a fabricated question set', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as unknown as DocumentSnapshot);
    await expect(repository.getOIRQuestions(0)).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('CONTRACT: MUST query primary SSOT path "test_content/ppdt/image_batches/{id}" for PPDT context with storage URL normalization', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'ppdt_1',
      data: () => ({
        title: 'PPDT Standard Image 1',
        imageUrl: 'gs://ssbmax-prod.appspot.com/ppdt/image_1.png',
        viewingTimeSeconds: 30,
        writingTimeSeconds: 240,
        instructions: ['Observe for 30s', 'Write story in 4m']
      })
    } as unknown as DocumentSnapshot);

    const result = await repository.getPPDTContext('ppdt_1');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content/ppdt/image_batches', 'ppdt_1');
    expect(result.title).toBe('PPDT Standard Image 1');
    expect(result.imageUrl).toBe('https://storage.googleapis.com/ssbmax-prod.appspot.com/ppdt/image_1.png');
    expect(result.viewingTimeSeconds).toBe(30);
    expect(result.writingTimeSeconds).toBe(240);
  });

  it('CONTRACT: MUST decode PPDTImageContext rubric fields from Firestore batch document', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 'batch_001',
      data: () => ({
        batch_id: 'batch_001',
        totalImages: 1,
        images: [
          {
            id: 'ppdt_001',
            imageUrl: 'https://storage.googleapis.com/ssbmax-prod.appspot.com/ppdt/ppdt_image_001.jpg',
            imageDescription: 'A group of villagers meeting near a bridge',
            context: {
              sceneDescription: 'Villagers meeting near damaged bridge',
              coreElements: ['Damaged bridge', 'Group of villagers', 'Paper carrying leader'],
              expectedThemes: ['Community repair', 'Leadership action'],
              penalizedThemes: ['Violent protest', 'Crime'],
              primaryOLQs: ['INITIATIVE', 'ORGANIZING_ABILITY', 'SOCIAL_ADJUSTMENT'],
              deviationTolerance: 'MEDIUM'
            }
          }
        ]
      })
    } as unknown as DocumentSnapshot);

    const result = await repository.getPPDTContext('batch_001');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content/ppdt/image_batches', 'batch_001');
    expect(result.id).toBe('ppdt_001');
    expect(result.imageUrl).toBe('https://storage.googleapis.com/ssbmax-prod.appspot.com/ppdt/ppdt_image_001.jpg');
    expect(result.imageContext).toBeDefined();
    expect(result.imageContext?.sceneDescription).toBe('Villagers meeting near damaged bridge');
    expect(result.imageContext?.coreElements).toEqual(['Damaged bridge', 'Group of villagers', 'Paper carrying leader']);
    expect(result.imageContext?.primaryOLQs).toEqual(['INITIATIVE', 'ORGANIZING_ABILITY', 'SOCIAL_ADJUSTMENT']);
  });

  it('CONTRACT: a missing PPDT context fails loudly with ContentUnavailableError', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as unknown as DocumentSnapshot);
    await expect(repository.getPPDTContext('ppdt_missing')).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('CONTRACT: MUST query the KMP-authoritative "test_content/oir/batches" subcollection for getAvailableBatches("oir")', async () => {
    const mockBatchDocs = [
      { id: 'batch_pdf_001', data: () => ({ name: 'OIR Batch 1', totalItems: 50 }) },
      { id: 'batch_pdf_002', data: () => ({ name: 'OIR Batch 2', totalItems: 50 }) }
    ];

    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      forEach: (cb: (doc: unknown) => void) => mockBatchDocs.forEach(cb)
    } as unknown as QuerySnapshot);

    const batches = await repository.getAvailableBatches('oir');

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'test_content', 'oir', 'batches');
    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual({ id: 'batch_pdf_001', name: 'OIR Batch 1', itemCount: 50 });
    expect(batches[1]).toEqual({ id: 'batch_pdf_002', name: 'OIR Batch 2', itemCount: 50 });
  });

  it('CONTRACT: getAvailableBatches returns [] for an unmapped module rather than a hardcoded defaultsMap of fictional batches', async () => {
    const batches = await repository.getAvailableBatches('not_a_real_module');
    expect(batches).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });
});
