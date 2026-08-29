import { FC } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { strings } from '../../constants/strings';
import { renderBlock } from './blocks/blockRegistry';
import { estimateSectionReadingMinutes } from './blocks/estimateReadingTime';
import type { DocumentModel } from './blocks/types';

export interface DocumentViewProps {
  model: DocumentModel;
  takeaways?: string[];
  /** Phase 7 reading affordances -- all optional so callers that don't pass them (the public
   * prerendered path, `prerenderHtml.mjs`) render byte-identical to before this phase. */
  readSectionIds?: Set<string>;
  onToggleSectionRead?: (sectionId: string) => void;
  practiceTestTypeId?: string;
  onPracticeClick?: (testTypeId: string) => void;
}

/**
 * Dispatches a parsed DocumentModel (scripts/content/parseDocument.js output) to typed block
 * renderers via blockRegistry -- the Phase 2 structural slice (docs/plans/
 * write-the-phased-plan-wobbly-pancake.md): sections, TOC, takeaways, `paragraph`, `list`.
 * Sections render expanded by default (D3) -- no `<details>` collapsing here, that's a later
 * per-section affordance, not this component's concern.
 *
 * Each section is its own bordered/tinted panel -- the plan's "Readability devices" table
 * calls this out explicitly ("Section chunking -- one panel per ##"), matching KMP's
 * `SectionCard` (`DocumentView.kt`). Before this, only `TakeawaysCard`/`CalloutBlock` had panel
 * styling; a bare `mb-8` on `<section>` read as one continuous wall of text once a real
 * multi-section document (not just the Phase 2 pilot) reached this component. Keep this in
 * lockstep with `prerenderHtml.mjs`'s `buildDocumentHtml` (its static-HTML twin) or the
 * prerendered and hydrated views will visibly diverge.
 */
export const DocumentView: FC<DocumentViewProps> = ({
  model,
  takeaways,
  readSectionIds,
  onToggleSectionRead,
  practiceTestTypeId,
  onPracticeClick,
}) => {
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
        <section
          key={section.id}
          id={section.slug}
          className="mb-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              {section.heading && <h2 className="text-lg font-bold text-slate-900 dark:text-white">{section.heading}</h2>}
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {estimateSectionReadingMinutes(section)} {strings.content.estimatedMinutesSuffix}
              </p>
            </div>
            {onToggleSectionRead && (
              <button
                type="button"
                onClick={() => onToggleSectionRead(section.id)}
                aria-label={readSectionIds?.has(section.id) ? strings.content.sectionReadCd : strings.content.markSectionReadCd}
                data-testid={`section-read-toggle-${section.id}`}
                className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
              >
                {readSectionIds?.has(section.id) ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
          <div className="mt-3 space-y-4">
            {section.blocks.map((block, index) => {
              const { Component, block: resolvedBlock } = renderBlock(block);
              return <Component key={index} block={resolvedBlock} />;
            })}
          </div>
          {practiceTestTypeId && onPracticeClick && (
            <button
              type="button"
              onClick={() => onPracticeClick(practiceTestTypeId)}
              data-testid={`section-practice-cta-${section.id}`}
              className="mt-4 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-colors min-h-[44px]"
            >
              {strings.content.practiceNowCta}
            </button>
          )}
        </section>
      ))}
    </div>
  );
};

export default DocumentView;
