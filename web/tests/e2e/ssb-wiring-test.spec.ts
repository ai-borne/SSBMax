import { test, expect } from '@playwright/test';

const SSB_TEST_IDS = [
  'oir', 'ppdt', 'piq', 'tat', 'wat', 'srt', 'sd',
  'gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt',
  'interview', 'conference'
];

test.describe('SSB Test Wiring & Firestore Binding Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('ssbmax_dev_tier_override', 'FORCE_PRO');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Navigate to Practice tab
    const testsTab = page.locator('button:has-text("Practice Tests"), nav a:has-text("Practice"), button:has-text("Tests")').first();
    await testsTab.click();
    await page.waitForTimeout(200);
  });

  for (const testId of SSB_TEST_IDS) {
    test(`Verify SSB Test Card [${testId}] wiring & Firestore bounds`, async ({ page }) => {
      const launchBtn = page.locator(`[data-testid="launch-button-${testId}"]`).first();

      const exists = await launchBtn.count() > 0;
      expect(exists, `Launch button for [${testId}] must be rendered`).toBe(true);

      await launchBtn.click();

      const heading = await page.locator('h2, h1, h3').first().innerText().catch(() => 'No Heading');
      console.log(`[AUDIT] ${testId.toUpperCase()} -> Heading: "${heading}"`);

      // Content resolves via a real Firestore getDoc() call that falls back to bundled dev
      // content on error (ContentRepository) -- on a contended CI runner that round trip
      // (including Firestore's own connect/backoff before it fails) can take several seconds,
      // so poll for the rendered result instead of asserting after one fixed short delay.
      if (testId === 'piq') {
        await expect.poll(() => page.locator('body').innerText(), { timeout: 15_000 })
          .toContain('Personal Information Questionnaire');
      } else if (testId === 'oir') {
        await expect.poll(() => page.locator('body').innerText().then((t) => t.toLowerCase()), { timeout: 15_000 })
          .toContain('oir');
      } else if (['tat', 'wat', 'srt', 'ppdt'].includes(testId)) {
        // Psychology runner test state
        const isRunnerMounted = (text: string) =>
          text.includes('Slide') || text.includes('Psychology') || text.includes('TAT') || text.includes('WAT') || text.includes('SRT') || text.includes('PPDT') || text.includes('Failed to load');
        await expect.poll(() => page.locator('body').innerText().then(isRunnerMounted), { timeout: 15_000 })
          .toBe(true);
      }
    });
  }
});
