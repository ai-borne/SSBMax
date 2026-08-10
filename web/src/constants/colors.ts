export const themeColors = {
  dark: {
    // --- Elevation System (4-level — do not reorder) ---
    bgPrimary: '#0b0f19',
    bgSecondary: '#0f172a',
    bgCard: '#1e293b',
    bgElevated: '#334155',
    // --- Text ---
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    // --- Borders ---
    border: '#334155',
    borderSubtle: '#1e293b',
    // --- Core Accent ---
    accent: '#38bdf8',
    accentHover: '#0284c7',
    // --- Status ---
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    // --- Semantic Tier Tokens (Phase 1) ---
    gold: '#f59e0b',          // Pro Officer Pass — rank insignia gold
    goldSubtle: '#f59e0b1a',  // gold at ~10% opacity
    emerald: '#10b981',       // Cadet FREE — cleared/success
    emeraldSubtle: '#10b9811a',
    violet: '#8b5cf6',        // Most Popular / Command badge
    violetSubtle: '#8b5cf61a',
    // --- 5-Day SSB Journey Accent Colours (Phase 1) ---
    day1: '#6366f1',          // Indigo  — Stage I Screening
    day2: '#8b5cf6',          // Violet  — Stage II Psychology Battery
    day34: '#14b8a6',         // Teal    — Stage II GTO Outdoor Tasks
    day5: '#f59e0b',          // Gold    — Stage II Interview & Conference
  },
  light: {
    // --- Elevation System (4-level — do not reorder) ---
    bgPrimary: '#f8fafc',
    bgSecondary: '#ffffff',
    bgCard: '#ffffff',
    bgElevated: '#f1f5f9',
    // --- Text ---
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    // --- Borders ---
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    // --- Core Accent ---
    accent: '#0284c7',
    accentHover: '#0369a1',
    // --- Status ---
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    // --- Semantic Tier Tokens (Phase 1) ---
    gold: '#d97706',          // Pro Officer Pass — amber on light bg
    goldSubtle: '#d977061a',
    emerald: '#059669',       // Cadet FREE — emerald on light bg
    emeraldSubtle: '#0596691a',
    violet: '#7c3aed',        // Most Popular / Command badge
    violetSubtle: '#7c3aed1a',
    // --- 5-Day SSB Journey Accent Colours (Phase 1) ---
    day1: '#4f46e5',          // Indigo  — Stage I Screening
    day2: '#7c3aed',          // Violet  — Stage II Psychology Battery
    day34: '#0d9488',         // Teal    — Stage II GTO Outdoor Tasks
    day5: '#d97706',          // Gold    — Stage II Interview & Conference
  }
} as const;

export type ThemeMode = 'dark' | 'light' | 'system';
