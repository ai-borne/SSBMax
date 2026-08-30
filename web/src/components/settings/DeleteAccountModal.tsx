import { FC, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { strings } from '../../constants/strings';
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from '../../constants/accountDeletion';
import { BaseModal } from '../common/BaseModal';

export interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  error?: string | null;
}

/**
 * Second, explicit confirmation step for account deletion (docs/plans/AccountDeletion.md Phase 3)
 * -- irreversible after the grace period, so a single button on `AccountSection` is not enough.
 * The confirm button stays disabled until the checkbox is ticked.
 */
export const DeleteAccountModal: FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  error = null,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  // `BaseModal` unmounts its own contents while closed but this component stays mounted (the
  // parent renders it unconditionally so isOpen can flip), so the checkbox must be reset here --
  // otherwise a close-then-reopen would leave the irreversibility guard already satisfied.
  // Adjusted during render (React's "adjusting state when a prop changes" pattern) rather than
  // in an effect, since it's purely derived from the isOpen transition.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setAcknowledged(false);
  }

  const days = String(ACCOUNT_DELETION_GRACE_PERIOD_DAYS);
  const body = strings.account.deleteAccountConfirmBody.replace('{days}', days);
  const checkboxLabel = strings.account.deleteAccountConfirmCheckbox.replace('{days}', days);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={strings.account.deleteAccountConfirmTitle}
      testId="delete-account-modal"
      ariaLabelledBy="delete-account-modal-title"
    >
      <div className="space-y-4 text-sm">
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{body}</p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer" data-testid="delete-account-ack-checkbox">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-rose-600"
          />
          <span className="text-slate-700 dark:text-slate-300 text-xs">{checkboxLabel}</span>
        </label>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400" data-testid="delete-account-error">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all"
            data-testid="delete-account-cancel-btn"
          >
            {strings.account.deleteAccountCancelButton}
          </button>
          <button
            onClick={onConfirm}
            disabled={!acknowledged || isSubmitting}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-all"
            data-testid="delete-account-confirm-btn"
          >
            {strings.account.deleteAccountConfirmButton}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default DeleteAccountModal;
