import { FC } from 'react';
import { ParagraphBlockView } from './ParagraphBlock';
import { ListBlockView } from './ListBlock';
import { SubheadingBlockView } from './SubheadingBlock';
import type { DocBlock } from './types';

export interface BlockRendererProps {
  block: DocBlock;
}

/**
 * type -> renderer. Phase 2 (docs/plans/write-the-phased-plan-wobbly-pancake.md) implements the
 * structural blocks only; `specTable`/`callout`/`comparison`/`timeline`/`table` land in Phase 4.
 * Any type not in this map -- including those five, today -- renders via `renderFallback` (D1:
 * an unrecognised type is never a hard failure). The parity-gate coverage test
 * (blockRegistry.parity.test.ts) walks content/__fixtures__/blocks.json and only requires that
 * *some* renderer runs per fixture type, matching that intentional Phase 2 scope.
 */
export const blockRegistry: Partial<Record<string, FC<BlockRendererProps>>> = {
  paragraph: ParagraphBlockView,
  list: ListBlockView,
  subheading: SubheadingBlockView,
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
