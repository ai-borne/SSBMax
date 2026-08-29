import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // --- Elevation tokens ---
        bgPrimary: 'var(--color-bg-primary)',
        bgSecondary: 'var(--color-bg-secondary)',
        bgCard: 'var(--color-bg-card)',
        bgElevated: 'var(--color-bg-elevated)',
        // --- Text tokens ---
        textPrimary: 'var(--color-text-primary)',
        textSecondary: 'var(--color-text-secondary)',
        textMuted: 'var(--color-text-muted)',
        // --- Border tokens ---
        borderDefault: 'var(--color-border)',
        // --- Accent tokens ---
        accent: 'var(--color-accent)',
        accentHover: 'var(--color-accent-hover)',
        accentContainer: 'var(--color-accent-container)',
        onAccentContainer: 'var(--color-on-accent-container)',
        // --- Status tokens ---
        successContainer: 'var(--color-success-container)',
        onSuccessContainer: 'var(--color-on-success-container)',
        warningContainer: 'var(--color-warning-container)',
        onWarningContainer: 'var(--color-on-warning-container)',
        dangerContainer: 'var(--color-danger-container)',
        onDangerContainer: 'var(--color-on-danger-container)',
        infoContainer: 'var(--color-info-container)',
        onInfoContainer: 'var(--color-on-info-container)',
        // --- Semantic tier tokens (Phase 1) ---
        gold: 'var(--color-gold)',
        goldSubtle: 'var(--color-gold-subtle)',
        goldContainer: 'var(--color-gold-container)',
        onGoldContainer: 'var(--color-on-gold-container)',
        emeraldToken: 'var(--color-emerald)',
        emeraldSubtle: 'var(--color-emerald-subtle)',
        emeraldContainer: 'var(--color-emerald-container)',
        onEmeraldContainer: 'var(--color-on-emerald-container)',
        violetToken: 'var(--color-violet)',
        violetSubtle: 'var(--color-violet-subtle)',
        violetContainer: 'var(--color-violet-container)',
        onVioletContainer: 'var(--color-on-violet-container)',
        // --- 5-Day SSB journey accent colours (Phase 1) ---
        day1: 'var(--color-day1)',
        day2: 'var(--color-day2)',
        day34: 'var(--color-day34)',
        day5: 'var(--color-day5)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  // `prose`/`dark:prose-invert` are already used in StudyTopicPage.tsx, StudyReaderModal.tsx
  // -- this plugin is what actually makes them do anything (heading sizes, paragraph/list
  // spacing for markdown-rendered HTML). Without it those classes are silently unrecognized
  // no-ops, which is why rendered markdown had no visual hierarchy.
  plugins: [typography],
}
