export const themeColors = {
  dark: {
    bgPrimary: '#0b0f19',
    bgSecondary: '#0f172a',
    bgCard: '#1e293b',
    bgElevated: '#334155',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    border: '#334155',
    borderSubtle: '#1e293b',
    accent: '#38bdf8',
    accentHover: '#0284c7',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444'
  },
  light: {
    bgPrimary: '#f8fafc',
    bgSecondary: '#ffffff',
    bgCard: '#ffffff',
    bgElevated: '#f1f5f9',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    accent: '#0284c7',
    accentHover: '#0369a1',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626'
  }
} as const;

export type ThemeMode = 'dark' | 'light' | 'system';
