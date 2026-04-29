import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — runs against the locally-built `vite preview` server by
 * default. CI passes E2E_BASE_URL to point at the deployed GitHub Pages URL
 * so we get a true post-deploy smoke test.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4173/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],

  // Boot a `vite preview` server unless we're hitting a deployed URL
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
