import { defineConfig, devices } from '@playwright/test'

// 功能 E2E:dev server(5173),PWA 专项走 playwright.pwa.config.js(preview 构建)
export default defineConfig({
  testDir: 'test/e2e',
  testIgnore: '**/pwa.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Vant 移动优先:移动视口(devices 默认桌面视口,须在 project 层覆盖)
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
