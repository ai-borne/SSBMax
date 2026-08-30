import { test, expect } from '@playwright/test';
import { CONTENT_ROUTES } from '../../src/routes/contentRoutes';

// Phase 2 (docs/plans/i-just-watched-a-nested-russell.md), HIGH 3: routing is additive --
// the app must keep working exactly as before at `/?tab=...`, and the new content paths
// must be reachable as real page loads (not just client-side navigations), since crawlers
// and direct/bookmarked visits hit them cold.
test.describe('Additive content routing does not break existing ?tab= navigation', () => {
  test('legacy ?tab= deep link still lands on the right tab', async ({ page }) => {
    await page.goto('http://localhost:5173/?tab=tests', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText('Cannot GET');
    await expect(page.getByTestId('practice-tests-page')).toBeVisible();
  });

  test('root path still renders the existing landing page', async ({ page }) => {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('hero-section')).toBeVisible();
  });

  for (const { path } of CONTENT_ROUTES) {
    test(`content route ${path} loads real content on a cold visit`, async ({ page }) => {
      await page.goto(`http://localhost:5173${path}`, { waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(200);
    });
  }
});
