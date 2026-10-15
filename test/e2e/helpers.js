// E2E 共通:状态注入与选择器工具。
// 每个测试用 Playwright 独立浏览器上下文,与日常浏览器 localStorage 物理隔离,
// 测试数据一律注入,全程不碰真实数据(TEST_PLAN §6 纪律 2)。

// 与 profile store defaults 一致的档案:70kg 男 30 岁 175cm 轻度活动 cut
export const DEFAULT_PROFILE = {
  gender: 'male',
  age: 30,
  height: 175,
  weight: 70,
  targetWeight: null,
  activity: 1.375,
  mode: 'cut',
  macroPreset: 'cut',
  manualKcal: null,
  proteinPerKg: 2.0,
  fatRatio: 0.25,
  mealSplit: [0.25, 0.45, 0.3],
  excludedTags: [],
  configured: true,
}

// 默认档案的公式手算锚点(Mifflin-St Jeor → TDEE → cut -17%),勿随意改动:
// BMR=10×70+6.25×175−5×30+5=1648.75;TDEE=×1.375=2267.03;kcal=×0.83=1881.64;
// protein=70×2.0=140;fat=1881.64×0.25/9=52.3;carbs=(1881.64−560−470.41)/4=212.8
export const ANCHOR = {
  bmr: '1649',
  tdee: '2267',
  kcal: '1882',
  protein: '140',
  breakfast: '470 千卡 · 蛋白 35g',
  lunch: '847 千卡 · 蛋白 63g',
  dinner: '564 千卡 · 蛋白 42g',
}

// 白米饭(r_rice)基准份 70g 生米的营养(computeNutrition 后:f_rice 346kcal/7.4P 每 100g)
export const RICE = { kcal: 242, item: () => ({ recipeId: 'r_rice', slot: 'staple', ingredients: [{ foodId: 'f_rice', grams: 70, scalable: true }] }) }

/** 注入 localStorage 状态(须在 page.goto 前调用;同一 page 可多次调用,按调用序叠加)。
 *  week/checkin 数据中的 __TODAY__/__YESTERDAY__ 占位符在浏览器侧替换为真实日期,
 *  测试代码无需关心今天是几号。
 *  幂等哨兵:addInitScript 每次导航(含应用自行 reload)都会重跑,不设哨卫的话
 *  "恢复默认"清掉的数据会在 reload 时被重新注入,破坏备份/重置类场景;
 *  哨兵按调用序号独立(支持 beforeEach+testBody 两段注入),key 不带 cookbook:
 *  前缀,不会被应用读写、不会进备份文件 */
let injectSeq = 0
export async function injectState(page, { profile, week, checkin } = {}) {
  const state = { __seq: ++injectSeq, profile, week, checkin }
  await page.addInitScript((s) => {
    const guardKey = `__e2e_inj_${s.__seq}`
    if (localStorage.getItem(guardKey)) return
    const pad = (n) => String(n).padStart(2, '0')
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const today = fmt(new Date())
    const yesterday = fmt(y)
    const patch = (v) =>
      JSON.parse(JSON.stringify(v).replaceAll('__TODAY__', today).replaceAll('__YESTERDAY__', yesterday))
    if (s.profile) localStorage.setItem('cookbook:profile', JSON.stringify(patch(s.profile)))
    if (s.week) localStorage.setItem('cookbook:week', JSON.stringify(patch(s.week)))
    if (s.checkin) localStorage.setItem('cookbook:checkin', JSON.stringify(patch(s.checkin)))
    localStorage.setItem(guardKey, '1')
  }, state)
}

/** 定位某个餐次卡 body(条目区)。
 *  Vant 的 #title 插槽渲染为 cell-group 的兄弟节点(.van-cell-group__title 不在
 *  .van-cell-group div 内),不能按"含标题的 group"过滤——取标题节点之后第一个
 *  inset group 兄弟 */
export function mealCard(page, label) {
  return page
    .locator('.van-cell-group__title--inset', { hasText: label })
    .locator('xpath=following-sibling::div[contains(@class,"van-cell-group--inset")][1]')
}

/** 定位某餐的头部节点(餐名/实际目标汇总/打卡 tag 都在 title 节点内) */
export function mealHeader(page, label) {
  return page.locator('.van-cell-group__title--inset', { hasText: label })
}

/** 读顶部实际热量合计(.kcal-num) */
export async function readKcal(page) {
  return Number(await page.locator('.kcal-num').innerText())
}

/** 打卡:点某餐打卡按钮并选 action-sheet 选项(已按计划吃/这餐跳过了/清除打卡) */
export async function checkinMeal(page, mealLabel, action) {
  await mealCard(page, mealLabel).getByRole('button', { name: /打卡 · / }).click()
  await page.locator('.van-action-sheet__item', { hasText: action }).click()
  await expectTag(page, mealLabel, action)
}

/** 打卡后的状态标记断言(tag 文本;tag 在头部节点内) */
async function expectTag(page, mealLabel, action) {
  const tagText = action === '已按计划吃' ? '已吃' : action === '这餐跳过了' ? '跳过' : null
  if (tagText) {
    await mealHeader(page, mealLabel).locator('.van-tag', { hasText: tagText }).first().waitFor()
  }
}
