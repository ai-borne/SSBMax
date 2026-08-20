import { FC } from 'react';
import { strings } from '../../../constants/strings';

export interface ResponseInputViewProps {
  options?: string[];
  selectedOption?: string;
  presetChips?: string[];
  textResponse?: string;
  onSelectOption?: (option: string) => void;
  onTextChange?: (text: string) => void;
}

export const ResponseInputView: FC<ResponseInputViewProps> = ({
  options = [],
  selectedOption = '',
  presetChips = [],
  textResponse = '',
  onSelectOption,
  onTextChange
}) => {
  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full space-y-4"
      data-testid="response-input-view"
    >
      {options.length > 0 ? (
        <div className="space-y-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            {strings.testRunner.response.selectOptionLabel}
          </label>
          {options.map((opt, idx) => {
            const isSelected = selectedOption === opt;
            return (
              <button
                key={opt}
                onClick={() => onSelectOption?.(opt)}
                className={`w-full min-h-[44px] px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold text-left transition-all flex items-center gap-3 border ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20 ring-2 ring-sky-500/40'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid={`option-item-${idx}`}
              >
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 border ${
                  isSelected ? 'bg-white text-sky-600 border-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 flex-1 flex flex-col">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            {strings.testRunner.response.writeResponseLabel}
          </label>

          {/* 1-Tap Preset Action Chips */}
          {presetChips.length > 0 && (
            <div className="space-y-1.5 mb-2">
              <span className="text-[11px] font-semibold text-slate-400">{strings.testRunner.response.presetChipsLabel}</span>
              <div className="flex flex-wrap gap-1.5">
                {presetChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onTextChange?.(chip)}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 text-left transition-colors"
                    data-testid={`preset-chip-${idx}`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={textResponse}
            onChange={(e) => onTextChange?.(e.target.value)}
            placeholder={strings.testRunner.response.textareaPlaceholder}
            className="w-full flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 resize-none min-h-[120px]"
            data-testid="response-textarea"
          />
        </div>
      )}
    </div>
  );
};

export default ResponseInputView;
