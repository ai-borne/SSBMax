/**
 * DocumentModel types (docs/plans/write-the-phased-plan-wobbly-pancake.md Phase 2), mirroring
 * the shape scripts/content/parseDocument.js emits (see content/SCHEMA.md). `type` is a plain
 * string, not a union of literals only (D1) -- an unrecognised type must fall back to
 * `paragraph` at render time rather than fail to type-check or throw.
 */
export interface DocBlockBase {
  type: string;
}

export interface ParagraphBlock extends DocBlockBase {
  type: 'paragraph';
  text: string;
}

export interface ListBlock extends DocBlockBase {
  type: 'list';
  items: string[];
}

export interface SubheadingBlock extends DocBlockBase {
  type: 'subheading';
  level: number;
  text: string;
}

export interface SpecTableBlock extends DocBlockBase {
  type: 'specTable';
  entries: { label: string; text: string }[];
}

export interface CalloutBlock extends DocBlockBase {
  type: 'callout';
  marker: string;
  text: string;
}

export interface ComparisonBlock extends DocBlockBase {
  type: 'comparison';
  pairs: { label: string; text: string }[];
}

export interface TimelineBlock extends DocBlockBase {
  type: 'timeline';
  steps: { label: string; text: string }[];
}

export interface TableBlock extends DocBlockBase {
  type: 'table';
  rows: string[][];
}

export type DocBlock =
  | ParagraphBlock
  | ListBlock
  | SubheadingBlock
  | SpecTableBlock
  | CalloutBlock
  | ComparisonBlock
  | TimelineBlock
  | TableBlock
  | DocBlockBase;

export interface DocSection {
  id: string;
  slug: string;
  heading: string | null;
  level: number;
  blocks: DocBlock[];
}

export interface DocumentModel {
  sections: DocSection[];
}
