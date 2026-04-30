// Canvas visual regression — baseline screenshots of START + key modals.
//
// Animation makes the in-game canvas hard to snapshot deterministically. We
// avoid screenshotting it directly. Instead we capture:
//   - The full START screen (modulo motion entry tweaks)
//   - The 3 modals (Achievements / Skins / Leaderboard)
//
// Rules of thumb:
//   - Use `mask` for time-based elements (combo timer, daily date, etc.)
//   - First run on a new machine generates baselines; subsequent runs diff.
//
// Run with: npm run e2e -- e2e/visual.spec.ts
// Update baselines: npm run e2e -- e2e/visual.spec.ts --update-snapshots

import { test, expect } from '@playwright/test';

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Disable motion for stable screenshots
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.001s !important;
          animation-delay: 0s !important;
          transition-duration: 0.001s !important;
        }
      `;
      document.documentElement.appendChild(style);
    });
  });

  test('START screen', async ({ page }) => {
    await page.goto('./');
    // Wait for hero heading + first CTA to be visible
    await page.getByRole('heading', { name: '南極大冒險' }).first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /開始冒險/ }).waitFor({ state: 'visible' });
    // Mask the daily challenge banner — its theme rotates day-by-day
    const dailyBanner = page.locator('text=/今日挑戰/').locator('..').locator('..');
    await expect(page).toHaveScreenshot('start-screen.png', {
      fullPage: false,
      mask: [dailyBanner],
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Achievements modal — fresh player', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /成就/ }).click();
    await page.getByRole('heading', { name: /成就 \(0\/12\)/ }).waitFor();
    await expect(page).toHaveScreenshot('achievements-fresh.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Skin picker — default skin selected', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /換造型/ }).click();
    await page.getByText('經典企鵝').waitFor();
    await expect(page).toHaveScreenshot('skin-picker-default.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
