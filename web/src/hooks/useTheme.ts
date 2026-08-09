import { useState, useEffect, useCallback } from 'react';
import { ThemeMode } from '../constants/colors';

const STORAGE_KEY = 'theme';
const THEME_CHANGE_EVENT = 'ssbmax-theme-change';

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
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newTheme);
        window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: newTheme }));
      }
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);

    if (typeof window === 'undefined') return;

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail && customEvent.detail !== theme) {
        setThemeState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const val = e.newValue as ThemeMode;
        if (val === 'dark' || val === 'light' || val === 'system') {
          setThemeState(val);
        }
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    let mediaQueryCleanup: (() => void) | undefined;
    if (theme === 'system' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => applyTheme('system');
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
        mediaQueryCleanup = () => mediaQuery.removeEventListener('change', handleMediaChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleMediaChange);
        mediaQueryCleanup = () => mediaQuery.removeListener(handleMediaChange);
      }
    }

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
      if (mediaQueryCleanup) mediaQueryCleanup();
    };
  }, [theme, applyTheme]);

  return {
    theme,
    resolvedTheme: resolveTheme(theme),
    toggleTheme,
    setTheme
  };
}
