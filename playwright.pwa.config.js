import { defineConfig, devices } from '@playwright/test'

// PWA 专项:SW 仅 PROD 注册,必须走 build + preview(4173)
export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '**/pwa.spec.js',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-pwa',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
