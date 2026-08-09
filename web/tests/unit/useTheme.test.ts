import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../src/hooks/useTheme';
import { themeColors } from '../../src/constants/colors';

describe('useTheme hook - Advanced System & Mode Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should enforce distinct 4-level dark mode elevation system tokens', () => {
    expect(themeColors.dark.bgPrimary).toBe('#0b0f19'); // Level 0
    expect(themeColors.dark.bgSecondary).toBe('#0f172a'); // Level 1
    expect(themeColors.dark.bgCard).toBe('#1e293b'); // Level 2
    expect(themeColors.dark.bgElevated).toBe('#334155'); // Level 3

    const darkElevations = new Set([
      themeColors.dark.bgPrimary,
      themeColors.dark.bgSecondary,
      themeColors.dark.bgCard,
      themeColors.dark.bgElevated
    ]);
    expect(darkElevations.size).toBe(4);
  });

  it('should support system theme mode and resolve based on matchMedia', () => {
    // Mock matchMedia for dark preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should resolve light system theme mode when prefers-color-scheme is light', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('system');
    });

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should cycle through light, dark, and system modes on toggle', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('system');
  });

  it('should synchronize theme changes across multiple hook instances', () => {
    const { result: hookA } = renderHook(() => useTheme());
    const { result: hookB } = renderHook(() => useTheme());

    act(() => {
      hookA.current.setTheme('dark');
    });

    expect(hookA.current.theme).toBe('dark');
    expect(hookB.current.theme).toBe('dark');
  });
});
