const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.WOT_PREVIEW_BASE_URL || 'http://127.0.0.1:3000';
const username = process.env.WOT_PREVIEW_USERNAME || 'dev1';
const password = process.env.WOT_PREVIEW_PASSWORD || '1907';
const outputPath = process.env.WOT_PREVIEW_OUTPUT;

if (!outputPath) throw new Error('WOT_PREVIEW_OUTPUT missing');

test('capture public portfolio preview', async ({ page }) => {
  await page.goto(`${baseUrl}/${username}/portfolio_public`, { waitUntil: 'networkidle' });

  const passwordInput = page.locator('input[name="password"]');
  if (await passwordInput.count()) {
    await passwordInput.fill(password);
    await page.getByRole('button', { name: /unlock portfolio/i }).click();
    await page.waitForLoadState('networkidle');
  }

  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.screenshot({ path: outputPath, fullPage: true });

  const artifactDir = path.dirname(outputPath);
  fs.writeFileSync(path.join(artifactDir, path.basename(outputPath) + '.txt'), `${baseUrl}/${username}/portfolio_public\n`);
});
