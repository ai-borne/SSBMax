import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentRepository } from '../../../src/repositories/ContentRepository';
import { getDocs, getDoc, doc, collection } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...paths) => ({ id: paths.join('/') })),
  doc: vi.fn((_db, ...paths) => ({ path: paths.join('/'), collectionName: paths[0], id: paths[paths.length - 1] })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((ref) => ref),
  limit: vi.fn((n) => n)
}));

vi.mock('../../../src/config/firebase', () => ({
  db: {}
}));

describe('Firestore Test Content Schema SSOT Contract Tests', () => {
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
    } as any);

    const result = await repository.getWATBatch('batch_0');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content', 'wat', 'word_batches', 'batch_0');
    expect(result.id).toBe('batch_0');
    expect(result.words).toHaveLength(60);
    expect(result.words[0]).toBe('WORD_1');
    expect(result.displayDurationSeconds).toBe(15);
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
    } as any);

    const result = await repository.getSRTBatch('batch_0');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content', 'srt', 'situation_batches', 'batch_0');
    expect(result.id).toBe('batch_0');
    expect(result.situations).toHaveLength(60);
    expect(result.situations[0]).toBe('Situation prompt #1');
    expect(result.totalTimeMinutes).toBe(30);
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
    } as any);

    const result = await repository.getTATSet('tat_set_1');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content', 'tat', 'image_batches', 'tat_set_1');
    expect(result.setName).toBe('TAT Practice Set Alpha');
    expect(result.totalSlides).toBe(12);
    expect(result.imageUrls).toHaveLength(12);
    expect(result.imageUrls[0]).toBe('https://storage.googleapis.com/ssbmax-prod.appspot.com/tat/slide_1.jpg');
    // SSB Protocol: 12th slide MUST be the blank card slide
    expect(result.imageUrls[11]).toBe('blank');
  });

  it('CONTRACT: MUST query primary SSOT path "test_content/oir/question_batches/{batchId}" and perform anti-cheating answer key sanitization', async () => {
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
      id: 'batch_0',
      data: () => ({
        batchIndex: 0,
        items: mock50Questions
      })
    } as any);

    const result = await repository.getOIRQuestions(0);

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content', 'oir', 'question_batches', 'batch_0');
    expect(result.items).toHaveLength(50);
    expect(result.items[0].questionText).toBe('OIR Question 1');
    
    // Anti-cheating verification: answer key & explanation MUST NOT leak to client
    result.items.forEach((item) => {
      expect((item as any).correctAnswerIndex).toBeUndefined();
      expect((item as any).answerKey).toBeUndefined();
      expect((item as any).explanation).toBeUndefined();
    });
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
    } as any);

    const result = await repository.getPPDTContext('ppdt_1');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'test_content', 'ppdt', 'image_batches', 'ppdt_1');
    expect(result.title).toBe('PPDT Standard Image 1');
    expect(result.imageUrl).toBe('https://storage.googleapis.com/ssbmax-prod.appspot.com/ppdt/image_1.png');
    expect(result.viewingTimeSeconds).toBe(30);
    expect(result.writingTimeSeconds).toBe(240);
  });

  it('CONTRACT: MUST query subcollections for getAvailableBatches(moduleName) metadata', async () => {
    const mockBatchDocs = [
      {
        id: 'batch_0',
        data: () => ({ name: 'OIR Batch 1', totalItems: 50 })
      },
      {
        id: 'batch_1',
        data: () => ({ name: 'OIR Batch 2', totalItems: 50 })
      }
    ];

    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      forEach: (cb: any) => mockBatchDocs.forEach(cb)
    } as any);

    const batches = await repository.getAvailableBatches('oir');

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'test_content', 'oir', 'question_batches');
    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual({ id: 'batch_0', name: 'OIR Batch 1', itemCount: 50 });
    expect(batches[1]).toEqual({ id: 'batch_1', name: 'OIR Batch 2', itemCount: 50 });
  });
});
