// Regression test for the "Executive Summary" blockquote showing literal markdown syntax
// (docs/plans/write-the-phased-plan-wobbly-pancake.md Phase 5 parity gate: "no literal markdown
// syntax visible anywhere") -- the previous fallback in ContentRepository.ts raw-sliced the
// first 150 characters of markdown, which was the `# Heading` line itself for every material.
import { describe, it, expect } from 'vitest';
import { summarizeMarkdown } from '../../src/utils/summarizeMarkdown';

describe('summarizeMarkdown', () => {
  it('drops the leading heading line entirely rather than including its # syntax', () => {
    const markdown = '# Understanding OIR Test Pattern\n\nThe OIR test is the first major hurdle.';

    const summary = summarizeMarkdown(markdown);

    expect(summary).not.toContain('#');
    expect(summary).toBe('The OIR test is the first major hurdle.');
  });

  it('strips bold and italic emphasis markers', () => {
    const summary = summarizeMarkdown('**Bold text** and *italic text* here.');

    expect(summary).toBe('Bold text and italic text here.');
  });

  it('strips list markers', () => {
    const summary = summarizeMarkdown('- First point\n- Second point');

    expect(summary).toBe('First point Second point');
  });

  it('truncates at a word boundary with an ellipsis when longer than maxLength', () => {
    const longText = 'word '.repeat(60).trim();

    const summary = summarizeMarkdown(longText, 50);

    expect(summary.length).toBeLessThanOrEqual(53); // 50 + '...'
    expect(summary.endsWith('...')).toBe(true);
    expect(summary).not.toMatch(/\bwor\.\.\.$/); // never cuts mid-word
  });

  it('returns short text unchanged (no trailing ellipsis)', () => {
    const summary = summarizeMarkdown('A short summary.', 150);

    expect(summary).toBe('A short summary.');
  });
});
