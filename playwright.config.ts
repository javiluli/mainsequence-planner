import { defineConfig } from '@playwright/test'

/** A single isolated desktop browser exercises native canvas input; domain matrices stay in Vitest. */
export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
})
