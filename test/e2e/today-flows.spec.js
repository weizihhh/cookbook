// 场景 3-11:今日页核心链路——生成/换菜/添加累加/打卡口径/清空与重生成保护/加餐/复制昨日
import { test, expect } from '@playwright/test'
import { injectState, mealCard, mealHeader, readKcal, checkinMeal, DEFAULT_PROFILE, RICE } from './helpers'

test.beforeEach(async ({ page }) => {
  await injectState(page, { profile: DEFAULT_PROFILE })
})

test('场景3:生成三餐——四餐卡渲染、三餐有内容、顶部进入统计态', async ({ page }) => {
  await page.goto('/#/today')
  await page.getByRole('button', { name: '生成今日三餐' }).click()
  await expect(page.locator('.van-toast', { hasText: '已生成' })).toBeVisible()
  // 四个餐卡(三餐 + 加餐)
  await expect(page.locator('.meal-header')).toHaveCount(4)
  await expect(page.locator('.meal-header', { hasText: '加餐' })).toBeVisible()
  // 三餐各至少一个条目(槽位 chip 存在),加餐为空态
  for (const label of ['早餐', '午餐', '晚餐']) {
    await expect(mealCard(page, label).locator('.slot-chip').first()).toBeVisible()
  }
  await expect(mealCard(page, '加餐').getByText('未记录')).toBeVisible()
  // 顶部合计进入统计态(三餐合计千卡量级,远离空态 0)
  expect(await readKcal(page)).toBeGreaterThanOrEqual(1000)
  // 按钮区切换为重新生成/清空
  await expect(page.getByRole('button', { name: '重新生成' })).toBeVisible()
  await expect(page.getByRole('button', { name: '清空', exact: true })).toBeVisible()
})

test('场景4:换菜定向——详情层换掉指定条目,其余条目不动', async ({ page }) => {
  await page.goto('/#/today')
  await page.getByRole('button', { name: '生成今日三餐' }).click()
  const lunchCard = mealCard(page, '午餐')
  await lunchCard.locator('.van-cell', { hasText: '主食' }).first().waitFor()
  const before = await lunchCard.locator('.van-cell', { hasText: '主食' }).first().innerText()
  await lunchCard.locator('.van-cell', { hasText: '主食' }).first().click()
  await expect(page.locator('.detail-title')).toBeVisible()
  await page.locator('.van-button', { hasText: '换一个' }).click()
  // 弹层关闭,同位置主食条目已换为其他食谱
  await expect(page.locator('.detail-title')).toBeHidden()
  const after = await lunchCard.locator('.van-cell', { hasText: '主食' }).first().innerText()
  expect(after).not.toBe(before)
})

test('场景5:添加菜品——搜索放开全库(非早餐灰标)、确认层营养、同食谱累加合并', async ({ page }) => {
  await page.goto('/#/today')
  // 白米饭 mealFit 为午/晚,早餐本不可见;有关键词时放开全库并带"非早餐"灰标
  await mealCard(page, '早餐').getByRole('button', { name: '+ 添加菜品' }).click()
  await page.locator('.van-search input').fill('白米饭')
  await expect(page.locator('.add-list .van-cell', { hasText: '白米饭' })).toBeVisible()
  await expect(page.locator('.add-list .van-cell', { hasText: '非早餐' })).toBeVisible()
  await page.locator('.add-list .van-cell', { hasText: '白米饭' }).click()
  await expect(page.locator('.detail-title', { hasText: '添加:白米饭' })).toBeVisible()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  // 精确档:基准份 70g 生米 → 242 千卡
  await expect(mealCard(page, '早餐').locator('.van-cell', { hasText: '白米饭' })).toBeVisible()
  await expect(mealCard(page, '早餐').locator('.van-cell', { hasText: '242 千卡' })).toBeVisible()

  // 再次添加同食谱 → 累加合并为一条,克数翻倍
  await mealCard(page, '早餐').getByRole('button', { name: '+ 添加菜品' }).click()
  await page.locator('.van-search input').fill('白米饭')
  await expect(page.locator('.add-list .van-cell', { hasText: '非早餐' })).toBeVisible()
  await page.locator('.add-list .van-cell', { hasText: '白米饭' }).click()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(page.locator('.van-toast', { hasText: '已累加:白米饭(共 140g' })).toBeVisible()
  await expect(mealCard(page, '早餐').locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)
  await expect(mealCard(page, '早餐').locator('.van-cell', { hasText: '484 千卡' })).toBeVisible()
})

test('场景6:打卡已吃——状态标记生效,已记录数值不变', async ({ page }) => {
  await page.goto('/#/today')
  await page.getByRole('button', { name: '生成今日三餐' }).click()
  await mealCard(page, '早餐').locator('.slot-chip').first().waitFor()
  const kcalBefore = await readKcal(page)
  await checkinMeal(page, '早餐', '已按计划吃')
  await expect(mealHeader(page, '早餐').locator('.van-tag', { hasText: '已吃' })).toBeVisible()
  await expect(mealCard(page, '早餐').getByRole('button', { name: '打卡 · 已吃 ✓' })).toBeVisible()
  // done 不改变已吃口径的合计(条目本来就计入)
  expect(await readKcal(page)).toBe(kcalBefore)
})

test('场景7:打卡跳过——该餐不计入顶部合计,出现跳过说明', async ({ page }) => {
  await page.goto('/#/today')
  await page.getByRole('button', { name: '生成今日三餐' }).click()
  await mealCard(page, '早餐').locator('.slot-chip').first().waitFor()
  const kcalBefore = await readKcal(page)
  // 早餐头部"实际 X / 目标 Y 千卡"解析出该餐实际值
  const headText = await mealHeader(page, '早餐').locator('.meal-target').innerText()
  const breakfastKcal = Number(headText.match(/实际 (\d+) \//)[1])
  await checkinMeal(page, '早餐', '这餐跳过了')
  await expect(page.getByText('已跳过的餐次不计入上方合计')).toBeVisible()
  // 精确档:合计恰好减少早餐实际值
  expect(await readKcal(page)).toBe(kcalBefore - breakfastKcal)
})

test('场景8a:清空保护——保留已吃餐分支', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: {
        __TODAY__: {
          breakfast: [RICE.item()],
          lunch: [RICE.item()],
          dinner: [],
          snack: [],
        },
      },
      templates: [],
    },
    checkin: { marks: { __TODAY__: { breakfast: 'done' } } },
  })
  await page.goto('/#/today')
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await expect(page.locator('.van-dialog', { hasText: `已打卡"已吃"` })).toBeVisible()
  await page.getByRole('button', { name: '保留已吃' }).click()
  await expect(page.locator('.van-toast', { hasText: '已清空,保留已吃的早餐' })).toBeVisible()
  // 早餐保留条目与"已吃"标记;午餐清空;打卡标记不悬挂到空餐
  await expect(mealCard(page, '早餐').locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)
  await expect(mealHeader(page, '早餐').locator('.van-tag', { hasText: '已吃' })).toBeVisible()
  await expect(mealCard(page, '午餐').getByText('未记录')).toBeVisible()
})

test('场景8b:清空保护——一并清空分支(打卡标记全清)', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: { __TODAY__: { breakfast: [RICE.item()], lunch: [RICE.item()], dinner: [], snack: [] } },
      templates: [],
    },
    checkin: { marks: { __TODAY__: { breakfast: 'done' } } },
  })
  await page.goto('/#/today')
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await page.getByRole('button', { name: '一并清空' }).click()
  await expect(page.locator('.van-toast', { hasText: '已清空' })).toBeVisible()
  for (const label of ['早餐', '午餐', '晚餐']) {
    await expect(mealCard(page, label).getByText('未记录')).toBeVisible()
  }
  await expect(mealHeader(page, '早餐').locator('.van-tag', { hasText: '已吃' })).toHaveCount(0)
})

test('场景9:重生成保护——保留已吃餐,其余重新生成', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__TODAY__',
      days: { __TODAY__: { breakfast: [RICE.item()], lunch: [RICE.item()], dinner: [], snack: [] } },
      templates: [],
    },
    checkin: { marks: { __TODAY__: { breakfast: 'done' } } },
  })
  await page.goto('/#/today')
  await page.getByRole('button', { name: '重新生成' }).click()
  await expect(page.locator('.van-dialog', { hasText: `已打卡"已吃"` })).toBeVisible()
  await page.getByRole('button', { name: '保留已吃' }).click()
  await expect(page.locator('.van-toast', { hasText: '已重新生成,保留已吃的早餐' })).toBeVisible()
  // 早餐原样保留(白米饭),其余餐重新生成有内容
  await expect(mealCard(page, '早餐').locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)
  await expect(mealCard(page, '晚餐').locator('.slot-chip').first()).toBeVisible()
  // "已吃"标记仍在已保留的餐上
  await expect(mealHeader(page, '早餐').locator('.van-tag', { hasText: '已吃' })).toBeVisible()
})

test('场景10:加餐槽——全库可选、计入全天合计、重新生成保留', async ({ page }) => {
  await page.goto('/#/today')
  await mealCard(page, '加餐').getByRole('button', { name: '+ 添加菜品' }).click()
  await page.locator('.van-search input').fill('白米饭')
  // 加餐弹层:任何食谱可选,无"非加餐"灰标
  await expect(page.locator('.add-list .van-cell', { hasText: '非加餐' })).toHaveCount(0)
  await page.locator('.add-list .van-cell', { hasText: '白米饭' }).click()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  const snackCard = mealCard(page, '加餐')
  // 精确档:70g 生米 = 242 千卡/蛋白 5g(242/1882 → 低 87%)
  await expect(mealHeader(page, '加餐').locator('.meal-target')).toContainText('实际 242 千卡 · 蛋白 5g · 不占三餐目标')
  await expect(page.locator('.kcal-num')).toHaveText('242')
  await expect(page.locator('.kcal-chip')).toHaveText('低 87%')
  // 有数据后生成按钮变"重新生成";重新生成三餐而加餐(手动记录)保留
  await page.getByRole('button', { name: '重新生成' }).click()
  await expect(page.locator('.van-toast', { hasText: '已生成' })).toBeVisible()
  await expect(snackCard.locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)
  await expect(mealCard(page, '晚餐').locator('.slot-chip').first()).toBeVisible()
})

test('场景11a:复制昨日——目标餐为空直接复制', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__YESTERDAY__',
      days: { __YESTERDAY__: { breakfast: [], lunch: [], dinner: [RICE.item()], snack: [] } },
      templates: [],
    },
  })
  await page.goto('/#/today')
  await mealCard(page, '晚餐').getByRole('button', { name: '复制昨日' }).click()
  await expect(page.locator('.van-toast', { hasText: '已复制昨日晚餐 1 个菜品' })).toBeVisible()
  await expect(mealCard(page, '晚餐').locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)
})

test('场景11b:复制昨日——目标餐已有菜品时可选追加', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__YESTERDAY__',
      days: {
        __YESTERDAY__: { breakfast: [], lunch: [], dinner: [RICE.item()], snack: [] },
        __TODAY__: { breakfast: [], lunch: [], dinner: [RICE.item()], snack: [] },
      },
      templates: [],
    },
  })
  await page.goto('/#/today')
  await mealCard(page, '晚餐').getByRole('button', { name: '复制昨日' }).click()
  await page.locator('.van-action-sheet__item', { hasText: '追加到现有菜品后' }).click()
  await expect(page.locator('.van-toast', { hasText: '已追加昨日晚餐 1 个菜品' })).toBeVisible()
  await expect(mealCard(page, '晚餐').locator('.van-cell', { hasText: '白米饭' })).toHaveCount(2)
})

test('场景11c:复制昨日——覆盖分支清打卡标记', async ({ page }) => {
  await injectState(page, {
    profile: DEFAULT_PROFILE,
    week: {
      weekStart: '__YESTERDAY__',
      days: {
        __YESTERDAY__: { breakfast: [], lunch: [], dinner: [RICE.item()], snack: [] },
        __TODAY__: {
          breakfast: [],
          lunch: [],
          dinner: [RICE.item(), RICE.item()],
          snack: [],
        },
      },
      templates: [],
    },
    checkin: { marks: { __TODAY__: { dinner: 'done' } } },
  })
  await page.goto('/#/today')
  await expect(mealHeader(page, '晚餐').locator('.van-tag', { hasText: '已吃' })).toBeVisible()
  await mealCard(page, '晚餐').getByRole('button', { name: '复制昨日' }).click()
  await page.locator('.van-action-sheet__item', { hasText: '覆盖现有菜品' }).click()
  await expect(page.locator('.van-toast', { hasText: '已覆盖为昨日晚餐 1 个菜品' })).toBeVisible()
  // 条目替换为昨日的 1 条,且"已吃"标记不再悬挂在新内容上
  await expect(mealCard(page, '晚餐').locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)
  await expect(mealHeader(page, '晚餐').locator('.van-tag', { hasText: '已吃' })).toHaveCount(0)
})

test('场景25:动态加餐槽——再加一餐/计入合计/详情无换菜/重生成保留/删槽', async ({ page }) => {
  await page.goto('/#/today')
  // 再加一餐:出现"加餐 2"卡并自动打开添加弹层(全库可选,snack 语义)
  await page.getByRole('button', { name: '+ 再加一餐' }).click()
  const emCard = mealCard(page, '加餐 2')
  await expect(page.locator('.van-search input')).toBeVisible()
  await page.locator('.van-search input').fill('白米饭')
  await page.locator('.add-list .van-cell', { hasText: '白米饭' }).click()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  // 槽内条目与头部口径(不占三餐目标),顶部合计含动态槽
  await expect(emCard.locator('.van-cell', { hasText: '白米饭' })).toBeVisible()
  await expect(mealHeader(page, '加餐 2')).toContainText('实际 242 千卡 · 蛋白 5g · 不占三餐目标')
  await expect(page.locator('.kcal-num')).toHaveText('242')

  // 详情层无"换菜"按钮(无餐次目标),可移除/改克数
  // (先等添加确认弹层关闭动画结束,否则两个 detail-title 同屏触发 strict 冲突)
  await expect(page.locator('.detail-title', { hasText: '添加:' })).toBeHidden()
  await emCard.locator('.van-cell', { hasText: '白米饭' }).click()
  await expect(page.locator('.detail-title', { hasText: '白米饭' }).first()).toBeVisible()
  await expect(page.locator('.van-button', { hasText: '换一个' })).toHaveCount(0)
  await page.keyboard.press('Escape') // 关闭详情弹层(遮罩挡住了页面按钮)

  // 重新生成三餐(无已吃锁定直接重生成):动态槽是手动记录,原样保留
  // (加餐卡把按钮区推出视口、又被 fixed tabbar 遮挡,locator click 过不了
  //  actionability——evaluate 派发原生 click,项目记忆既有解法)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('重新生成'))
    btn.click()
  })
  await expect(page.locator('.van-toast', { hasText: '已生成' })).toBeVisible()
  await expect(emCard.locator('.van-cell', { hasText: '白米饭' })).toHaveCount(1)
  await expect(mealCard(page, '晚餐').locator('.slot-chip').first()).toBeVisible()

  // 删除槽:确认弹窗 → 卡消失,合计恰好减去该槽 242 千卡(三餐保留)。图标同样在遮挡区,evaluate 派发
  const kcalBeforeDel = await readKcal(page)
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('.van-cell-group__title--inset')].find((x) =>
      x.textContent.includes('加餐 2')
    )
    h.querySelector('.em-del').click()
  })
  await page.getByRole('button', { name: '确认' }).click()
  await expect(page.locator('.van-toast', { hasText: '已删除' })).toBeVisible()
  await expect(mealCard(page, '加餐 2')).toHaveCount(0)
  expect(await readKcal(page)).toBe(kcalBeforeDel - 242)
})
