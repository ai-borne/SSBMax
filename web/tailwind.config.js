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
        // --- Semantic tier tokens (Phase 1) ---
        gold: 'var(--color-gold)',
        goldSubtle: 'var(--color-gold-subtle)',
        emeraldToken: 'var(--color-emerald)',
        emeraldSubtle: 'var(--color-emerald-subtle)',
        violetToken: 'var(--color-violet)',
        violetSubtle: 'var(--color-violet-subtle)',
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
  plugins: [],
}
