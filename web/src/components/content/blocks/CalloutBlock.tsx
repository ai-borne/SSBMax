import { FC } from 'react';
import { renderInlineBold } from './inlineBold';
import type { CalloutBlock as CalloutBlockType, DocBlock } from './types';

export interface CalloutBlockProps {
  block: DocBlock;
}

/** `**Warning**` gets an amber tint; every other marker (Remember/Key Insight/Tip/Note) shares
 * the sky tint used elsewhere in this renderer -- there is no per-marker design spec beyond
 * "warnings read as warnings". */
export const CalloutBlockView: FC<CalloutBlockProps> = ({ block }) => {
  const { marker, text } = block as CalloutBlockType;
  const isWarning = marker.toLowerCase() === 'warning';
  const tint = isWarning
    ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
    : 'border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300';
  return (
    <aside className={`rounded-lg border p-4 ${tint}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{marker}</p>
      <p className="mt-1 text-sm sm:text-base text-slate-700 dark:text-slate-300">{renderInlineBold(text)}</p>
    </aside>
  );
};
