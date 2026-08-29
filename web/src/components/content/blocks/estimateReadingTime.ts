import type { DocBlock, DocSection } from './types';

/**
 * Per-section estimated reading time (Phase 7, docs/plans/write-the-phased-plan-wobbly-pancake.md).
 * Word-count based, same 200 words/minute assumption as KMP's `estimatedReadingMinutes`
 * (`shared/.../ui/content/ContentReadingSupport.kt`) -- keep the two in lockstep so the same
 * section shows the same estimate on every platform.
 */
const WORDS_PER_MINUTE = 200;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function blockWordCount(block: DocBlock): number {
  switch (block.type) {
    case 'paragraph':
      return wordCount((block as { text: string }).text);
    case 'list':
      return (block as { items: string[] }).items.reduce((sum, item) => sum + wordCount(item), 0);
    case 'subheading':
      return wordCount((block as { text: string }).text);
    case 'specTable':
      return (block as { entries: { label: string; text: string }[] }).entries.reduce(
        (sum, e) => sum + wordCount(e.label) + wordCount(e.text),
        0
      );
    case 'callout':
      return wordCount((block as { marker: string; text: string }).marker) + wordCount((block as { text: string }).text);
    case 'comparison':
      return (block as { pairs: { label: string; text: string }[] }).pairs.reduce(
        (sum, p) => sum + wordCount(p.label) + wordCount(p.text),
        0
      );
    case 'timeline':
      return (block as { steps: { label: string; text: string }[] }).steps.reduce(
        (sum, s) => sum + wordCount(s.label) + wordCount(s.text),
        0
      );
    case 'table':
      return (block as { rows: string[][] }).rows.reduce(
        (sum, row) => sum + row.reduce((rowSum, cell) => rowSum + wordCount(cell), 0),
        0
      );
    default:
      return 0;
  }
}

export function estimateSectionReadingMinutes(section: DocSection): number {
  const words = section.blocks.reduce((sum, block) => sum + blockWordCount(block), 0) + wordCount(section.heading ?? '');
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
