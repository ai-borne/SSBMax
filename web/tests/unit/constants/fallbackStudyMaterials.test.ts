import { describe, it, expect } from 'vitest';
import {
  FALLBACK_STUDY_MATERIALS,
  getFallbackStudyMaterials,
  getFallbackStudyMaterialById
} from '../../../src/constants/fallbackStudyMaterials';
import { StudyMaterial } from '../../../src/types/testContent';

describe('fallbackStudyMaterials Unit Tests', () => {
  const ALL_16_TEST_TYPES: NonNullable<StudyMaterial['testTypeId']>[] = [
    'oir',
    'ppdt',
    'piq',
    'tat',
    'wat',
    'srt',
    'sd',
    'gd',
    'gpe',
    'pgt',
    'hgt',
    'iot',
    'command_task',
    'snake_race',
    'fgt',
    'interview',
    'conference'
  ];

  it('should export an array containing fallback materials for all 16 SSB test types', () => {
    const materials = getFallbackStudyMaterials();
    expect(materials.length).toBeGreaterThanOrEqual(16);

    const configuredTestTypes = new Set(
      materials.map((m) => m.testTypeId).filter(Boolean)
    );

    ALL_16_TEST_TYPES.forEach((testType) => {
      expect(configuredTestTypes.has(testType)).toBe(true);
    });
  });

  it('should have non-empty titles, summaries, contentMarkdown, and categories for all fallback items', () => {
    FALLBACK_STUDY_MATERIALS.forEach((material) => {
      expect(material.id).toBeTruthy();
      expect(material.title.length).toBeGreaterThan(0);
      expect(material.summary.length).toBeGreaterThan(0);
      expect(material.contentMarkdown.length).toBeGreaterThan(0);
      expect(material.category.length).toBeGreaterThan(0);
      expect(material.estimatedReadTimeMinutes).toBeGreaterThan(0);
      expect(Array.isArray(material.tags)).toBe(true);
      expect(material.tags.length).toBeGreaterThan(0);
    });
  });

  it('should assign valid dayNumber to all fallback study materials', () => {
    const validDays = ['1', '2', '3-4', '5'];
    FALLBACK_STUDY_MATERIALS.forEach((material) => {
      expect(material.dayNumber).toBeDefined();
      expect(validDays).toContain(material.dayNumber);
    });
  });

  it('should find fallback study material by id', () => {
    const overview = getFallbackStudyMaterialById('ssb-overview-01');
    expect(overview).not.toBeNull();
    expect(overview?.title).toContain('5-Day');

    const oirGuide = getFallbackStudyMaterialById('fallback-oir');
    expect(oirGuide).not.toBeNull();
    expect(oirGuide?.testTypeId).toBe('oir');

    const invalid = getFallbackStudyMaterialById('non_existent_id');
    expect(invalid).toBeNull();
  });
});
