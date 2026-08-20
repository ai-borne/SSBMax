import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

// Kept in sync with vite.config.ts's own `define` -- vitest reads this file,
// not vite.config.ts, so __APP_VERSION__ needs the same injection here too.
const { version: appVersion } = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
