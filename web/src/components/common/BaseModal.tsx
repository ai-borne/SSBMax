import { FC, ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export const BaseModal: FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  testId = 'base-modal',
  ariaLabelledBy = 'modal-title',
  ariaDescribedBy
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    modalRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      data-testid={testId}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl dark:shadow-slate-950/80 overflow-hidden focus:outline-none animate-in zoom-in-95 duration-200"
      >
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/60">
          <h2 id={ariaLabelledBy} className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={strings.common.close}
            className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            data-testid="modal-close-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

export default BaseModal;
