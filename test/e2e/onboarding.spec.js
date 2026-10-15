// 场景 1-2:首次引导态 + 默认档案公式链精确断言(TEST_PLAN §3)
import { test, expect } from '@playwright/test'
import { ANCHOR } from './helpers'

test('场景1:未配置显示引导态,"去设置"直达档案页', async ({ page }) => {
  await page.goto('/#/today')
  await expect(page.getByText('先完善身体数据,才能计算你的每日热量与营养目标')).toBeVisible()
  await page.getByRole('button', { name: '去设置' }).click()
  await expect(page).toHaveURL(/#\/profile/)
})

test('场景2:默认档案公式链——设置页预览与今日页目标卡均等于手算锚点', async ({ page }) => {
  await page.goto('/#/profile')
  // 预览面板精确断言:每个手算锚点值在页面里恰好出现一次
  // (不用"标题→value"定位:营养细节区与预览区存在同名"蛋白质"cell)
  const anchorValues = [
    `${ANCHOR.bmr} 千卡`,
    `${ANCHOR.tdee} 千卡`,
    `${ANCHOR.kcal} 千卡`,
    `${ANCHOR.protein} g`,
    ANCHOR.breakfast,
    ANCHOR.lunch,
    ANCHOR.dinner,
  ]
  for (const v of anchorValues) {
    await expect(page.locator('.van-cell__value', { hasText: v })).toHaveCount(1)
  }

  // 保存(默认表单即合法档案)→ 回今日页,目标卡同锚点
  await page.getByRole('button', { name: '保存设置' }).click()
  await page.goto('/#/today')
  await expect(page.locator('.kcal-target')).toHaveText(`目标 ${ANCHOR.kcal} 千卡`)
  // 未记录态:中性灰 + 实际 0
  await expect(page.locator('.kcal-chip')).toHaveText('未记录')
  await expect(page.locator('.metric-row', { hasText: '蛋白质' }).locator('.metric-val')).toHaveText(
    `0 / ${ANCHOR.protein} g`
  )
})
