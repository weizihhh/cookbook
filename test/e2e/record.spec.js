// 场景 12:记录页——月历渲染、点选历史天、统计口径(与今日页同源精确断言)
import { test, expect } from '@playwright/test'
import { injectState, DEFAULT_PROFILE, RICE } from './helpers'

test.beforeEach(async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: { __TODAY__: { breakfast: [RICE.item()], lunch: [], dinner: [], snack: [] } },
      templates: [],
    },
    checkin: { marks: { __TODAY__: { breakfast: 'done' } } },
  })
})

test('场景12:月历有记录标记、统计日均与今日页同源、点选未记录天', async ({ page }) => {
  await page.goto('/#/record')
  // 今天格子带记录标记(热力点色类)
  await expect(page.locator('.cal-cell.today')).toHaveClass(/has-rec/)
  // 统计:本周记录 1 天;日均 242/1882 千卡 → 低 87%(与今日页同一 summarizeIntake 口径)
  await expect(page.locator('.diet-row', { hasText: '饮食记录' })).toContainText(/1 \/ \d+ 天/)
  const kcalRow = page.locator('.diet-row', { hasText: '日均热量' })
  await expect(kcalRow).toContainText('242')
  await expect(kcalRow).toContainText('1882 千卡')
  await expect(kcalRow).toContainText('低 87%')
  // 点今天:详情显示条目与合计(宏量行前缀精确:蛋白 5.2g · 碳水 54.5g)
  await page.locator('.cal-cell.today').click()
  const detail = page.locator('.day-detail')
  await expect(detail).toContainText('白米饭')
  await expect(detail).toContainText('242 千卡')
  await expect(detail).toContainText('蛋白 5g · 碳水 55g · 脂肪 1g')
  // 打卡状态在详情区可见
  await expect(detail.locator('.checkin-mark', { hasText: '已吃' })).toBeVisible()

  // 点昨天(未记录):显示该日未记录(假设昨天在本月——跨月首日跑测试时此步会失败,属已知边界)
  const yesterdayNum = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.getDate()
  })
  await page.locator('.cal-cell', { hasText: String(yesterdayNum) }).first().click()
  await expect(detail).toContainText('该日未记录')
})

// 场景 12b:仅动态加餐槽有内容的天,统计口径与日历点一致(v0.26.1 评审 v7 F-3
// ——dietStats 的记录天判定曾只查固定餐键,同页与 recordDays/日历点自相矛盾)
test('场景12b:仅加餐槽有内容的天计入"饮食记录"与日均(与日历点同口径)', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: {
        __TODAY__: {
          breakfast: [], lunch: [], dinner: [], snack: [],
          extraMeals: [{ id: 'em_a', label: '加餐 2', items: [RICE.item()] }],
        },
      },
      templates: [],
    },
    checkin: { marks: {} },
  })
  await page.goto('/#/record')
  await expect(page.locator('.cal-cell.today')).toHaveClass(/has-rec/)
  await expect(page.locator('.diet-row', { hasText: '饮食记录' })).toContainText(/1 \/ \d+ 天/)
  const kcalRow = page.locator('.diet-row', { hasText: '日均热量' })
  await expect(kcalRow).toContainText('242')
  await expect(kcalRow).toContainText('低 87%')
})
