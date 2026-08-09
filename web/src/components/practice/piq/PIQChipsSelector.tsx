import { FC } from 'react';

export interface PIQChipsSelectorProps {
  label: string;
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
  testId?: string;
}

export const PIQChipsSelector: FC<PIQChipsSelectorProps> = ({
  label,
  options,
  selectedOption,
  onSelect,
  testId = 'piq-chips-selector'
}) => {
  return (
    <div className="space-y-2" data-testid={testId}>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selectedOption.toLowerCase() === option.toLowerCase();
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isSelected
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              data-testid={`chip-option-${option.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PIQChipsSelector;
