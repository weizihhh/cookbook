// 场景 16-17:常吃组合模板 UI 全链路 + 剩余预算推荐一餐
import { test, expect } from '@playwright/test'
import { injectState, mealCard, mealHeader, DEFAULT_PROFILE, RICE } from './helpers'

test.beforeEach(async ({ page }) => {
  await injectState(page, { profile: DEFAULT_PROFILE })
})

test('场景16:模板——存为命名模板、清空后套用恢复、同名覆盖、删除', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: { __TODAY__: { breakfast: [RICE.item()], lunch: [], dinner: [], snack: [] } },
      templates: [],
    },
  })
  await page.goto('/#/today')

  // 存为模板:命名"我的标配"
  await mealCard(page, '早餐').getByRole('button', { name: '模板' }).click()
  await expect(page.locator('.tpl-title')).toContainText('早餐 · 常吃组合')
  await page.locator('.van-cell', { hasText: '把今天的早餐存为模板' }).click()
  await page.locator('.name-field input').fill('我的标配')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('.van-toast', { hasText: '已保存「我的标配」' })).toBeVisible()
  // 模板列表:名称 + 菜品数 + 合计千卡(精确档:白米饭 242)
  const tplCell = page.locator('.tpl-name', { hasText: '我的标配' })
  await expect(tplCell).toBeVisible()
  await expect(page.locator('.tpl-meta').first()).toHaveText('1 个菜品 · 约 242 千卡')
  // 关闭弹层,清空今天(无锁定餐直接清)
  await page.locator('.tpl-close').click()
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await expect(mealCard(page, '早餐').getByText('未记录')).toBeVisible()

  // 空餐套用:一键恢复
  await mealCard(page, '早餐').getByRole('button', { name: '模板' }).click()
  await tplCell.click()
  await expect(page.locator('.van-toast', { hasText: '已套用模板「我的标配」 1 个菜品' })).toBeVisible()
  await expect(mealCard(page, '早餐').locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)

  // 删除模板:确认弹窗 → 列表空
  await mealCard(page, '早餐').getByRole('button', { name: '模板' }).click()
  await page.locator('.tpl-del').click()
  await page.getByRole('button', { name: '确认' }).click()
  await expect(page.locator('.van-toast', { hasText: '已删除' })).toBeVisible()
  await expect(page.locator('.tpl-empty')).toBeVisible()
})

test('场景17:推荐一餐——剩余预算入口、候选组合、采纳写入晚餐', async ({ page }) => {
  // 早餐+午餐各 2 条白米饭 = 968 千卡,剩余 914 ∈ [150, 60%×1882=1129] → 推荐入口可见
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: {
        __TODAY__: {
          breakfast: [RICE.item(), RICE.item()],
          lunch: [RICE.item(), RICE.item()],
          dinner: [],
          snack: [],
        },
      },
      templates: [],
    },
  })
  await page.goto('/#/today')
  await expect(page.locator('.rec-link')).toHaveText('推荐一餐 ›')
  await page.locator('.rec-link').click()
  // 弹层:剩余预算头部 + 至少一个候选组合
  await expect(page.locator('.rec-sub')).toContainText('还剩 914 千卡')
  const firstCard = page.locator('.rec-card').first()
  await expect(firstCard).toBeVisible()
  const candidateCount = await page.locator('.rec-card').count()
  expect(candidateCount).toBeGreaterThanOrEqual(1)

  // 采纳第一个组合 → 写入晚餐(空餐直套)→ 晚餐有内容,弹层关闭
  await firstCard.getByRole('button', { name: '就吃这个' }).click()
  await expect(page.locator('.van-toast', { hasText: '已添加推荐组合' })).toBeVisible()
  await expect(mealCard(page, '晚餐').locator('.slot-chip').first()).toBeVisible()
  // 顶部剩余量收紧后入口消失(剩余 < 150 千卡量级,断言入口隐藏)
  await expect(page.locator('.rec-link')).toBeHidden()
})
