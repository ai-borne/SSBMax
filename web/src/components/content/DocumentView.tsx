import { FC } from 'react';
import { strings } from '../../constants/strings';
import { renderBlock } from './blocks/blockRegistry';
import type { DocumentModel } from './blocks/types';

export interface DocumentViewProps {
  model: DocumentModel;
  takeaways?: string[];
}

/**
 * Dispatches a parsed DocumentModel (scripts/content/parseDocument.js output) to typed block
 * renderers via blockRegistry -- the Phase 2 structural slice (docs/plans/
 * write-the-phased-plan-wobbly-pancake.md): sections, TOC, takeaways, `paragraph`, `list`.
 * Sections render expanded by default (D3) -- no `<details>` collapsing here, that's a later
 * per-section affordance, not this component's concern.
 */
export const DocumentView: FC<DocumentViewProps> = ({ model, takeaways }) => {
  const headedSections = model.sections.filter((s) => s.heading);

  return (
    <div data-testid="document-view">
      {takeaways && takeaways.length > 0 && (
        <aside className="mb-8 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            {strings.content.takeawaysHeading}
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </aside>
      )}

      {headedSections.length > 1 && (
        <nav aria-label={strings.content.tocHeading} className="mb-8 text-sm">
          <p className="font-bold text-slate-900 dark:text-white">{strings.content.tocHeading}</p>
          <ul className="mt-2 space-y-1">
            {headedSections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.slug}`} className="text-sky-600 dark:text-sky-400 hover:underline">
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {model.sections.map((section) => (
        <section key={section.id} id={section.slug} className="mb-8">
          {section.heading && <h2 className="text-lg font-bold text-slate-900 dark:text-white">{section.heading}</h2>}
          <div className="mt-3 space-y-4">
            {section.blocks.map((block, index) => {
              const { Component, block: resolvedBlock } = renderBlock(block);
              return <Component key={index} block={resolvedBlock} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default DocumentView;
