import { FC } from 'react';
import { Layers, X, Check, ArrowRight } from 'lucide-react';
import { TestBatchInfo } from '../../types/testContent';
import { strings } from '../../constants/strings';
import { GridCardContainer } from '../common/GridCardContainer';

export interface BatchSelectorModalProps {
  isOpen: boolean;
  moduleTitle: string;
  batches: TestBatchInfo[];
  selectedBatchId: string;
  onSelectBatch: (batchId: string) => void;
  onClose: () => void;
}

export const BatchSelectorModal: FC<BatchSelectorModalProps> = ({
  isOpen,
  moduleTitle,
  batches,
  selectedBatchId,
  onSelectBatch,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-selector-title"
      data-testid="batch-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <GridCardContainer
        variant="glass"
        className="w-full max-w-lg p-6 relative overflow-hidden shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                {moduleTitle}
              </span>
              <h3 id="batch-selector-title" className="text-lg font-black text-slate-900 dark:text-white">
                {strings.practice.selectBatchTitle}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close batch selector"
            data-testid="close-batch-modal-button"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {strings.practice.selectBatchSubtitle}
        </p>

        {/* 1-Tap Touch Target Selection Chips */}
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {batches.map((batch) => {
            const isSelected = batch.id === selectedBatchId;
            return (
              <button
                key={batch.id}
                onClick={() => {
                  onSelectBatch(batch.id);
                  onClose();
                }}
                data-testid={`batch-chip-${batch.id}`}
                className={`w-full min-h-[52px] p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
                  isSelected
                    ? 'bg-sky-500/10 text-sky-900 dark:text-sky-100 border-sky-500/50 ring-1 ring-sky-500/40 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                  </div>
                  <span className="text-xs font-semibold">{batch.name}</span>
                </div>

                {batch.itemCount !== undefined && (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-medium bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                    {batch.itemCount} items
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            data-testid="cancel-batch-modal-button"
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {strings.common.cancel}
          </button>
          <button
            onClick={onClose}
            data-testid="confirm-batch-modal-button"
            className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>{strings.practice.confirmSelect}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </GridCardContainer>
    </div>
  );
};

export default BatchSelectorModal;
