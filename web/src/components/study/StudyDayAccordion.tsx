import { FC } from 'react';
import { Calendar, ChevronDown, Lock } from 'lucide-react';
import { StudyTestCard, SSBTestCardInfo } from './StudyTestCard';
import { StudyMaterial } from '../../types/testContent';
import { SSBDayNumber } from '../../constants/ssbSelectionProcess';
import { GridCardContainer } from '../common/GridCardContainer';
import { CardGridVariant } from '../../constants/cardTokens';

export interface StudyDayAccordionSection {
  dayNumber: SSBDayNumber;
  stageBadge: string;
  title: string;
  subtitle: string;
  testCards: SSBTestCardInfo[];
}

export interface StudyDayAccordionProps {
  section: StudyDayAccordionSection;
  isOpen: boolean;
  isUnlocked: boolean;
  onToggle: (dayNumber: string) => void;
  onCardClick: (testTypeId: string) => void;
  onSelectMaterial: (material: StudyMaterial) => void;
  isMaterialCompleted: (materialId: string) => boolean;
  onToggleCompleted: (materialId: string, e: React.MouseEvent) => void;
}

// Pure day-accent colour mapper — returns Tailwind token classes per SSB day.
// Intentionally co-located with the component that owns it (no shared utility).
// Extract to src/utils/dayAccent.ts only if a 3rd accordion is added in future.
function getDayAccentClasses(dayNumber: SSBDayNumber): {
  border: string;
  icon: string;
  badge: string;
} {
  const map: Record<SSBDayNumber, { border: string; icon: string; badge: string }> = {
    '1':   { border: 'border-l-day1',  icon: 'bg-day1/10 text-day1 border-day1/20',   badge: 'bg-day1/10 text-day1 border-day1/30'   },
    '2':   { border: 'border-l-day2',  icon: 'bg-day2/10 text-day2 border-day2/20',   badge: 'bg-day2/10 text-day2 border-day2/30'   },
    '3-4': { border: 'border-l-day34', icon: 'bg-day34/10 text-day34 border-day34/20', badge: 'bg-day34/10 text-day34 border-day34/30' },
    '5':   { border: 'border-l-day5',  icon: 'bg-day5/10 text-day5 border-day5/20',   badge: 'bg-day5/10 text-day5 border-day5/30'   },
  };
  return map[dayNumber] ?? map['1'];
}

export const StudyDayAccordion: FC<StudyDayAccordionProps> = ({
  section,
  isOpen,
  isUnlocked,
  onToggle,
  onCardClick,
  onSelectMaterial,
  isMaterialCompleted,
  onToggleCompleted,
}) => {
  const contentId = `day-accordion-content-${section.dayNumber}`;
  const accent = getDayAccentClasses(section.dayNumber);

  const dayVariantMap: Record<SSBDayNumber, CardGridVariant> = {
    '1': 'day1',
    '2': 'day2',
    '3-4': 'day34',
    '5': 'day5',
  };
  const variant = dayVariantMap[section.dayNumber] ?? 'day1';

  return (
    <GridCardContainer
      variant={variant}
      dense
      testId={`study-day-accordion-${section.dayNumber}`}
      className={`border-l-4 ${accent.border}`}
    >
      {/* Header Button */}
      <button
        onClick={() => onToggle(section.dayNumber)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50 min-h-[56px]"
        data-testid={`toggle-accordion-btn-${section.dayNumber}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border flex-shrink-0 ${accent.icon}`}>
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${accent.badge}`}>
                {section.stageBadge}
              </span>
              {!isUnlocked && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  <Lock className="w-3 h-3" />
                  <span>Google OAuth Required</span>
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {section.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5 hidden sm:block">
              {section.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden md:inline">
            {section.testCards.length} Modules
          </span>
          <div
            className={`p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-sky-600 dark:text-sky-400' : ''
            }`}
          >
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </button>

      {/* Accordion Content Panel */}
      {isOpen && (
        <div
          id={contentId}
          className="p-5 pt-2 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 animate-fade-slide-in"
          data-testid={`accordion-panel-${section.dayNumber}`}
        >
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4 sm:hidden">
            {section.subtitle}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {section.testCards.map((cardInfo) => (
              <StudyTestCard
                key={cardInfo.testTypeId}
                cardInfo={cardInfo}
                isUnlocked={isUnlocked}
                onCardClick={onCardClick}
                onSelectMaterial={onSelectMaterial}
                isMaterialCompleted={isMaterialCompleted}
                onToggleCompleted={onToggleCompleted}
              />
            ))}
          </div>
        </div>
      )}
    </GridCardContainer>
  );
};

export default StudyDayAccordion;
