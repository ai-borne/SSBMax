import { describe, it, expect } from 'vitest';
import { estimateSectionReadingMinutes } from '../../../src/components/content/blocks/estimateReadingTime';
import type { DocSection } from '../../../src/components/content/blocks/types';

describe('estimateSectionReadingMinutes', () => {
  it('floors at one minute for a short section', () => {
    const section: DocSection = {
      id: 's1',
      slug: 's1',
      heading: 'Short',
      level: 2,
      blocks: [{ type: 'paragraph', text: 'just a few words here' }],
    };

    expect(estimateSectionReadingMinutes(section)).toBe(1);
  });

  it('rounds word count to the nearest minute at 200 words/minute', () => {
    const longParagraph = Array(600).fill('word').join(' ');
    const section: DocSection = {
      id: 's2',
      slug: 's2',
      heading: 'Long',
      level: 2,
      blocks: [{ type: 'paragraph', text: longParagraph }],
    };

    expect(estimateSectionReadingMinutes(section)).toBe(3);
  });

  it('counts words across every block type, not just paragraphs', () => {
    const section: DocSection = {
      id: 's3',
      slug: 's3',
      heading: 'Mixed',
      level: 2,
      blocks: [
        { type: 'list', items: ['one two three', 'four five six'] },
        { type: 'specTable', entries: [{ label: 'Height', text: 'at least 157 cm' }] },
        { type: 'table', rows: [['a b c', 'd e f']] },
      ],
    };

    // 6 + 4 + 6 = 16 words -> well under a minute, floors to 1.
    expect(estimateSectionReadingMinutes(section)).toBe(1);
  });
});
