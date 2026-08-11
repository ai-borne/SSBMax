import { FC } from 'react';
import { strings } from '../../constants/strings';

/**
 * Phase 8 (Cross-Platform SSOT plan) remote kill-switch blocking state --
 * rendered by App.tsx in place of the normal app shell whenever
 * `useAppVersionGateViewModel` reports this build below the live floor.
 * No retry/dismiss action: web ships in minutes, so the fix is a page
 * refresh, not a client-side action.
 */
export const UpdateRequiredScreen: FC = () => (
  <div role="alert" aria-live="assertive" className="flex min-h-screen items-center justify-center p-6 bg-bgPrimary">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-xl font-semibold text-textPrimary">{strings.updateRequired.title}</h1>
      <p className="text-sm text-textSecondary">{strings.updateRequired.body}</p>
    </div>
  </div>
);

export default UpdateRequiredScreen;
