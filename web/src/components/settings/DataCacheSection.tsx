import { FC, useState } from 'react';
import { Database, HardDrive, CheckCircle2 } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface DataCacheSectionProps {
  onClearCache?: () => void;
}

export const DataCacheSection: FC<DataCacheSectionProps> = ({ onClearCache }) => {
  const [cacheClearedStatus, setCacheClearedStatus] = useState(false);

  const handleClearCache = () => {
    if (onClearCache) {
      onClearCache();
    } else {
      localStorage.clear();
    }
    setCacheClearedStatus(true);
    setTimeout(() => setCacheClearedStatus(false), 3000);
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{strings.settings.dataStorageTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{strings.settings.dataStorageSub}</p>
        </div>
        <button
          onClick={handleClearCache}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-2"
          data-testid="clear-cache-button"
        >
          <HardDrive className="w-4 h-4" />
          <span>{strings.settings.clearCache}</span>
        </button>
      </div>
      {cacheClearedStatus && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2" data-testid="cache-cleared-banner">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{strings.settings.cacheCleared}</span>
        </div>
      )}
    </div>
  );
};

export default DataCacheSection;
