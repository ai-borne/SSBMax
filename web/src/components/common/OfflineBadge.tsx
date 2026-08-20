import { FC } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { strings } from '../../constants/strings';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export interface OfflineBadgeProps {
  isOnline?: boolean;
  className?: string;
  showOnlineStatus?: boolean;
}

export const OfflineBadge: FC<OfflineBadgeProps> = ({
  isOnline: propIsOnline,
  className = '',
  showOnlineStatus = true
}) => {
  const onlineState = useOnlineStatus();
  const isOnline = propIsOnline !== undefined ? propIsOnline : onlineState;

  if (isOnline && !showOnlineStatus) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
        isOnline
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
      } ${className}`}
      data-testid="offline-badge"
    >
      {isOnline ? (
        <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      )}
      <span>{isOnline ? strings.header.statusOnline : strings.header.statusOffline}</span>
    </div>
  );
};

export default OfflineBadge;
