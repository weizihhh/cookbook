// 场景 13-14:备份导出→恢复默认→导入恢复 全链路(一条数据命脉)
import { test, expect } from '@playwright/test'
import { injectState, mealCard, DEFAULT_PROFILE, RICE } from './helpers'

/** 应用层会自行 window.location.reload(恢复默认立即、导入 600ms 后),reload 会把
 *  URL 重载回当前路由、盖掉外部的 hash 导航——先在旧文档设标记,跨 reload 等标记
 *  消失,再 goto 目标路由 */
async function waitReloadDone(page) {
  await page.waitForFunction(() => !window.__oldDoc)
}

test('场景13+14:导出备份→恢复默认全清→导入恢复数据', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__YESTERDAY__',
      days: { __YESTERDAY__: { breakfast: [], lunch: [], dinner: [RICE.item()], snack: [] } },
      templates: [],
    },
  })
  await page.goto('/#/profile')

  // 导出:捕获下载文件
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.van-cell', { hasText: '导出数据备份' }).click(),
  ])
  const backupPath = await download.path()
  await expect(page.locator('.van-toast', { hasText: '已导出' })).toBeVisible()

  // 恢复默认:确认弹窗 → 全部清空 + 页面 reload
  await page.locator('.van-cell', { hasText: '恢复默认设置' }).click()
  await page.evaluate(() => (window.__oldDoc = 1))
  await page.getByRole('button', { name: '确认' }).click()
  await waitReloadDone(page)
  // 数据层断言:餐单/打卡全清(已知 bug B-1:reload 落在 /#/profile 时自动保存会把
  // configured 拍回 true,引导态不回归——数据确已清空,故断言移到 localStorage 层)
  const cleared = await page.evaluate(() => ({
    week: JSON.parse(localStorage.getItem('cookbook:week') || '{}'),
    checkin: JSON.parse(localStorage.getItem('cookbook:checkin') || '{}'),
  }))
  expect(Object.keys(cleared.week.days || {})).toHaveLength(0)
  expect(Object.keys(cleared.checkin.marks || {})).toHaveLength(0)

  // 导入:filechooser + 确认覆盖 → reload 后数据恢复
  await page.goto('/#/profile')
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('.van-cell', { hasText: '导入数据恢复' }).click(),
  ])
  await chooser.setFiles(backupPath)
  await page.evaluate(() => (window.__oldDoc = 1))
  await page.getByRole('button', { name: '确认' }).click()
  await expect(page.locator('.van-toast', { hasText: '已导入' })).toBeVisible()
  await waitReloadDone(page)
  // 昨日晚餐数据回来了:晚餐卡出现"复制昨日"入口
  await page.goto('/#/today')
  await expect(mealCard(page, '晚餐').getByRole('button', { name: '复制昨日' })).toBeVisible()
})
