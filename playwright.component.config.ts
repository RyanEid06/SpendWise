import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/components',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  outputDir: 'test-results/components',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174',
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
