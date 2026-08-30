import { defineConfig, devices } from '@playwright/test';

/**
 * Without this file, `playwright test` fell back to its own defaults: testDir at the
 * project root, which also matched every Vitest unit-test file under tests/unit (they
 * import vitest, which throws "Vitest failed to access its internal state" when loaded by
 * Playwright's runner instead) -- so `npm run test:e2e` was broken by default before this
 * config existed, independent of the CI-wiring gap. Scoping testDir to tests/e2e fixes that
 * and is what makes it safe to run test:e2e in CI (web-ci job, .github/workflows/main-ci.yml).
 *
 * `webServer` starts the same `npm run dev` a human would run locally (its `predev` hook
 * already regenerates the content bundle/SEO files) and waits for it to answer before tests
 * start, so CI needs no separate "start the app" step -- and `reuseExistingServer` keeps
 * local `npm run test:e2e` fast against a dev server already running.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Firestore reads against the 'ssbmax-demo' placeholder project used in this dev server
    // otherwise hit real gRPC backoff on permission-denied for many seconds before falling
    // back to bundled dev content (src/config/firebase.ts) -- disable the network up front so
    // e2e runs at the speed of the fallback, not of a doomed real Firestore round trip.
    env: { VITE_E2E: 'true' },
  },
});
