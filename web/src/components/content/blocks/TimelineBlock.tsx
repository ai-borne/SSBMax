import { FC } from 'react';
import { renderInlineBold } from './inlineBold';
import type { DocBlock, TimelineBlock as TimelineBlockType } from './types';

export interface TimelineBlockProps {
  block: DocBlock;
}

export const TimelineBlockView: FC<TimelineBlockProps> = ({ block }) => {
  const steps = (block as TimelineBlockType).steps ?? [];
  return (
    <ol className="relative border-l border-slate-300 dark:border-slate-700 pl-4 space-y-4">
      {steps.map((step, index) => (
        <li key={index} className="relative">
          <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">{step.label}</p>
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300">{renderInlineBold(step.text)}</p>
        </li>
      ))}
    </ol>
  );
};
