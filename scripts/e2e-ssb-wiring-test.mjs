import { chromium } from '@playwright/test';

async function testSSBWiring() {
  console.log('🚀 Starting Playwright SSB Test Wiring Audit on http://localhost:5173 ...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkFailures.push(`${res.status()} ${res.url()}`);
    }
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('✅ Page loaded: http://localhost:5173');

    // Enable dev tier override to access all PRO tests without payment gate
    await page.evaluate(() => {
      localStorage.setItem('ssbmax_dev_tier_override', 'FORCE_PRO');
    });
    await page.reload({ waitUntil: 'networkidle' });

    // Navigate to Practice Tests tab
    const testsTab = page.locator('button:has-text("Practice Tests"), nav a:has-text("Practice"), button:has-text("Tests")').first();
    await testsTab.click();
    await page.waitForTimeout(1000);

    console.log('\n--- Auditing Practice Tests Page ---');

    // List of test IDs to check
    const testIdsToTest = ['oir', 'ppdt', 'piq', 'psychology', 'tat', 'wat', 'srt', 'sd', 'gpe', 'interview'];
    const auditResults = [];

    for (const testId of testIdsToTest) {
      console.log(`\n🔍 Testing SSB Test Card ID: "${testId}" ...`);

      // Locate the button for this specific test card
      // Look for button or clickable card containing the test title / short code
      const cardButton = page.locator(`[data-testid="test-card-${testId}"], button:has-text("${testId.toUpperCase()}")`).first();
      const cardExists = await cardButton.count() > 0;

      if (!cardExists) {
        // Fallback search by text matching inside cards
        const fallbackBtn = page.locator('button', { hasText: new RegExp(testId, 'i') }).first();
        const fallbackCount = await fallbackBtn.count();
        if (fallbackCount === 0) {
          auditResults.push({ id: testId, status: 'NOT_FOUND', detail: 'Card button not visible on Practice Tests tab' });
          continue;
        }
        await fallbackBtn.click();
      } else {
        await cardButton.click();
      }

      await page.waitForTimeout(1000);

      // Inspect state after clicking test
      const headingText = await page.locator('h1, h2').first().innerText().catch(() => 'No Heading');
      const bodyText = await page.locator('body').innerText().catch(() => '');

      let outcome = 'LOADED';
      let detail = `Heading: "${headingText}"`;

      if (bodyText.includes('Error') || bodyText.includes('unavailable')) {
        outcome = 'ERROR_LOADED';
        detail = bodyText.slice(0, 150).replace(/\n/g, ' ');
      }

      auditResults.push({ id: testId, status: outcome, heading: headingText, detail });

      // Exit test if exit button is visible
      const exitBtn = page.locator('button:has-text("Exit"), button:has-text("Back"), button:has-text("Close")').first();
      if (await exitBtn.count() > 0) {
        await exitBtn.click().catch(() => {});
        await page.waitForTimeout(500);
        // If modal appears, confirm exit
        const confirmExitBtn = page.locator('button:has-text("Confirm Exit"), button:has-text("Exit Test")').first();
        if (await confirmExitBtn.count() > 0) {
          await confirmExitBtn.click().catch(() => {});
          await page.waitForTimeout(500);
        }
      }
    }

    console.log('\n=== SSB TEST WIRING AUDIT RESULTS ===');
    console.table(auditResults);

    console.log(`\nCaptured Console Errors (${consoleErrors.length}):`);
    consoleErrors.forEach((err) => console.log('  ❌', err));

    console.log(`\nCaptured Network Failures (${networkFailures.length}):`);
    networkFailures.forEach((net) => console.log('  ⚠️', net));

  } catch (err) {
    console.error('Fatal error during Playwright execution:', err);
  } finally {
    await browser.close();
  }
}

testSSBWiring();
