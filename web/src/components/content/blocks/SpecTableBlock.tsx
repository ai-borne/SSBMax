import { FC } from 'react';
import { renderInlineBold } from './inlineBold';
import type { DocBlock, SpecTableBlock as SpecTableBlockType } from './types';

export interface SpecTableBlockProps {
  block: DocBlock;
}

export const SpecTableBlockView: FC<SpecTableBlockProps> = ({ block }) => {
  const entries = (block as SpecTableBlockType).entries ?? [];
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm sm:text-base rounded-lg border border-slate-200 dark:border-slate-800 p-4">
      {entries.map((entry, index) => (
        <div key={index} className="contents">
          <dt className="font-semibold text-slate-900 dark:text-white">{entry.label}</dt>
          <dd className="text-slate-700 dark:text-slate-300">{renderInlineBold(entry.text)}</dd>
        </div>
      ))}
    </dl>
  );
};
