import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestTimer, formatSeconds } from '../../src/hooks/useTestTimer';

describe('useTestTimer Hook TDD Unit Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should format seconds into MM:SS format correctly', () => {
    expect(formatSeconds(0)).toBe('00:00');
    expect(formatSeconds(65)).toBe('01:05');
    expect(formatSeconds(3600)).toBe('01:00:00');
  });

  it('should initialize with given time remaining and not start if autoStart is false', () => {
    const { result } = renderHook(() =>
      useTestTimer({ initialSeconds: 300, autoStart: false })
    );

    expect(result.current.timeRemaining).toBe(300);
    expect(result.current.formattedTime).toBe('05:00');
    expect(result.current.isRunning).toBe(false);
  });

  it('should countdown seconds when autoStart is true', () => {
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useTestTimer({ initialSeconds: 10, autoStart: true, onTick })
    );

    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.timeRemaining).toBe(7);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('should call onComplete and stop when time hits 0', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTestTimer({ initialSeconds: 3, autoStart: true, onComplete })
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.timeRemaining).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should handle pause, resume, and reset correctly', () => {
    const { result } = renderHook(() =>
      useTestTimer({ initialSeconds: 60, autoStart: true })
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.timeRemaining).toBe(50);

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPaused).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.timeRemaining).toBe(50); // timer was paused

    act(() => {
      result.current.resume();
    });
    expect(result.current.isPaused).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.timeRemaining).toBe(45);

    act(() => {
      result.current.reset(120);
    });
    expect(result.current.timeRemaining).toBe(120);
  });
});
