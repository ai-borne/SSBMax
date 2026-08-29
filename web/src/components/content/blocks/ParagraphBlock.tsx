import { FC } from 'react';
import { renderInlineBold } from './inlineBold';
import type { DocBlock } from './types';

export interface ParagraphBlockProps {
  block: DocBlock;
}

/** Renders `paragraph` blocks, and doubles as the fallback renderer (D1) for any block type this
 * registry doesn't otherwise recognise -- see `toFallbackText` in `blockRegistry.ts`. */
export const ParagraphBlockView: FC<ParagraphBlockProps> = ({ block }) => {
  const text = 'text' in block && typeof block.text === 'string' ? block.text : '';
  return <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">{renderInlineBold(text)}</p>;
};
