import { FC } from 'react';

export interface StimulusViewProps {
  questionNumber: number;
  questionText: string;
  imageUrl?: string;
  stimulusType?: 'VERBAL' | 'NON_VERBAL' | 'IMAGE' | 'WORD';
}

export const StimulusView: FC<StimulusViewProps> = ({
  questionNumber,
  questionText,
  imageUrl,
  stimulusType = 'VERBAL'
}) => {
  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full"
      data-testid="stimulus-view"
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            Q{questionNumber}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {stimulusType} STIMULUS
          </span>
        </div>

        {imageUrl && (
          <div className="mb-4 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-64 border border-slate-800">
            <img src={imageUrl} alt={`Question ${questionNumber} stimulus`} className="object-contain max-h-64 w-auto" />
          </div>
        )}

        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
          {questionText}
        </h2>
      </div>
    </div>
  );
};

export default StimulusView;
