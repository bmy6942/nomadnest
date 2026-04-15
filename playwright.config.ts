import { defineConfig, devices } from '@playwright/test';

/**
 * NomadNest Taiwan — Playwright E2E Test Configuration
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Maximum time one test can run for. */
  timeout: 30_000,
  expect: {
    /* Maximum time expect() assertions have to wait. */
    timeout: 5_000,
  },
  /* Run tests in files in parallel */
  fullyParallel: false, // SQLite doesn't support concurrent writes
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use. */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL so test can use relative paths like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'on-first-retry',
    /* All tests are in Traditional Chinese context */
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /* Mobile viewport - important for a rental platform */
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Automatically start dev server before tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
