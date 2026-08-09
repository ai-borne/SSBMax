import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseTestTimerOptions {
  initialSeconds: number;
  autoStart?: boolean;
  onTick?: (secondsRemaining: number) => void;
  onComplete?: () => void;
}

export interface UseTestTimerReturn {
  timeRemaining: number;
  formattedTime: string;
  isRunning: boolean;
  isPaused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: (newSeconds?: number) => void;
  setTime: (seconds: number) => void;
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${pad(hrs)}:${pad(remMins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function useTestTimer(options: UseTestTimerOptions): UseTestTimerReturn {
  const { initialSeconds, autoStart = false, onTick, onComplete } = options;
  const [timeRemaining, setTimeRemaining] = useState<number>(initialSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onTickRef.current = onTick;
    onCompleteRef.current = onComplete;
  }, [onTick, onComplete]);

  const start = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    setIsRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (timeRemaining > 0) {
      setIsPaused(false);
      setIsRunning(true);
    }
  }, [timeRemaining]);

  const reset = useCallback((newSeconds?: number) => {
    const targetSeconds = typeof newSeconds === 'number' ? newSeconds : initialSeconds;
    setTimeRemaining(targetSeconds);
    setIsRunning(autoStart);
    setIsPaused(false);
  }, [initialSeconds, autoStart]);

  const setTime = useCallback((seconds: number) => {
    setTimeRemaining(seconds);
  }, []);

  useEffect(() => {
    if (!isRunning || isPaused) return;

    const timerId = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          setIsRunning(false);
          if (onCompleteRef.current) {
            onCompleteRef.current();
          }
          return 0;
        }
        const next = prev - 1;
        if (onTickRef.current) {
          onTickRef.current(next);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [isRunning, isPaused]);

  return {
    timeRemaining,
    formattedTime: formatSeconds(timeRemaining),
    isRunning,
    isPaused,
    start,
    pause,
    resume,
    reset,
    setTime
  };
}
