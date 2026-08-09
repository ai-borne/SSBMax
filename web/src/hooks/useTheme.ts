import { useState, useEffect, useCallback } from 'react';
import { ThemeMode } from '../constants/colors';

const STORAGE_KEY = 'theme';

export interface UseThemeReturn {
  theme: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') {
      return saved as ThemeMode;
    }
    return 'system';
  });

  const getSystemTheme = useCallback((): 'dark' | 'light' => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }, []);

  const resolveTheme = useCallback(
    (mode: ThemeMode): 'dark' | 'light' => {
      if (mode === 'system') {
        return getSystemTheme();
      }
      return mode;
    },
    [getSystemTheme]
  );

  const applyTheme = useCallback(
    (mode: ThemeMode) => {
      const root = document.documentElement;
      const effectiveTheme = resolveTheme(mode);
      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    },
    [resolveTheme]
  );

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      localStorage.setItem(STORAGE_KEY, newTheme);
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [theme, applyTheme]);

  return {
    theme,
    resolvedTheme: resolveTheme(theme),
    toggleTheme,
    setTheme
  };
}
