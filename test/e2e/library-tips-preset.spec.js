// 场景 22-24:食谱库与自定义食物全链路 / 营养贴士折叠 / 宏量预设模式联动
import { test, expect } from '@playwright/test'
import { injectState, mealCard, DEFAULT_PROFILE } from './helpers'

test.beforeEach(async ({ page }) => {
  await injectState(page, { profile: DEFAULT_PROFILE })
})

test('场景22:食谱库搜索 + 自定义食物增改删与全链路联动', async ({ page }) => {
  // 搜索过滤:食谱名跨槽位命中
  await page.goto('/#/library')
  await page.locator('.library-search input').fill('鸡胸')
  await expect(page.getByRole('tab', { name: '全部' })).toBeVisible()
  await expect(page.locator('.van-cell', { hasText: '鸡胸' }).first()).toBeVisible()

  // 手动添加自定义食物:每 100g 口径
  await page.locator('.library-search input').fill('')
  await page.getByRole('tab', { name: '自定义' }).click()
  await page.getByRole('button', { name: '手动添加' }).click()
  const form = page.locator('.import-panel')
  await form.locator('.van-field', { hasText: '名称' }).locator('input').fill('测试能量棒')
  await form.locator('.van-field', { hasText: '能量' }).locator('input').fill('300')
  await form.locator('.van-field', { hasText: '蛋白质' }).locator('input').fill('20')
  await form.locator('.van-field', { hasText: '脂肪' }).locator('input').fill('8')
  await form.locator('.van-field', { hasText: '碳水' }).locator('input').fill('35')
  await form.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('tab', { name: '自定义(1)' })).toBeVisible()
  await expect(page.locator('.van-cell', { hasText: '测试能量棒' })).toBeVisible()

  // 今日页加餐可搜到并加入(基准 100g → 300 千卡计入全天合计)
  await page.goto('/#/today')
  await mealCard(page, '加餐').getByRole('button', { name: '+ 添加菜品' }).click()
  await page.locator('.van-search input').fill('测试能量棒')
  await page.locator('.add-list .van-cell', { hasText: '测试能量棒' }).click()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(mealCard(page, '加餐').locator('.van-cell', { hasText: '测试能量棒' })).toBeVisible()
  await expect(page.locator('.kcal-num')).toHaveText('300')

  // 编辑改名 → 列表更新
  await page.goto('/#/library')
  await page.getByRole('tab', { name: '自定义' }).click()
  await page.locator('.van-cell', { hasText: '测试能量棒' }).click()
  await page.locator('.import-panel .van-field', { hasText: '名称' }).locator('input').fill('测试能量棒Pro')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('.van-cell', { hasText: '测试能量棒Pro' })).toBeVisible()

  // 删除自定义食物 → 列表清空 + 今日加餐引用联动清理
  await page.locator('.van-cell', { hasText: '测试能量棒Pro' }).click()
  await page.getByRole('button', { name: '删除此食物' }).click()
  await page.getByRole('button', { name: '确认' }).click()
  await expect(page.getByRole('tab', { name: '自定义', exact: true })).toBeVisible() // 计数归零
  await page.goto('/#/today')
  await expect(mealCard(page, '加餐').getByText('未记录')).toBeVisible()
})

test('场景23:营养贴士折叠展开(v-model:active 修复回归)+ 今日页每日一读', async ({ page }) => {
  await page.goto('/#/profile')
  // 折叠面板:点第一条标题展开,内容可见(v0.7.0 P1 bug 修复护栏)
  await page.locator('.van-collapse-item__title').first().click()
  await expect(page.locator('.tip-text').first()).toBeVisible()
  // 再点收起
  await page.locator('.van-collapse-item__title').first().click()
  await expect(page.locator('.tip-text').first()).toBeHidden()

  // 今日页每日一读卡:按日期轮换,标题与正文非空
  await page.goto('/#/today')
  await expect(page.getByText('💡 每日一读')).toBeVisible()
  const tipTitle = await page.locator('.tips-title').innerText()
  expect(tipTitle.trim().length).toBeGreaterThan(0)
})

test('场景24:模式切换自动套用宏量预设(减脂 2.0 → 增肌标准 1.8)', async ({ page }) => {
  await page.goto('/#/profile')
  // 打开模式 picker,选"增肌"确认
  await page.locator('.van-field__label', { hasText: '模式' }).click()
  await page.locator('.van-picker-column__item', { hasText: '增肌' }).click()
  await page.getByRole('button', { name: '确认' }).click()
  // 联动 toast + 蛋白预设落表单(营养细节区在前;预览区同名"蛋白质"cell 是 126g)
  await expect(page.locator('.van-toast', { hasText: `已套用"增肌·标准"预设` })).toBeVisible()
  await expect(
    page.locator('.van-cell', { hasText: '蛋白质' }).first().locator('.van-cell__value')
  ).toHaveText('1.8 g/kg 体重')
  // 预览区蛋白目标同步为 70kg × 1.8 = 126g(模式→预设→目标 的完整联动)
  await expect(page.locator('.van-cell__value.em', { hasText: '126 g' })).toBeVisible()
  // 宏量预设字段同步显示
  await expect(
    page.locator('.van-field', { hasText: '宏量比例预设' }).locator('input')
  ).toHaveValue('增肌·标准')
})
