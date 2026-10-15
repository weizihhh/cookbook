// 场景 15:PWA 冒烟——SW 注册、缓存接管、二次加载仍受控(preview 构建,SW 仅 PROD 注册)
import { test, expect } from '@playwright/test'

test('场景15:service worker 接管应用并持有缓存', async ({ page }) => {
  await page.goto('/')
  // 首次加载 SW 完成注册但可能尚未接管本次导航(哈希资源早于 SW 激活);
  // 二次加载必须处于受控状态且缓存就位
  await page.reload()
  const state = await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    const keys = await caches.keys()
    return {
      controlled: !!navigator.serviceWorker.controller,
      ready: true,
      cacheCount: keys.length,
      cacheNames: keys.join(','),
    }
  })
  expect(state.ready).toBe(true)
  expect(state.controlled).toBe(true)
  expect(state.cacheCount).toBeGreaterThan(0)
  // 缓存集合非空即视为"壳+资产已被 SW 持有";版本号名不写死(随构建哈希变)
})
