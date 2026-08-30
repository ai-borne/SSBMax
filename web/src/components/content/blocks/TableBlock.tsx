import { FC } from 'react';
import { renderInlineBold } from './inlineBold';
import type { DocBlock, TableBlock as TableBlockType } from './types';

export interface TableBlockProps {
  block: DocBlock;
}

/** `rows[0]` is always the header row (content/SCHEMA.md: parsed from a pipe table's header +
 * `|---|---|` separator). Wrapped in `overflow-x-auto` per root CLAUDE.md's responsive rule --
 * these tables come from real content and are not guaranteed to fit 320px. */
export const TableBlockView: FC<TableBlockProps> = ({ block }) => {
  const rows = (block as TableBlockType).rows ?? [];
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm sm:text-base border border-slate-200 dark:border-slate-800">
        {header && (
          <thead className="bg-slate-100 dark:bg-slate-900">
            <tr>
              {header.map((cell, index) => (
                <th key={index} className="p-2 text-left font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800">
                  {renderInlineBold(cell)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, rIndex) => (
            <tr key={rIndex} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-950 dark:even:bg-slate-900">
              {row.map((cell, cIndex) => (
                <td key={cIndex} className="p-2 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  {renderInlineBold(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
