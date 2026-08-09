import { FC } from 'react';
import { Calendar, ChevronDown, Lock } from 'lucide-react';
import { StudyTestCard, SSBTestCardInfo } from './StudyTestCard';
import { StudyMaterial } from '../../types/testContent';

export interface StudyDayAccordionSection {
  dayNumber: '1' | '2' | '3-4' | '5';
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

  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all duration-200"
      data-testid={`study-day-accordion-${section.dayNumber}`}
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
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
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
          className="p-5 pt-2 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 animate-in fade-in duration-200"
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
    </div>
  );
};

export default StudyDayAccordion;
