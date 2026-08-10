import { describe, it, expect } from 'vitest';
import { ssbDayConfigs } from '../../../src/components/study/ssbDayData';
import { StudyMaterial } from '../../../src/types/testContent';

describe('ssbDayData Unit Tests', () => {
  const dummyMaterials: StudyMaterial[] = [
    {
      id: 'tat_1',
      title: 'TAT Story',
      category: 'Psych',
      summary: 'TAT summary',
      contentMarkdown: 'TAT markdown',
      estimatedReadTimeMinutes: 5,
      tags: ['tat'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '2',
      testTypeId: 'tat'
    },
    {
      id: 'wat_1',
      title: 'WAT Words',
      category: 'Psych',
      summary: 'WAT summary',
      contentMarkdown: 'WAT markdown',
      estimatedReadTimeMinutes: 5,
      tags: ['wat'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '2',
      testTypeId: 'wat'
    }
  ];

  it('should export section configurations for Days 1, 2, 3-4, and 5', () => {
    expect(ssbDayConfigs).toHaveLength(4);
    const dayNumbers = ssbDayConfigs.map((cfg) => cfg.dayNumber);
    expect(dayNumbers).toEqual(['1', '2', '3-4', '5']);
  });

  it('should configure valid test cards with non-empty titles and descriptions for all days', () => {
    ssbDayConfigs.forEach((section) => {
      expect(section.stageBadge).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.subtitle).toBeTruthy();

      const mockGetMaterials = (testType: string) =>
        dummyMaterials.filter((m) => m.testTypeId === testType);

      const cards = section.getTestCards(mockGetMaterials);
      expect(cards.length).toBeGreaterThan(0);

      cards.forEach((card) => {
        expect(card.id).toBeTruthy();
        expect(card.testTypeId).toBeTruthy();
        expect(card.title).toBeTruthy();
        expect(card.shortCode).toBeTruthy();
        expect(card.description).toBeTruthy();
        expect(['cadet', 'officer', 'command']).toContain(card.requiredTier || 'cadet');
      });
    });
  });

  it('should configure compositeTestTypeIds explicitly for PSYCH and Conference aggregate cards', () => {
    const day2Config = ssbDayConfigs.find((cfg) => cfg.dayNumber === '2');
    expect(day2Config).toBeDefined();

    const mockGetMaterials = (testType: string, composite?: StudyMaterial['testTypeId'][]) => {
      if (composite) {
        return dummyMaterials.filter((m) => m.testTypeId && composite.includes(m.testTypeId));
      }
      return dummyMaterials.filter((m) => m.testTypeId === testType);
    };

    const day2Cards = day2Config!.getTestCards(mockGetMaterials);
    const psychCard = day2Cards.find((c) => c.id === 'psych');
    expect(psychCard).toBeDefined();
    expect(psychCard?.compositeTestTypeIds).toEqual(['tat', 'wat', 'srt', 'sd']);
    expect(psychCard?.materials).toHaveLength(2); // tat_1 and wat_1 match

    const day5Config = ssbDayConfigs.find((cfg) => cfg.dayNumber === '5');
    const day5Cards = day5Config!.getTestCards(mockGetMaterials);
    const confCard = day5Cards.find((c) => c.id === 'conference');
    expect(confCard).toBeDefined();
    expect(confCard?.compositeTestTypeIds).toEqual(['conference', 'interview']);
  });
});
