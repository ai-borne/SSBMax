import { useEffect, useState, useCallback } from 'react';
import { AntiCheatService } from '../services/AntiCheatService';
import { strings } from '../constants/strings';

interface UseAntiCheatProps {
  isActive: boolean;
  onViolationExceeded?: () => void;
  maxViolations?: number;
}

export function useAntiCheat({
  isActive,
  onViolationExceeded,
  maxViolations = 3
}: UseAntiCheatProps) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const handleExceeded = useCallback(() => {
    setWarningMessage(strings.anticheat.autoSubmitted);
    if (onViolationExceeded) {
      onViolationExceeded();
    }
  }, [onViolationExceeded]);

  useEffect(() => {
    if (!isActive) return;

    const antiCheat = new AntiCheatService({
      maxViolations,
      onWarning: (msg) => {
        setWarningMessage(msg);
        setTimeout(() => setWarningMessage(null), 4000);
      },
      onViolationExceeded: handleExceeded
    });

    antiCheat.activate();
    return () => antiCheat.deactivate();
  }, [isActive, maxViolations, handleExceeded]);

  return { warningMessage, setWarningMessage };
}
