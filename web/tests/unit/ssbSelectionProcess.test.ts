import { describe, it, expect } from 'vitest';
import {
  GTO_TASKS,
  SSB_5_DAY_TIMELINE,
  SUBSCRIPTION_TIERS,
  getGTOTaskById,
  getGTOTasksByTier,
  getDayOverview,
  getTierAccessLevel,
  hasTierAccess,
} from '../../src/constants/ssbSelectionProcess';

describe('SSB Selection Process SSOT', () => {
  describe('GTO Tasks Metadata', () => {
    it('should define exactly 8 GTO tasks with sequential numbers 1 to 8', () => {
      expect(GTO_TASKS).toHaveLength(8);
      GTO_TASKS.forEach((task, index) => {
        expect(task.number).toBe(index + 1);
      });
    });

    it('should contain unique task IDs matching standard SSB nomenclature', () => {
      const expectedIds = ['gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt'];
      const actualIds = GTO_TASKS.map((t) => t.id);
      expect(actualIds).toEqual(expectedIds);
    });

    it('should ensure all 8 GTO tasks have valid non-empty metadata', () => {
      GTO_TASKS.forEach((task) => {
        expect(task.id).toBeTruthy();
        expect(task.shortCode).toBeTruthy();
        expect(task.testTypeId).toBeTruthy();
        expect(task.titleKey).toBeTruthy();
        expect(task.descriptionKey).toBeTruthy();
        expect(task.timeLimitMinutes).toBeGreaterThan(0);
        expect(['indoor', 'outdoor', 'individual', 'group']).toContain(task.category);
        expect(['cadet', 'officer', 'command']).toContain(task.accessTier);
        expect(task.olqsEvaluated.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('SSB 5-Day Timeline Structure', () => {
    it('should define 4 timeline periods covering Day 1, 2, 3-4, and 5', () => {
      expect(SSB_5_DAY_TIMELINE).toHaveLength(4);
      const dayNumbers = SSB_5_DAY_TIMELINE.map((d) => d.dayNumber);
      expect(dayNumbers).toEqual(['1', '2', '3-4', '5']);
    });

    it('should map day 3-4 to all 8 GTO test IDs', () => {
      const day34 = getDayOverview('3-4');
      expect(day34).toBeDefined();
      expect(day34?.testCount).toBe(8);
      expect(day34?.testTypeIds).toHaveLength(8);
      expect(day34?.testTypeIds).toEqual(['gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt']);
    });
  });

  describe('Subscription Tiers', () => {
    it('should define 3 subscription tiers in ascending access levels', () => {
      expect(SUBSCRIPTION_TIERS).toHaveLength(3);
      expect(SUBSCRIPTION_TIERS.map((t) => t.id)).toEqual(['cadet', 'officer', 'command']);
      expect(SUBSCRIPTION_TIERS.map((t) => t.accessLevel)).toEqual([0, 1, 2]);
    });

    it('should mark Officer Pass as the most popular tier', () => {
      const officerTier = SUBSCRIPTION_TIERS.find((t) => t.id === 'officer');
      expect(officerTier?.isPopular).toBe(true);
    });

    it('should populate non-empty strings and features for all tiers', () => {
      SUBSCRIPTION_TIERS.forEach((tier) => {
        expect(tier.title).toBeTruthy();
        expect(tier.price).toBeTruthy();
        expect(tier.badge).toBeTruthy();
        expect(tier.buttonText).toBeTruthy();
        expect(tier.features.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Helper Functions', () => {
    it('should look up GTO task by ID', () => {
      expect(getGTOTaskById('gd')?.shortCode).toBe('GD');
      expect(getGTOTaskById('command_task')?.shortCode).toBe('CT');
      expect(getGTOTaskById('invalid_id')).toBeUndefined();
    });

    it('should filter GTO tasks by subscription tier level', () => {
      const cadetTasks = getGTOTasksByTier('cadet');
      const officerTasks = getGTOTasksByTier('officer');
      const commandTasks = getGTOTasksByTier('command');

      expect(cadetTasks.every((t) => t.accessTier === 'cadet')).toBe(true);
      expect(officerTasks.length).toBeGreaterThan(cadetTasks.length);
      expect(commandTasks).toHaveLength(8);
    });

    it('should retrieve day overview by day number', () => {
      expect(getDayOverview('1')?.stageBadge).toBe('Stage I Screening');
      expect(getDayOverview('5')?.stageBadge).toBe('Stage II Final Board');
      // @ts-expect-error testing runtime fallback for invalid day
      expect(getDayOverview('invalid')).toBeUndefined();
    });

    it('should correctly evaluate tier access permissions', () => {
      expect(getTierAccessLevel('cadet')).toBe(0);
      expect(getTierAccessLevel('officer')).toBe(1);
      expect(getTierAccessLevel('command')).toBe(2);

      expect(hasTierAccess('cadet', 'cadet')).toBe(true);
      expect(hasTierAccess('cadet', 'officer')).toBe(false);
      expect(hasTierAccess('officer', 'cadet')).toBe(true);
      expect(hasTierAccess('officer', 'officer')).toBe(true);
      expect(hasTierAccess('officer', 'command')).toBe(false);
      expect(hasTierAccess('command', 'officer')).toBe(true);
    });
  });
});
