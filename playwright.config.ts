import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90_000, expect: { timeout: 15_000 }, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 30_000 },
});
