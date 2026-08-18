/**
 * Single Source of Truth (SSOT) Design Tokens for Site-Wide Card Variants & Gradients
 * Used by GridCardContainer and components across all 4 main pages.
 */

export type CardGridVariant =
  | 'hero'
  | 'pro'
  | 'premium'
  | 'basic'
  | 'free'
  | 'day1'
  | 'day2'
  | 'day34'
  | 'day5'
  | 'elevated'
  | 'glass';

export const CARD_GRID_VARIANTS: Record<CardGridVariant, { container: string; gridOpacity: string }> = {
  hero: {
    container: 'bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  pro: {
    container: 'bg-gradient-to-b from-sky-500/10 via-sky-50/40 to-white dark:from-sky-500/10 dark:via-slate-900/90 dark:via-slate-900 dark:to-slate-900 dark:bg-slate-800/90 border-2 border-sky-500 dark:border-sky-400 shadow-xl shadow-sky-500/10 shadow-[var(--card-shadow)]',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  premium: {
    container: 'bg-gradient-to-b from-amber-500/10 via-amber-50/40 to-white dark:from-amber-500/10 dark:via-slate-900/90 dark:via-slate-900 dark:to-slate-900 dark:bg-slate-800/90 border-2 border-amber-500/50 dark:border-amber-400/60 shadow-lg shadow-amber-500/10 shadow-[var(--card-shadow)]',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  basic: {
    container: 'bg-gradient-to-b from-indigo-500/10 via-indigo-50/40 to-white dark:from-indigo-500/10 dark:via-slate-900/90 dark:via-slate-900 dark:to-slate-900 dark:bg-slate-800/90 border-2 border-indigo-500/50 dark:border-indigo-400/60 shadow-lg shadow-indigo-500/10 shadow-[var(--card-shadow)]',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  free: {
    container: 'bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60 shadow-[var(--card-shadow)]',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  day1: {
    container: 'bg-white dark:bg-slate-800/90 dark:bg-slate-900 backdrop-blur-md border border-slate-200 dark:border-slate-800 dark:border-slate-700/80 shadow-sm',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  day2: {
    container: 'bg-white dark:bg-slate-800/90 dark:bg-slate-900 backdrop-blur-md border border-slate-200 dark:border-slate-800 dark:border-slate-700/80 shadow-sm',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  day34: {
    container: 'bg-white dark:bg-slate-800/90 dark:bg-slate-900 backdrop-blur-md border border-slate-200 dark:border-slate-800 dark:border-slate-700/80 shadow-sm',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  day5: {
    container: 'bg-white dark:bg-slate-800/90 dark:bg-slate-900 backdrop-blur-md border border-slate-200 dark:border-slate-800 dark:border-slate-700/80 shadow-sm',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  elevated: {
    container: 'bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
  glass: {
    container: 'bg-white/80 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60',
    gridOpacity: 'opacity-40 dark:opacity-60',
  },
};
