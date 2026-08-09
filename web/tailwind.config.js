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
        bgPrimary: 'var(--color-bg-primary)',
        bgSecondary: 'var(--color-bg-secondary)',
        bgCard: 'var(--color-bg-card)',
        bgElevated: 'var(--color-bg-elevated)',
        textPrimary: 'var(--color-text-primary)',
        textSecondary: 'var(--color-text-secondary)',
        textMuted: 'var(--color-text-muted)',
        borderDefault: 'var(--color-border)',
        accent: 'var(--color-accent)',
        accentHover: 'var(--color-accent-hover)',
      }
    },
  },
  plugins: [],
}
