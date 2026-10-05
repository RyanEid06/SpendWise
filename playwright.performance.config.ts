import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e/performance', fullyParallel: false, workers: 1, retries: 0,
  forbidOnly: !!process.env.CI, timeout: 180000, expect: { timeout: 30000 },
  reporter: [['list']], outputDir: 'test-results/performance',
  // Trace snapshots serialize the entire synthetic DOM after each action and
  // distort large-ledger measurements. Profiler receipts and failure screenshots
  // remain available; retained WP32 suites keep their own trace configuration.
  use: { baseURL: 'http://127.0.0.1:4175', ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, timezoneId: 'UTC', trace: 'off', screenshot: 'only-on-failure' },
  webServer: { command: 'npx vite --host 127.0.0.1 --port 4175', port: 4175, reuseExistingServer: !process.env.CI, timeout: 60000 },
});
