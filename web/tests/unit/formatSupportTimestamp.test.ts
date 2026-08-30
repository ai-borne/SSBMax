import { describe, it, expect } from 'vitest';
import { formatSupportTimestamp } from '../../src/components/support/supportFormatting';

/**
 * Phase 10 (Payment Ecosystem Hardening plan), issue 3: raw epoch millis (`expiryDate:
 * 1787065806968`) is unreadable to a support agent -- pins that a real value formats to a
 * human-readable date string and a missing one gets a placeholder, never the literal string
 * "null"/"undefined".
 */
describe('formatSupportTimestamp', () => {
  it('formats a real epoch-millis value as a human-readable date string', () => {
    const result = formatSupportTimestamp(1787065806968);
    expect(result).not.toBe('1787065806968');
    expect(result.length).toBeGreaterThan(0);
    expect(new Date(1787065806968).toLocaleString()).toBe(result);
  });

  it('returns a placeholder, not "null", for a null value', () => {
    expect(formatSupportTimestamp(null)).toBe('--');
  });

  it('returns a placeholder for a non-numeric value', () => {
    expect(formatSupportTimestamp('not-a-timestamp')).toBe('--');
    expect(formatSupportTimestamp(undefined)).toBe('--');
  });
});
