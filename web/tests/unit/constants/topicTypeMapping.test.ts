// Phase 7, MEDIUM 4c: replaces ContentRepository's old fuzzy `parseTestTypeId` keyword
// matcher with this explicit, exhaustive table. These tests pin the two concrete
// mis-categorizations the fuzzy matcher produced -- MEDICALS silently mapping to
// 'conference', and every PSYCHOLOGY material collapsing onto 'tat' alone -- so a future
// change can't reintroduce either without failing here.
import { describe, it, expect } from 'vitest';
import { TOPIC_TYPE_TO_TEST_TYPE_IDS, primaryTestTypeIdForTopicType, testTypeIdsForTopicType } from '../../../src/constants/topicTypeMapping';

describe('primaryTestTypeIdForTopicType', () => {
  it('returns the single testTypeId for unambiguous topics', () => {
    expect(primaryTestTypeIdForTopicType('OIR')).toBe('oir');
    expect(primaryTestTypeIdForTopicType('PPDT')).toBe('ppdt');
    expect(primaryTestTypeIdForTopicType('PIQ_FORM')).toBe('piq');
    expect(primaryTestTypeIdForTopicType('INTERVIEW')).toBe('interview');
    expect(primaryTestTypeIdForTopicType('CONFERENCE')).toBe('conference');
  });

  it('is case-insensitive on the topicType input', () => {
    expect(primaryTestTypeIdForTopicType('oir')).toBe('oir');
  });

  it('returns undefined for a topicType spanning multiple testTypeIds, rather than guessing one', () => {
    expect(primaryTestTypeIdForTopicType('GTO')).toBeUndefined();
    expect(primaryTestTypeIdForTopicType('PSYCHOLOGY')).toBeUndefined();
  });

  it('returns undefined for MEDICALS -- never the old fuzzy matcher\'s wrong "conference" guess', () => {
    expect(primaryTestTypeIdForTopicType('MEDICALS')).not.toBe('conference');
    expect(primaryTestTypeIdForTopicType('MEDICALS')).toBeUndefined();
  });

  it('returns undefined for SSB_OVERVIEW and an unrecognized topicType', () => {
    expect(primaryTestTypeIdForTopicType('SSB_OVERVIEW')).toBeUndefined();
    expect(primaryTestTypeIdForTopicType('NOT_A_REAL_TOPIC')).toBeUndefined();
  });

  it('returns undefined when topicType is undefined', () => {
    expect(primaryTestTypeIdForTopicType(undefined)).toBeUndefined();
  });
});

describe('testTypeIdsForTopicType', () => {
  it('lists every testTypeId a multi-valued topic covers', () => {
    expect(testTypeIdsForTopicType('PSYCHOLOGY')).toEqual(['tat', 'wat', 'srt', 'sd']);
    expect(testTypeIdsForTopicType('GTO')).toEqual(
      expect.arrayContaining(['gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt'])
    );
  });

  it('returns an empty array for an unmapped topicType', () => {
    expect(testTypeIdsForTopicType('MEDICALS')).toEqual([]);
    expect(testTypeIdsForTopicType(undefined)).toEqual([]);
  });
});

describe('TOPIC_TYPE_TO_TEST_TYPE_IDS', () => {
  it('never maps any topic onto conference except CONFERENCE itself', () => {
    for (const [topicType, ids] of Object.entries(TOPIC_TYPE_TO_TEST_TYPE_IDS)) {
      if (topicType !== 'CONFERENCE') {
        expect(ids).not.toContain('conference');
      }
    }
  });
});
