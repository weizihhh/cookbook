// 场景 18-21:体重趋势与半动态 / 膳食纤维行 / 排除过滤 / 频次约束提示
import { test, expect } from '@playwright/test'
import { injectState, mealCard, mealHeader, DEFAULT_PROFILE, RICE, BREAD, PORK_LIVER } from './helpers'

test.beforeEach(async ({ page }) => {
  await injectState(page, { profile: DEFAULT_PROFILE })
})

test('场景18:体重趋势渲染 + 半动态目标(近 7 天均值 74kg → 目标 1927 千卡)', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    weight: { records: [] },
  })
  await page.goto('/#/today')
  // 记录路径:输入今日体重 → toast
  await page.locator('.weight-input input').fill('74.2')
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await expect(page.locator('.van-toast', { hasText: '已记录' })).toBeVisible()

  // 注入完整 3 条(近 7 天均值 74.07 → 有效体重 74kg)后重载
  await page.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0')
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const mk = (off, kg) => {
      const d = new Date()
      d.setDate(d.getDate() + off)
      return { date: fmt(d), kg }
    }
    localStorage.setItem('cookbook:weight', JSON.stringify({ records: [mk(-6, 73), mk(-1, 75), mk(0, 74.2)] }))
  })
  await page.reload()
  // 74kg 手算:BMR 1688.75 → TDEE 2322.03 → cut-17% → 1927
  await expect(page.locator('.kcal-target')).toHaveText('目标 1927 千卡')
  // 3 条记录 → 趋势折线渲染
  await expect(page.locator('svg.trend polyline')).toBeVisible()
  // 设置页半动态说明:均值 74.1,按有效体重 74kg 计算
  await page.goto('/#/profile')
  await expect(page.getByText('目标按有效体重 74kg 计算')).toBeVisible()
})

test('场景19:膳食纤维行——全麦面包片 70g = 4.2g,不足显示"还差 21g"', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: { __TODAY__: { breakfast: [BREAD.item()], lunch: [], dinner: [], snack: [] } },
      templates: [],
    },
  })
  await page.goto('/#/today')
  const fiberRow = page.locator('.metric-row', { hasText: '膳食纤维' })
  await expect(fiberRow.locator('.metric-val')).toHaveText('4.2 / 25 g')
  await expect(fiberRow.locator('.metric-status')).toHaveText('还差 21g')
  // 千卡合计 = 175(早餐唯一条目)
  await expect(page.locator('.kcal-num')).toHaveText('175')
})

test('场景20:排除过滤——勾选麸质后生成三餐不含麸质食谱', async ({ page }) => {
  await page.goto('/#/profile')
  // 勾选"麸质/小麦"(单个勾选无 checkbox 竞态问题)
  await page.locator('.van-checkbox', { hasText: '麸质' }).click()
  await page.waitForTimeout(400) // 自动保存(已配置档案)落盘
  // 回今日页生成:早餐主食池里的馒头/全麦面包片/燕麦粥(gluten 标签)不应出现
  await page.goto('/#/today')
  await page.getByRole('button', { name: '生成今日三餐' }).click()
  await mealCard(page, '早餐').locator('.slot-chip').first().waitFor()
  for (const glutenName of ['馒头', '全麦面包片', '燕麦粥']) {
    await expect(page.locator('.van-cell', { hasText: glutenName })).toHaveCount(0)
  }
})

test('场景21:频次约束提示——近 7 天吃过猪肝后,确认层红字提示达上限', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__YESTERDAY__',
      days: {
        __YESTERDAY__: { breakfast: [], lunch: [], dinner: [PORK_LIVER.item()], snack: [] },
      },
      templates: [],
    },
  })
  await page.goto('/#/today')
  // 午餐添加爆炒猪肝(mealFit 含午餐,"全部"tab 直接可见)
  await mealCard(page, '午餐').getByRole('button', { name: '+ 添加菜品' }).click()
  await page.locator('.add-list .van-cell', { hasText: '爆炒猪肝' }).click()
  await expect(page.locator('.detail-title', { hasText: '添加:爆炒猪肝' })).toBeVisible()
  // 软提示:达到上限显示但不阻断(次数口径:昨日 1 条=已吃 1 次)
  await expect(page.locator('.limit-hint')).toContainText(
    '猪肝:近 7 天已吃 1 次,已达建议上限(≤1 次/周),不建议再加'
  )
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(mealCard(page, '午餐').locator('.van-cell', { hasText: '爆炒猪肝' })).toBeVisible()
})
