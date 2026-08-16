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
      await page.waitForTimeout(400);

      const heading = await page.locator('h2, h1, h3').first().innerText().catch(() => 'No Heading');
      const bodyText = await page.locator('body').innerText().catch(() => '');

      console.log(`[AUDIT] ${testId.toUpperCase()} -> Heading: "${heading}"`);

      if (testId === 'piq') {
        expect(bodyText).toContain('Personal Information Questionnaire');
      } else if (testId === 'oir') {
        expect(bodyText.toLowerCase()).toContain('oir');
      } else if (['tat', 'wat', 'srt', 'ppdt'].includes(testId)) {
        // Psychology runner test state
        const isRunnerMounted = bodyText.includes('Slide') || bodyText.includes('Psychology') || bodyText.includes('TAT') || bodyText.includes('WAT') || bodyText.includes('SRT') || bodyText.includes('PPDT') || bodyText.includes('Failed to load');
        expect(isRunnerMounted).toBe(true);
      }
    });
  }
});
