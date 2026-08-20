import { FC } from 'react';
import { ArrowRight, Shield, FileText, Brain, Mic } from 'lucide-react';
import { strings } from '../../constants/strings';
import { SSB_5_DAY_TIMELINE, SSBDayNumber } from '../../constants/ssbSelectionProcess';

export interface TestGridSectionProps {
  onExploreTestsClick: () => void;
}

const DAY_ICON: Record<SSBDayNumber, typeof Shield> = {
  '1': Shield,
  '2': Brain,
  '3-4': FileText,
  '5': Mic,
};

/**
 * Teaser only -- the real, functional test launcher (batches, eligibility gating, PIQ wizard)
 * lives once on PracticeTestsPage (SSB Tests tab). This section used to render its own "Launch
 * Test" grid, which duplicated that surface without any of its eligibility checks. Card copy is
 * derived from SSB_5_DAY_TIMELINE (the same source PracticeTestsPage's day accordions read) so
 * this teaser can't drift from the real test catalog -- it never hand-lists test names itself.
 */
export const TestGridSection: FC<TestGridSectionProps> = ({ onExploreTestsClick }) => {
  return (
    <section className="w-full py-12 px-4 my-8" data-testid="test-grid-section">
      <div className="max-w-6xl mx-auto flex flex-col items-center">
        {/* Section Header */}
        <div className="text-center max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-bold uppercase tracking-wider mb-4">
            <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{strings.landing.gridBadge}</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
            {strings.landing.featureTitle}
          </h2>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
            {strings.landing.featureSubtitle}
          </p>
        </div>

        {/* Stage Overview (non-interactive teaser -- launching happens on the SSB Tests tab) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-10">
          {SSB_5_DAY_TIMELINE.map((day) => {
            const Icon = DAY_ICON[day.dayNumber];
            return (
              <div
                key={day.dayNumber}
                className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md"
                data-testid={`grid-stage-day-${day.dayNumber}`}
              >
                <div className="p-2.5 w-fit rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{day.stageBadge}</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{day.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{day.subtitle}</p>
              </div>
            );
          })}
        </div>

        {/* Single funnel CTA into the real, functional test launcher */}
        <div className="text-center space-y-3">
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl mx-auto">
            {strings.landing.gridCtaSubtitle}
          </p>
          <button
            onClick={onExploreTestsClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-sky-600/20 transition-all"
            data-testid="grid-cta-button"
          >
            <span>{strings.landing.gridCtaButton}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
