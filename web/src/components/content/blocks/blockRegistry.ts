import { FC } from 'react';
import { ParagraphBlockView } from './ParagraphBlock';
import { ListBlockView } from './ListBlock';
import { SubheadingBlockView } from './SubheadingBlock';
import { SpecTableBlockView } from './SpecTableBlock';
import { CalloutBlockView } from './CalloutBlock';
import { ComparisonBlockView } from './ComparisonBlock';
import { TimelineBlockView } from './TimelineBlock';
import { TableBlockView } from './TableBlock';
import type { DocBlock } from './types';

export interface BlockRendererProps {
  block: DocBlock;
}

/**
 * type -> renderer. Phase 4 (docs/plans/write-the-phased-plan-wobbly-pancake.md) adds the five
 * rich types on top of Phase 2's structural slice. Any type still not in this map renders via
 * `renderFallback` below (D1: an unrecognised type is never a hard failure) -- that now only
 * covers genuinely-unknown future block types, not the full taxonomy.
 */
export const blockRegistry: Partial<Record<string, FC<BlockRendererProps>>> = {
  paragraph: ParagraphBlockView,
  list: ListBlockView,
  subheading: SubheadingBlockView,
  specTable: SpecTableBlockView,
  callout: CalloutBlockView,
  comparison: ComparisonBlockView,
  timeline: TimelineBlockView,
  table: TableBlockView,
};

/** Best-effort plain-text flattening for a block type with no dedicated renderer yet, so
 * pre-Phase-4 rich content in real corpus files stays readable instead of vanishing. */
function toFallbackText(block: DocBlock): string {
  const b = block as unknown as Record<string, unknown>;
  if (typeof b.text === 'string') return b.text;
  if (Array.isArray(b.items)) return (b.items as string[]).join(' • ');
  if (Array.isArray(b.entries)) return (b.entries as { label: string; text: string }[]).map((e) => `${e.label}: ${e.text}`).join(' — ');
  if (Array.isArray(b.pairs)) return (b.pairs as { label: string; text: string }[]).map((p) => `${p.label}: ${p.text}`).join(' — ');
  if (Array.isArray(b.steps)) return (b.steps as { label: string; text: string }[]).map((s) => `${s.label}: ${s.text}`).join(' — ');
  if (Array.isArray(b.rows)) return (b.rows as string[][]).map((row) => row.join(' | ')).join('; ');
  return '';
}

export function renderBlock(block: DocBlock): { Component: FC<BlockRendererProps>; block: DocBlock } {
  const Component = blockRegistry[block.type];
  if (Component) return { Component, block };
  return { Component: ParagraphBlockView, block: { type: 'paragraph', text: toFallbackText(block) } };
}
