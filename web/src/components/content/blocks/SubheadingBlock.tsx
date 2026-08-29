import { FC } from 'react';
import type { DocBlock, SubheadingBlock as SubheadingBlockType } from './types';

export interface SubheadingBlockProps {
  block: DocBlock;
}

/** `level` is the raw markdown heading depth (1, 3-6 -- section-starting `##` never reaches
 * here, see content/SCHEMA.md); clamped to h2-h6 for valid, still-nested HTML output. */
export const SubheadingBlockView: FC<SubheadingBlockProps> = ({ block }) => {
  const { level, text } = block as SubheadingBlockType;
  const Tag = (`h${Math.min(6, Math.max(2, level))}` as unknown) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return <Tag className="mt-4 font-semibold text-slate-900 dark:text-white">{text}</Tag>;
};
