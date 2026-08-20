import { FC, FormEvent, useState } from 'react';
import { Search } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useSubscriptionSupportViewModel } from '../../viewmodels/useSubscriptionSupportViewModel';
import { SupportSnapshotPanels } from './SupportSnapshotPanels';

/**
 * Phase 9 (Payment Ecosystem Hardening plan): the one support-view lookup surface. Web-only by
 * design (root CLAUDE.md's SSOT note applies to candidate-facing screens, not internal ops
 * tooling) -- not reachable from the nav bar (see `App.tsx`/`useTabRouting.ts`'s `support` tab,
 * deliberately absent from `navItems`), and the actual access control is server-side in the
 * `getSubscriptionSupportSnapshot` callable via the `admin` custom claim, never this page hiding
 * itself -- a non-admin who finds the URL just sees `strings.support.permissionDenied`.
 */
export const SupportSubscriptionPage: FC = () => {
  const [userIdInput, setUserIdInput] = useState('');
  const { state, lookup } = useSubscriptionSupportViewModel();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    lookup(userIdInput);
  };

  const errorMessage =
    state.status === 'ERROR'
      ? state.code === 'functions/permission-denied'
        ? strings.support.permissionDenied
        : strings.support.genericError
      : null;

  return (
    <div className="max-w-3xl w-full mx-auto px-4 py-8 space-y-6" data-testid="support-subscription-page">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{strings.support.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{strings.support.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="support-userid-input" className="sr-only">
          {strings.support.userIdLabel}
        </label>
        <input
          id="support-userid-input"
          type="text"
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          placeholder={strings.support.userIdPlaceholder}
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
          data-testid="support-userid-input"
        />
        <button
          type="submit"
          disabled={state.status === 'LOADING'}
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-1.5"
          data-testid="support-lookup-button"
        >
          <Search className="w-3.5 h-3.5" />
          {state.status === 'LOADING' ? strings.support.looking : strings.support.lookupButton}
        </button>
      </form>

      {errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400" data-testid="support-error">
          {errorMessage}
        </p>
      )}

      {state.status === 'LOADED' && <SupportSnapshotPanels snapshot={state.snapshot} />}
    </div>
  );
};
