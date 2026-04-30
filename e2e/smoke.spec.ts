// Post-deploy smoke tests. These cover the regressions that previously slipped
// past unit tests + Lighthouse:
//   - Stale SW serving 404'd lazy chunks (post-Phase 14-3)
//   - 30-second blank middle on the START marquee (pre-Phase 14)
//   - Modals failing to mount (lazy import errors)
//
// Run locally:   npm run e2e
// Run vs prod:   E2E_BASE_URL=https://cagoooo.github.io/penguin/ npm run e2e

import { test, expect } from '@playwright/test';

test.describe('START screen', () => {
  test('loads with title + start button + footer', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: '南極大冒險' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /開始冒險/ })).toBeVisible();
    // Footer credits both authors
    await expect(page.getByText('阿凱老師')).toBeVisible();
    await expect(page.getByText('antarctic')).toBeVisible();
  });

  test('marquee shows real content within 10 seconds (no 30s blank gap)', async ({ page }) => {
    await page.goto('./');
    // Marquee kicks in after 3s idle, then AnimatePresence transitions the
    // static→scroll content. Total budget: 10s — comfortably under the OLD
    // 30s blank window that was the regression we're guarding against.
    await expect(page.getByText('敵人與陷阱').first()).toBeVisible({ timeout: 10000 });
  });

  test('historical best score shown when localStorage has a value', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('penguin_best', '12345');
    });
    await page.goto('./');
    await expect(page.getByText(/歷史最高分/)).toBeVisible();
    await expect(page.getByText('12,345')).toBeVisible();
  });
});

test.describe('Modals (lazy-loaded)', () => {
  test('排行榜 modal opens (Firebase chunk lazy-loads)', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '排行榜' }).first().click();
    await expect(page.getByRole('heading', { name: /全球排行榜/ })).toBeVisible({ timeout: 10000 });
    // Either entries appear OR an empty/loading message — both are fine
    await page.getByRole('button', { name: '關閉' }).first().click();
    await expect(page.getByRole('heading', { name: /全球排行榜/ })).not.toBeVisible();
  });

  test('成就 modal opens with correct count', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /成就/ }).click();
    // Modal heading specifically (not the button on the START screen)
    await expect(page.getByRole('heading', { name: /成就 \(0\/12\)/ })).toBeVisible();
    // Secret achievements render as ??? — at least one should show on fresh visit
    await expect(page.getByText('???').first()).toBeVisible();
    await page.getByRole('button', { name: '關閉' }).click();
  });

  test('換造型 modal opens with default skin selected', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /換造型/ }).click();
    await expect(page.getByText('經典企鵝')).toBeVisible();
    await expect(page.getByText('使用中')).toBeVisible();
    await page.getByRole('button', { name: '關閉' }).click();
  });
});

test.describe('Daily Challenge', () => {
  test('today challenge banner is shown', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByText('今日挑戰')).toBeVisible();
    // Theme name is one of the 7 valid themes
    const themes = ['經典日', '北極熊日', '冰山日', '黃金魚日', '時間充裕日', '極速日', '暴風雪日', '連擊狂熱日'];
    let foundTheme = false;
    for (const theme of themes) {
      if (await page.getByText(theme).count() > 0) {
        foundTheme = true;
        break;
      }
    }
    expect(foundTheme).toBe(true);
  });

  test('daily challenge can be toggled on', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: '啟用' }).click();
    // Button text changes after activation
    await expect(page.getByRole('button', { name: /已啟用/ })).toBeVisible();
  });
});

test.describe('Gameplay entry', () => {
  test('開始冒險 button starts a game (canvas becomes visible)', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /開始冒險/ }).click();
    // Canvas should remain in DOM and START overlay should be gone
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByRole('heading', { name: '南極大冒險' }).first()).not.toBeVisible();
  });
});

test.describe('PWA + assets', () => {
  test('OG image is reachable', async ({ request, baseURL }) => {
    const res = await request.get(new URL('og-image.png', baseURL).toString());
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });

  test('favicon is reachable', async ({ request, baseURL }) => {
    const res = await request.get(new URL('favicon.svg', baseURL).toString());
    expect(res.status()).toBe(200);
  });

  test('manifest.webmanifest is reachable', async ({ request, baseURL }) => {
    const res = await request.get(new URL('manifest.webmanifest', baseURL).toString());
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toContain('南極大冒險');
    expect(manifest.icons).toBeTruthy();
  });
});
