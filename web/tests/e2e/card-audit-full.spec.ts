import { test, expect } from '@playwright/test';

const ALL_TEST_IDS = [
  'oir',
  'ppdt',
  'piq',
  'psychology',
  'tat',
  'wat',
  'srt',
  'sd',
  'gd',
  'gpe',
  'pgt',
  'hgt',
  'iot',
  'command_task',
  'snake_race',
  'fgt',
  'interview',
  'conference',
];

test.describe('Comprehensive SSB Test Cards Runtime Audit', () => {
  test('Audit all 18 test cards on localhost:5173 for launch, content loading, and errors', async ({ page }) => {
    // 1. Force Dev Tier Override to FORCE_PREMIUM so all cards are unlocked
    await page.goto('http://localhost:5173/?tab=settings');
    await page.waitForLoadState('domcontentloaded');

    const premiumBtn = page.locator('button:has-text("Force PREMIUM")');
    if (await premiumBtn.isVisible()) {
      await premiumBtn.click();
      await page.waitForTimeout(300);
    }

    console.log('\n========================================');
    console.log('STARTING RUNTIME AUDIT OF ALL 18 SSB TEST CARDS');
    console.log('========================================\n');

    const results: Record<string, { status: string; title: string; details: string }> = {};

    for (const testId of ALL_TEST_IDS) {
      // Force reload tests tab for every card to guarantee clean state
      await page.goto('http://localhost:5173/?tab=tests');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(300);

      // Locate the launch button for this test card
      const launchBtn = page.locator(`[data-testid="launch-button-${testId}"]`);
      const isVisible = await launchBtn.isVisible();

      if (!isVisible) {
        results[testId] = {
          status: '❌ MISSING_BUTTON',
          title: testId,
          details: `Launch button [data-testid="launch-button-${testId}"] not found on page`
        };
        continue;
      }

      // Scroll into view and click
      await launchBtn.scrollIntoViewIfNeeded();
      await launchBtn.click();
      await page.waitForTimeout(1000);

      // Check page content & headings
      const heading = await page.locator('h1, h2, h3').first().textContent().catch(() => 'NO_HEADING');
      const bodyText = await page.innerText('body');

      // Check if error box or alert is present
      const hasError = bodyText.includes('Missing or insufficient permissions') || bodyText.includes('Error') || bodyText.includes('failed to load');

      if (hasError) {
        results[testId] = {
          status: '⚠️ ERROR_STATE',
          title: heading?.trim() || testId,
          details: `Rendered error state: ${bodyText.slice(0, 100)}...`
        };
      } else {
        results[testId] = {
          status: '✅ WORKING',
          title: heading?.trim() || testId,
          details: `Successfully launched. Heading: "${heading?.trim()}"`
        };
      }
    }

    console.log('\nFINAL AUDIT RESULTS SUMMARY:');
    console.table(results);

    // Assert no cards have missing buttons or errors
    const failing = Object.entries(results).filter(([_, r]) => !r.status.includes('WORKING'));
    expect(failing).toHaveLength(0);
  });
});
