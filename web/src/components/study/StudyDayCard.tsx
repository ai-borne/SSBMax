import { FC } from 'react';
import { Calendar, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';

export interface StudyDayInfo {
  dayNumber: string;
  stageBadge: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  topics: string[];
  isCompleted?: boolean;
}

export interface StudyDayCardProps {
  dayInfo: StudyDayInfo;
  onSelectDay: (dayNumber: string) => void;
}

export const StudyDayCard: FC<StudyDayCardProps> = ({ dayInfo, onSelectDay }) => {
  return (
    <div
      onClick={() => onSelectDay(dayInfo.dayNumber)}
      className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-500/50 rounded-2xl p-5 shadow-md shadow-slate-200/40 dark:shadow-lg flex flex-col justify-between cursor-pointer transition-all group"
      data-testid={`study-day-card-${dayInfo.dayNumber}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
            {dayInfo.stageBadge}
          </span>
          {dayInfo.isCompleted && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Done</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {dayInfo.title}
          </h3>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          {dayInfo.subtitle}
        </p>

        {/* Topics Chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {dayInfo.topics.map((topic) => (
            <span
              key={topic}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5" />
          {dayInfo.estimatedMinutes} min guide
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectDay(dayInfo.dayNumber);
          }}
          className="min-h-[44px] min-w-[44px] px-3 py-2 flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:text-sky-500 group-hover:translate-x-0.5 transition-all"
          data-testid={`explore-day-${dayInfo.dayNumber}`}
        >
          <span>Open Module</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default StudyDayCard;
