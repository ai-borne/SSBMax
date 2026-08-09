import { describe, it, expect } from 'vitest';
import { strings } from '../../src/constants/strings';

describe('SSOT String Resources & Sanitization Audit', () => {
  it('should export all required domain string modules', () => {
    expect(strings.common).toBeDefined();
    expect(strings.landing).toBeDefined();
    expect(strings.oir).toBeDefined();
    expect(strings.psychology).toBeDefined();
    expect(strings.olq).toBeDefined();
    expect(strings.radar).toBeDefined();
    expect(strings.dossier).toBeDefined();
    expect(strings.practice).toBeDefined();
  });

  it('should contain ZERO occurrences of DIPR jargon in string values', () => {
    const stringified = JSON.stringify(strings);
    expect(stringified).not.toContain('DIPR');
  });

  it('should contain friendly bracketed explanations for key SSB tests', () => {
    expect(strings.oir.title).toContain('OIR (Intelligence & Reasoning Test)');
    expect(strings.psychology.tatTitle).toContain('TAT (12-Picture Story Test)');
    expect(strings.psychology.watTitle).toContain('WAT (Word Association Test)');
    expect(strings.psychology.srtTitle).toContain('SRT (Situation Reaction Test)');
    expect(strings.psychology.ppdtTitle).toContain('PPDT (Picture Perception & Discussion Test)');
    expect(strings.psychology.sdTitle).toContain('SD (Self Description Test)');
  });

  it('should define 10-second sandbox prompts and 1-tap preset action chips', () => {
    expect(strings.landing.sandboxTitle).toBeDefined();
    expect(strings.landing.chipOfficer).toBeDefined();
    expect(strings.landing.chipAverage).toBeDefined();
    expect(strings.landing.instantBadge).toBe('INSTANT LOCAL EVALUATION (< 50ms)');
  });
});
