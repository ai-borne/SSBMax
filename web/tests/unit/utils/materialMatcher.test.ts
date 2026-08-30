import { describe, it, expect } from 'vitest';
import { filterMaterialsForTestCard } from '../../../src/utils/materialMatcher';
import { StudyMaterial } from '../../../src/types/testContent';

describe('materialMatcher Unit Tests', () => {
  const sampleMaterials: StudyMaterial[] = [
    {
      id: 'mat_oir_1',
      title: 'OIR Verbal Reasoning',
      category: 'Stage 1',
      summary: 'Mastering speed for OIR Rating 1',
      contentMarkdown: '# OIR Guide',
      estimatedReadTimeMinutes: 5,
      tags: ['OIR', 'Reasoning'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '1',
      testTypeId: 'oir'
    },
    {
      id: 'mat_ppdt_1',
      title: 'PPDT Story Writing',
      category: 'Stage 1',
      summary: 'Perception and narration tactics',
      contentMarkdown: '# PPDT Guide',
      estimatedReadTimeMinutes: 5,
      tags: ['PPDT', 'Narration'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '1',
      testTypeId: 'ppdt'
    },
    {
      id: 'mat_tat_1',
      title: 'TAT Story Development',
      category: 'Psychology',
      summary: 'Projecting 15 OLQs in 12 slides',
      contentMarkdown: '# TAT Guide',
      estimatedReadTimeMinutes: 6,
      tags: ['TAT', 'Psych'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '2',
      testTypeId: 'tat'
    },
    {
      id: 'mat_wat_1',
      title: 'WAT Word Association',
      category: 'Psychology',
      summary: 'Rapid 15-second reactions',
      contentMarkdown: '# WAT Guide',
      estimatedReadTimeMinutes: 5,
      tags: ['WAT', 'Psych'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '2',
      testTypeId: 'wat'
    },
    {
      id: 'mat_srt_1',
      title: 'SRT Practical Solutions',
      category: 'Psychology',
      summary: '60 real-life crisis reactions',
      contentMarkdown: '# SRT Guide',
      estimatedReadTimeMinutes: 6,
      tags: ['SRT', 'Psych'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '2',
      testTypeId: 'srt'
    },
    {
      id: 'mat_sd_1',
      title: 'Self Description Structuring',
      category: 'Psychology',
      summary: '5 paragraphs of honest introspection',
      contentMarkdown: '# SD Guide',
      estimatedReadTimeMinutes: 5,
      tags: ['SD', 'Psych'],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '2',
      testTypeId: 'sd'
    },
    {
      id: 'mat_gto_1',
      title: 'GTO Command Task Guide',
      category: 'GTO Preparation',
      summary: 'Subordinate selection tactics',
      contentMarkdown: '# Command Guide',
      estimatedReadTimeMinutes: 5,
      tags: [],
      createdAt: '2026-01-01T00:00:00Z',
      dayNumber: '3-4',
      // testTypeId is intentionally omitted: GTO's topicType covers 8 testTypeIds and
      // ContentRepository leaves testTypeId undefined rather than guessing one (Phase 7,
      // MEDIUM 4c) -- topicType is the only signal this fixture carries, exercising the
      // explicit constants/topicTypeMapping.ts fallback below.
      topicType: 'GTO'
    }
  ];

  it('should return exact match for single testTypeId', () => {
    const result = filterMaterialsForTestCard(sampleMaterials, { testTypeId: 'oir' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mat_oir_1');
  });

  it('should aggregate composite materials matching compositeTestTypeIds array', () => {
    const psychComposite = filterMaterialsForTestCard(sampleMaterials, {
      compositeTestTypeIds: ['tat', 'wat', 'srt', 'sd']
    });
    expect(psychComposite).toHaveLength(4);
    const ids = psychComposite.map((m) => m.id);
    expect(ids).toContain('mat_tat_1');
    expect(ids).toContain('mat_wat_1');
    expect(ids).toContain('mat_srt_1');
    expect(ids).toContain('mat_sd_1');
  });

  it('should match composite AND single testTypeId combined without duplicates', () => {
    const result = filterMaterialsForTestCard(sampleMaterials, {
      testTypeId: 'tat',
      compositeTestTypeIds: ['tat', 'wat']
    });
    expect(result).toHaveLength(2);
  });

  it('should filter matching materials by lowercased search query over title and summary', () => {
    const searchResult = filterMaterialsForTestCard(sampleMaterials, {
      compositeTestTypeIds: ['tat', 'wat', 'srt', 'sd'],
      searchQuery: 'crisis'
    });
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0].id).toBe('mat_srt_1');
  });

  it('should return empty array if search query does not match any material', () => {
    const result = filterMaterialsForTestCard(sampleMaterials, {
      testTypeId: 'oir',
      searchQuery: 'non_existent_term_xyz'
    });
    expect(result).toHaveLength(0);
  });

  it('should match a material with no testTypeId via its topicType\'s explicit test-type list (Phase 7, no fuzzy fallback)', () => {
    const result = filterMaterialsForTestCard(sampleMaterials, {
      testTypeId: 'command_task'
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mat_gto_1');
  });

  it('should not match a topicType-only material against a testTypeId its topicType does not cover', () => {
    const result = filterMaterialsForTestCard(sampleMaterials, {
      testTypeId: 'interview'
    });
    expect(result.map((m) => m.id)).not.toContain('mat_gto_1');
  });

  it('should return all materials when no testTypeId or compositeTestTypeIds is specified', () => {
    const result = filterMaterialsForTestCard(sampleMaterials, {});
    expect(result).toHaveLength(sampleMaterials.length);
  });

  it('should handle empty input array safely', () => {
    const result = filterMaterialsForTestCard([], { testTypeId: 'oir' });
    expect(result).toHaveLength(0);
  });
});
