import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './client/web/e2e',
  testMatch: '*.e2e.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'yarn workspace web dev --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
