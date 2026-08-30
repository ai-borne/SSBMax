import { FC } from 'react';
import { renderInlineBold } from './inlineBold';
import type { DocBlock, ListBlock as ListBlockType } from './types';

export interface ListBlockProps {
  block: DocBlock;
}

export const ListBlockView: FC<ListBlockProps> = ({ block }) => {
  const items = (block as ListBlockType).items ?? [];
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
      {items.map((item, index) => (
        <li key={index}>{renderInlineBold(item)}</li>
      ))}
    </ul>
  );
};
