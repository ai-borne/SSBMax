import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AntiCheatWarningBannerProps {
  message: string | null;
}

export const AntiCheatWarningBanner: React.FC<AntiCheatWarningBannerProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="p-3 bg-amber-950/80 border border-amber-500/60 rounded-xl text-amber-200 text-xs font-semibold flex items-center shadow-lg my-2 transition-all">
      <ShieldAlert className="w-4 h-4 text-amber-400 mr-2 shrink-0 animate-bounce" />
      <span>{message}</span>
    </div>
  );
};
