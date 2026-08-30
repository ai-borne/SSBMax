import { describe, it, expect } from 'vitest';
import {
  normalizeStorageUrl,
  mapDocToWATBatch,
  mapDocToSRTBatch,
  mapDocToTATSet,
  mapDocToPPDTContext,
  mapDocToOIRBatch
} from '../../../src/repositories/mappers/testContentMappers';

describe('testContentMappers Unit Tests', () => {
  describe('normalizeStorageUrl', () => {
    it('drops gs:// URLs instead of rewriting them to the CSP-blocked storage.googleapis.com host', () => {
      const gsUrl = 'gs://ssbmax-prod.appspot.com/tat/slide_01.jpg';
      expect(normalizeStorageUrl(gsUrl)).toBe('');
    });

    it('preserves existing HTTPS and HTTP URLs', () => {
      const httpUrl = 'https://images.unsplash.com/photo-1522071820081';
      expect(normalizeStorageUrl(httpUrl)).toBe(httpUrl);
    });

    it('handles empty, null, or undefined values gracefully', () => {
      expect(normalizeStorageUrl('')).toBe('');
      expect(normalizeStorageUrl(undefined)).toBe('');
    });
  });

  describe('mapDocToWATBatch', () => {
    it('handles array of string words', () => {
      const result = mapDocToWATBatch('wat_1', {
        words: ['COURAGE', 'HONESTY', 'LEADERSHIP'],
        displayDurationSeconds: 15
      });
      expect(result.id).toBe('wat_1');
      expect(result.words).toEqual(['COURAGE', 'HONESTY', 'LEADERSHIP']);
      expect(result.displayDurationSeconds).toBe(15);
    });

    it('handles polymorphic DTO object words', () => {
      const result = mapDocToWATBatch('wat_2', {
        words: [{ word: 'RESPONSIBILITY' }, { text: 'DETERMINATION' }]
      });
      expect(result.words).toEqual(['RESPONSIBILITY', 'DETERMINATION']);
    });

    it('provides offline fallback when payload is empty', () => {
      const result = mapDocToWATBatch('wat_empty', undefined);
      expect(result.words.length).toBeGreaterThan(0);
      expect(result.displayDurationSeconds).toBe(15);
    });
  });

  describe('mapDocToSRTBatch', () => {
    it('handles array of situation strings', () => {
      const result = mapDocToSRTBatch('srt_1', {
        situations: ['Situation 1', 'Situation 2'],
        totalTimeMinutes: 30
      });
      expect(result.situations).toEqual(['Situation 1', 'Situation 2']);
      expect(result.totalTimeMinutes).toBe(30);
    });

    it('handles polymorphic DTO object situations', () => {
      const result = mapDocToSRTBatch('srt_2', {
        items: [{ situation: 'Object situation 1' }, { text: 'Object situation 2' }]
      });
      expect(result.situations).toEqual(['Object situation 1', 'Object situation 2']);
    });
  });

  describe('mapDocToTATSet', () => {
    it('drops un-backfilled gs:// slides and falls back rather than emitting a CSP-blocked URL', () => {
      const result = mapDocToTATSet('tat_1', {
        setName: 'TAT Set Alpha',
        imageUrls: [
          'gs://ssbmax-prod.appspot.com/tat/pic1.jpg',
          'gs://ssbmax-prod.appspot.com/tat/pic2.jpg'
        ]
      });

      expect(result.setName).toBe('TAT Set Alpha');
      expect(result.totalSlides).toBe(12);
      expect(result.imageUrls).toHaveLength(12);
      expect(result.imageUrls[0]).not.toContain('gs://');
      expect(result.imageUrls[0]).not.toContain('storage.googleapis.com');
      expect(result.imageUrls[11]).toBe('blank');
    });

    it('normalizes already-resolved firebasestorage.googleapis.com URLs unchanged', () => {
      const url = 'https://firebasestorage.googleapis.com/v0/b/ssbmax-49e68.firebasestorage.app/o/tat%2Fpic1.jpg?alt=media&token=abc';
      const result = mapDocToTATSet('tat_2', {
        setName: 'TAT Set Beta',
        imageUrls: [url]
      });
      expect(result.imageUrls[0]).toBe(url);
    });
  });

  describe('mapDocToPPDTContext', () => {
    it('maps PPDT context document with default timer values', () => {
      const result = mapDocToPPDTContext('ppdt_1', {
        title: 'PPDT Officer Picture',
        imageUrl: 'gs://ssbmax-prod.appspot.com/ppdt/pic.png'
      });
      expect(result.title).toBe('PPDT Officer Picture');
      expect(result.imageUrl).not.toContain('gs://');
      expect(result.imageUrl).not.toContain('storage.googleapis.com');
      expect(result.viewingTimeSeconds).toBe(30);
      expect(result.writingTimeSeconds).toBe(240);
    });
  });

  describe('mapDocToOIRBatch', () => {
    it('sanitizes answer key fields (correctAnswerIndex/answerKey) for anti-cheating', () => {
      const rawData = {
        items: [
          {
            id: 'q1',
            questionNumber: 1,
            questionText: 'Which number comes next?',
            options: ['2', '4', '6', '8'],
            correctAnswerIndex: 3,
            answerKey: '8',
            explanation: 'Increments by 2'
          }
        ]
      };

      const result = mapDocToOIRBatch('batch_0', rawData, 0);
      expect(result.items).toHaveLength(1);
      const q = result.items[0];
      expect(q).toHaveProperty('id', 'q1');
      expect(q).toHaveProperty('questionText');
      expect(q).toHaveProperty('options');
      // Anti-cheating verification: answer keys MUST NOT exist on return object
      expect((q as unknown as Record<string, unknown>).correctAnswerIndex).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).answerKey).toBeUndefined();
      expect((q as unknown as Record<string, unknown>).explanation).toBeUndefined();
    });

    it('reads the questionImageUrl field the upload scripts and KMP actually write, not just imageUrl', () => {
      // scripts/oir-extraction/upload-oir-batch.js and shared/.../domain/model/OIRTest.kt both
      // use `questionImageUrl`. The mapper previously read only `imageUrl`/`image`, so every
      // OIR diagram question (e.g. "which cube belongs to Group A?") silently rendered with no
      // image on web even after the CSP/makePublic() migration fixed the URL itself.
      const rawData = {
        items: [
          {
            id: 'q1',
            questionNumber: 1,
            questionText: 'Which one of the following cubes can possibly belong to Group A?',
            options: ['1', '2', '3', '4', '5'],
            questionImageUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/oir%2Fcube.png?alt=media&token=abc'
          }
        ]
      };

      const result = mapDocToOIRBatch('batch_0', rawData, 0);
      expect(result.items[0].imageUrl).toBe(
        'https://firebasestorage.googleapis.com/v0/b/x/o/oir%2Fcube.png?alt=media&token=abc'
      );
    });
  });
});
