import { FC } from 'react';
import { renderInlineBold } from './inlineBold';
import type { ComparisonBlock as ComparisonBlockType, DocBlock } from './types';

export interface ComparisonBlockProps {
  block: DocBlock;
}

/** Covers Wrong/Right, Myth N/Reality, and Problem/Solution pairs (content/SCHEMA.md) -- the
 * first label of each pair decides the tone (red for Wrong/Myth N/Problem, green otherwise). */
const isNegativeLabel = (label: string) => /^(wrong|myth|problem|negative)/i.test(label);

export const ComparisonBlockView: FC<ComparisonBlockProps> = ({ block }) => {
  const pairs = (block as ComparisonBlockType).pairs ?? [];
  return (
    <div className="space-y-2">
      {pairs.map((pair, index) => {
        const negative = isNegativeLabel(pair.label);
        const tint = negative
          ? 'border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30'
          : 'border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30';
        return (
          <div key={index} className={`rounded-lg border p-3 ${tint}`}>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {negative ? '✗' : '✓'} {pair.label}:
            </span>{' '}
            <span className="text-sm sm:text-base text-slate-700 dark:text-slate-300">{renderInlineBold(pair.text)}</span>
          </div>
        );
      })}
    </div>
  );
};
