import { FC, useState } from 'react';
import { ChevronDown, Calendar, Layers } from 'lucide-react';
import { SSBDayOverview, AccessTier } from '../../constants/ssbSelectionProcess';
import { getTestConfigsForDay } from './ssbTestConfigs';
import { TestSimulatorCard } from './TestSimulatorCard';

export interface TestDayAccordionProps {
  dayOverview: SSBDayOverview;
  userTier?: AccessTier;
  defaultExpanded?: boolean;
  searchQuery?: string;
  onStartTest: (testId: string) => void;
  onUnlockTier?: (tier: AccessTier) => void;
}

export const TestDayAccordion: FC<TestDayAccordionProps> = ({
  dayOverview,
  userTier = 'cadet',
  defaultExpanded = true,
  searchQuery,
  onStartTest,
  onUnlockTier,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const allTests = getTestConfigsForDay(dayOverview.dayNumber);

  const tests = searchQuery
    ? allTests.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.shortCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allTests;

  if (searchQuery && tests.length === 0) {
    return null;
  }

  const activeExpanded = searchQuery ? true : isExpanded;

  const toggleAccordion = () => {
    setIsExpanded((prev) => !prev);
  };

  const contentId = `day-content-${dayOverview.dayNumber}`;
  const headerId = `day-header-${dayOverview.dayNumber}`;

  return (
    <div
      data-testid={`test-day-accordion-${dayOverview.dayNumber}`}
      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all duration-200"
    >
      {/* Accessible Accordion Header Button */}
      <button
        id={headerId}
        onClick={toggleAccordion}
        aria-expanded={activeExpanded}
        aria-controls={contentId}
        data-testid={`accordion-toggle-${dayOverview.dayNumber}`}
        className="w-full min-h-[56px] px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 font-black text-sm">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                {dayOverview.stageBadge}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Layers className="w-3 h-3" />
                {dayOverview.testCount} Tests
              </span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {dayOverview.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
              activeExpanded ? 'rotate-180 bg-sky-500/10 text-sky-600 dark:text-sky-400' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Accordion Content Region */}
      {activeExpanded && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          data-testid={`accordion-content-${dayOverview.dayNumber}`}
          className="p-6 pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-4 animate-in fade-in duration-200"
        >
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {dayOverview.subtitle}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {tests.map((test) => (
              <TestSimulatorCard
                key={test.id}
                test={test}
                userTier={userTier}
                onLaunch={onStartTest}
                onUnlockTier={onUnlockTier}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestDayAccordion;
