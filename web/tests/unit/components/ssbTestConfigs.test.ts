import { describe, it, expect } from 'vitest';
import {
  ALL_TEST_CONFIGS,
  DAY_2_TESTS,
  DAY_3_4_TESTS,
  DAY_5_TESTS,
  getTestConfigById,
} from '../../../src/components/practice/ssbTestConfigs';

describe('ssbTestConfigs card -> contract mapping', () => {
  it('does not define a "psychology" battery card (collided with the real "tat" card on testTypeId)', () => {
    expect(getTestConfigById('psychology')).toBeUndefined();
    expect(DAY_2_TESTS.some((config) => config.id === 'psychology')).toBe(false);
  });

  it('every card id in ALL_TEST_CONFIGS is unique', () => {
    const ids = ALL_TEST_CONFIGS.map((config) => config.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks "conference" as a non-gradable content card with no contractTestType', () => {
    const conference = getTestConfigById('conference');
    expect(conference).toBeDefined();
    expect(conference?.contractTestType).toBeUndefined();
  });

  it('keeps "snake_race" gradable, mapped 1:1 to GTO_GOR (GTOSubmission.GORSubmission is a real gradeable type)', () => {
    const snakeRace = DAY_3_4_TESTS.find((config) => config.id === 'snake_race');
    expect(snakeRace).toBeDefined();
    expect(snakeRace?.contractTestType).toBe('GTO_GOR');
  });

  it('maps every other GTO sub-type 1:1 to its contract TestType member (GTO taxonomy parity fix -- FGT and Lecturette now have real contract TestType members too, matching every other GTO sub-type, even though only GD/GPE/Lecturette have a built submission flow today)', () => {
    const expected: Record<string, string> = {
      gd: 'GTO_GD',
      gpe: 'GTO_GPE',
      pgt: 'GTO_PGT',
      hgt: 'GTO_HGT',
      iot: 'GTO_IO',
      command_task: 'GTO_CT',
      fgt: 'GTO_FGT',
      lecturette: 'GTO_LECTURETTE',
    };
    for (const [id, contractTestType] of Object.entries(expected)) {
      const config = DAY_3_4_TESTS.find((c) => c.id === id);
      expect(config?.contractTestType).toBe(contractTestType);
    }
  });

  it('interview keeps its per-response IO contractTestType', () => {
    const interview = DAY_5_TESTS.find((config) => config.id === 'interview');
    expect(interview?.contractTestType).toBe('IO');
  });
});
