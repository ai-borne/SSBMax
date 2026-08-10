import { describe, it, expect } from 'vitest';
import { themeColors } from '../../src/constants/colors';

describe('Color Token SSOT — Phase 1 Expansion', () => {
  it('should define gold, emerald, violet semantic tokens in dark palette', () => {
    expect(themeColors.dark.gold).toBeDefined();
    expect(themeColors.dark.emerald).toBeDefined();
    expect(themeColors.dark.violet).toBeDefined();
  });

  it('should define day-accent tokens for all 5 SSB days in dark palette', () => {
    expect(themeColors.dark.day1).toBeDefined();
    expect(themeColors.dark.day2).toBeDefined();
    expect(themeColors.dark.day34).toBeDefined();
    expect(themeColors.dark.day5).toBeDefined();
  });

  it('should define matching semantic tokens in light palette', () => {
    expect(themeColors.light.gold).toBeDefined();
    expect(themeColors.light.emerald).toBeDefined();
    expect(themeColors.light.violet).toBeDefined();
    expect(themeColors.light.day1).toBeDefined();
  });

  it('should maintain the 4-level dark elevation system unchanged', () => {
    expect(themeColors.dark.bgPrimary).toBe('#0b0f19');
    expect(themeColors.dark.bgSecondary).toBe('#0f172a');
    expect(themeColors.dark.bgCard).toBe('#1e293b');
    expect(themeColors.dark.bgElevated).toBe('#334155');
  });

  it('should have 4 unique hex values within the dark day-accent group', () => {
    const dayColors = [
      themeColors.dark.day1,
      themeColors.dark.day2,
      themeColors.dark.day34,
      themeColors.dark.day5,
    ];
    expect(new Set(dayColors).size).toBe(4);
  });

  it('should have correct hex values for dark semantic tokens', () => {
    expect(themeColors.dark.gold).toBe('#f59e0b');
    expect(themeColors.dark.emerald).toBe('#10b981');
    expect(themeColors.dark.violet).toBe('#8b5cf6');
  });

  it('should have correct hex values for light semantic tokens', () => {
    expect(themeColors.light.gold).toBe('#d97706');
    expect(themeColors.light.emerald).toBe('#059669');
    expect(themeColors.light.violet).toBe('#7c3aed');
  });
});
