// 核心算法验证:npm run verify
// 覆盖:BMR/TDEE 公式手算对照、食谱食材引用完整性、随机组装收敛性、
// 排除过滤、换菜、周计划生成、采购清单聚合、日期工具。生成结果含随机性,
// 连续跑可观察稳定性。
import { calcTargets } from '../src/core/nutrition.js'
import {
  generateDayPlan,
  generateWeekPlan,
  buildShoppingList,
  summarizeDay,
  computeNutrition,
  swapSlotItem,
} from '../src/core/planner.js'
import { FOODS, FOODS_MAP } from '../src/data/foods.js'
import { RECIPES, RECIPES_MAP } from '../src/data/recipes.js'
import { addDays, weekStartOf, todayStr } from '../src/utils/date.js'

let failed = 0
const check = (name, cond, detail = '') => {
  if (cond) {
    console.log(`PASS  ${name}`)
  } else {
    failed++
    console.error(`FAIL  ${name}  ${detail}`)
  }
}

// ---------- 1. nutrition 公式手算对照 ----------
// 男 30岁 175cm 70kg 轻度(1.375) 减脂(-17%):
// BMR = 700+1093.75-150+5 = 1648.75; TDEE = 2267.03; 目标 = 1881.63
const t = calcTargets({ gender: 'male', age: 30, height: 175, weight: 70, activity: 1.375, mode: 'cut' })
check('BMR Mifflin-St Jeor', Math.abs(t.bmr - 1649) <= 1, `got ${t.bmr}`)
check('TDEE', Math.abs(t.tdee - 2267) <= 1, `got ${t.tdee}`)
check('减脂目标热量', Math.abs(t.kcal - 1882) <= 2, `got ${t.kcal}`)
check('蛋白 1.8g/kg', Math.abs(t.protein - 126) < 0.01, `got ${t.protein}`)
// 脂肪 = 1882*0.25/9 = 52.3;碳水 = (1882-126*4-52.3*9)/4 ≈ 227
check('脂肪 25% 热量占比', Math.abs(t.fat - 52.3) < 0.5, `got ${t.fat}`)
check('碳水补齐', Math.abs(t.carbs - 227) < 2, `got ${t.carbs}`)
check('三餐分配 30/40/30', Math.abs(t.meals[1].kcal - t.kcal * 0.4) < 1)

// 女性公式:BMR = 10W+6.25H-5A-161
const t2 = calcTargets({ gender: 'female', age: 30, height: 162, weight: 55, activity: 1.2, mode: 'maintain' })
// 550+1012.5-150-161 = 1251.5;TDEE = 1501.8
check('女性 BMR', Math.abs(t2.bmr - 1252) <= 1, `got ${t2.bmr}`)

// ---------- 2. 数据引用完整性 ----------
const badRefs = []
for (const r of RECIPES) {
  if (!r.slot || !r.mealFit?.length) badRefs.push(`${r.id}: slot/mealFit 缺失`)
  for (const ing of r.ingredients) {
    if (!FOODS_MAP[ing.foodId]) badRefs.push(`${r.id}: 食材 ${ing.foodId} 不存在`)
    if (!(ing.grams > 0)) badRefs.push(`${r.id}: ${ing.foodId} 克数异常`)
  }
}
check('食谱食材引用完整', badRefs.length === 0, badRefs.join('; '))

// 营养参考:成分表 kcal 按 蛋白4/脂肪9/可利用碳水4/膳食纤维≈2 计,高纤维蔬菜
// 的 4P+4C+9F 会系统性偏高,阈值取 50% 用于抓数量级手误而非学术精度
const badKcal = FOODS.filter((f) => {
  const calc = f.protein * 4 + f.carbs * 4 + f.fat * 9
  return Math.abs(calc - f.kcal) / Math.max(f.kcal, 1) > 0.5
})
check('食材热量与三大营养素自洽', badKcal.length === 0, badKcal.map((f) => `${f.name}: ${f.kcal} vs ${Math.round(f.protein * 4 + f.carbs * 4 + f.fat * 9)}`).join('; '))

// 每个槽位 × 每餐(模板需要)至少有一个非排除候选
const { MEAL_TEMPLATES } = await import('../src/core/planner.js')
const holes = []
for (const [meal, slots] of Object.entries(MEAL_TEMPLATES)) {
  for (const slot of slots) {
    const n = RECIPES.filter((r) => r.slot === slot && r.mealFit.includes(meal)).length
    if (n === 0) holes.push(`${meal}/${slot}`)
  }
}
check('每餐每槽位有候选食谱', holes.length === 0, holes.join(', '))

// ---------- 3. 生成计划端到端 ----------
const targets = calcTargets({ gender: 'male', age: 30, height: 175, weight: 70, activity: 1.375, mode: 'cut' })
const plan = generateDayPlan({ recipes: RECIPES, foods: FOODS_MAP, targets, excludedTags: [], date: '2026-10-13' })

const nullSlots = []
for (const [meal, items] of Object.entries(plan.meals)) {
  items.forEach((it, i) => {
    if (!it) nullSlots.push(`${meal}[${i}]`)
    else if (!RECIPES_MAP[it.recipeId]) nullSlots.push(`${meal}[${i}] 食谱不存在`)
  })
}
check('全天计划无空槽位', nullSlots.length === 0, nullSlots.join(', '))

const s = summarizeDay(plan, FOODS_MAP, targets)
console.log(`      全天合计: ${s.totals.kcal} kcal (目标 ${targets.kcal}, 偏差 ${s.diff.kcal}%), 蛋白 ${s.totals.protein}g (目标 ${targets.protein}g, 偏差 ${s.diff.protein}%)`)
check('热量偏差在 ±15% 内', Math.abs(s.diff.kcal) <= 15)
check('蛋白偏差在 -10%~+40% 内(蛋白槽合格池允许90%交付,营养学无害)', s.diff.protein >= -10 && s.diff.protein <= 40)

// 多组画像收敛性:不同目标下偏差都可接受
const profiles = [
  { gender: 'female', age: 26, height: 162, weight: 52, activity: 1.2, mode: 'cut' },
  { gender: 'male', age: 35, height: 180, weight: 85, activity: 1.55, mode: 'bulk' },
  { gender: 'male', age: 28, height: 172, weight: 78, activity: 1.725, mode: 'maintain' },
]
for (const p of profiles) {
  const tg = calcTargets(p)
  const pl = generateDayPlan({ recipes: RECIPES, foods: FOODS_MAP, targets: tg, excludedTags: [], date: 'test' })
  const sm = summarizeDay(pl, FOODS_MAP, tg)
  console.log(`      ${p.gender}/${p.weight}kg/${p.mode}: ${sm.totals.kcal} vs ${tg.kcal} (${sm.diff.kcal}%), 蛋白 ${sm.totals.protein} vs ${tg.protein} (${sm.diff.protein}%)`)
  check(`${p.mode} 画像热量偏差 ±20%`, Math.abs(sm.diff.kcal) <= 20)
}

// ---------- 4. 排除过滤 ----------
const planEx = generateDayPlan({
  recipes: RECIPES, foods: FOODS_MAP, targets,
  excludedTags: ['pork', 'seafood', 'egg', 'milk', 'soy'], date: 'test-ex',
})
const usedEx = Object.values(planEx.meals).flat().filter(Boolean).map((it) => it.recipeId)
const leak = usedEx.filter((id) => RECIPES_MAP[id].tags.some((t) => ['pork', 'seafood', 'egg', 'milk', 'soy'].includes(t)))
check('排除项过滤生效', leak.length === 0, `泄漏: ${leak.join(', ')}`)

// ---------- 5. 换菜 ----------
const swapResult = swapSlotItem('lunch', 'protein', plan.meals.lunch.find((i) => i.slot === 'protein').recipeId, {
  recipes: RECIPES, foods: FOODS_MAP,
  target: targets.meals.find((m) => m.key === 'lunch'), excludedTags: [], usedIds: new Set(),
})
check('换菜返回不同食谱', swapResult && swapResult.recipeId !== plan.meals.lunch.find((i) => i.slot === 'protein').recipeId)

// ---------- 6. computeNutrition 基准校验 ----------
const chicken = computeNutrition([{ foodId: 'f_chicken_breast', grams: 150 }], FOODS_MAP)
check('150g 鸡胸 ≈ 200kcal/33g 蛋白', chicken.kcal === 200 && Math.abs(chicken.protein - 33) < 0.5, `got ${chicken.kcal}/${chicken.protein}`)

// ---------- 7. 日期工具 ----------
check('addDays 跨月', addDays('2026-10-30', 3) === '2026-11-02')
check('weekStartOf 周中', weekStartOf('2026-10-13') === '2026-10-12') // 2026-10-13 是周二
check('weekStartOf 周日归上周', weekStartOf('2026-10-18') === '2026-10-12') // 周日
check('weekStartOf 周一', weekStartOf('2026-10-12') === '2026-10-12')
check('todayStr 格式', /^\d{4}-\d{2}-\d{2}$/.test(todayStr()))

// ---------- 8. 周计划生成 ----------
const weekPlan = generateWeekPlan({
  recipes: RECIPES,
  foods: FOODS_MAP,
  targets,
  excludedTags: [],
  weekStart: '2026-10-12',
})
const weekNulls = []
for (const [date, meals] of Object.entries(weekPlan)) {
  for (const [meal, items] of Object.entries(meals)) {
    items.forEach((it, i) => {
      if (!it) weekNulls.push(`${date}/${meal}[${i}]`)
    })
  }
}
check('一周 7 天无空槽位', Object.keys(weekPlan).length === 7 && weekNulls.length === 0, weekNulls.join(', '))

// 跨天多样性:同一食谱在周内出现的最大次数
const weekUseCount = {}
for (const meals of Object.values(weekPlan)) {
  for (const items of Object.values(meals)) {
    for (const it of items) {
      if (it) weekUseCount[it.recipeId] = (weekUseCount[it.recipeId] || 0) + 1
    }
  }
}
const maxReuse = Math.max(...Object.values(weekUseCount))
const distinctRecipes = Object.keys(weekUseCount).length
console.log(`      一周共用 ${distinctRecipes} 种食谱,单食谱最大复用 ${maxReuse} 次(每周 63 个槽位,库共 ${RECIPES.length} 个)`)
check('单食谱周内复用不超过 3 次', maxReuse <= 3, `max=${maxReuse}`)

// 周内每天热量都在合理范围
let worstDev = 0
for (const [date, meals] of Object.entries(weekPlan)) {
  const sm = summarizeDay({ date, meals }, FOODS_MAP, targets)
  worstDev = Math.max(worstDev, Math.abs(sm.diff.kcal))
}
check('一周每天热量偏差均 ≤20%', worstDev <= 20, `worst=${Math.round(worstDev)}%`)

// ---------- 9. 采购清单聚合 ----------
const manualDays = {
  '2026-10-12': weekPlan['2026-10-12'],
  '2026-10-13': weekPlan['2026-10-13'],
}
const list = buildShoppingList(manualDays, FOODS_MAP)
// 手动对照:逐食材累加克数,并统计真实出现天数
const expect = new Map()
const expectDays = new Map()
for (const [date, meals] of Object.entries(manualDays)) {
  const dayAgg = new Map()
  for (const items of Object.values(meals)) {
    for (const it of items) {
      if (!it) continue
      for (const ing of it.ingredients) {
        dayAgg.set(ing.foodId, (dayAgg.get(ing.foodId) || 0) + ing.grams)
      }
    }
  }
  if (!expectDays.get('meta')) expectDays.set('meta', new Map())
  for (const [id, g] of dayAgg) {
    expect.set(id, (expect.get(id) || 0) + g)
    const s = expectDays.get('meta').get(id) || new Set()
    s.add(date)
    expectDays.get('meta').set(id, s)
  }
}
const daysMap = expectDays.get('meta')
const listOk =
  list.length === expect.size &&
  list.every(
    (f) => f.grams === Math.round(expect.get(f.foodId)) && f.days === daysMap.get(f.foodId).size
  )
check('采购清单克数聚合与出现天数正确', listOk,
  `list=${list.length} expect=${expect.size}`)

const fullList = buildShoppingList(weekPlan, FOODS_MAP)
check('整周清单条目合理(10-90 种)', fullList.length >= 10 && fullList.length <= 90, `got ${fullList.length}`)
check('清单含蛋白质类食材', fullList.some((f) => f.category === 'meat' || f.category === 'seafood'))

// ---------- 10. 抗炎标注 ----------
const antiFoods = FOODS.filter((f) => f.antiInfl)
check('抗炎食材数量合理(40-90)', antiFoods.length >= 40 && antiFoods.length <= 90, `got ${antiFoods.length}`)
const antiRecipes = RECIPES.filter((r) => r.antiInfl)
const antiSlots = new Set(antiRecipes.map((r) => r.slot))
check('抗炎食谱存在且覆盖多槽位', antiRecipes.length >= 15 && antiSlots.size >= 4, `got ${antiRecipes.length} 个,槽位 ${[...antiSlots].join(',')}`)
// 派生规则抽查:单品西兰花(200g 抗炎主料)应标;白灼虾(无抗炎食材)不应标
check('水煮西兰花应为抗炎', RECIPES_MAP['r_broccoli_boiled']?.antiInfl === true)
check('白灼虾应不标抗炎', RECIPES_MAP['r_boiled_shrimp']?.antiInfl === false)
check('清蒸三文鱼应为抗炎', RECIPES_MAP['r_pan_fried_salmon']?.antiInfl === true)

// ---------- 11. 营养小贴士 ----------
const { TIPS } = await import('../src/data/tips.js')
const badTips = TIPS.filter((t) => !t.id || !t.title || !t.body || t.body.length < 10)
check('小贴士数量合理且字段完整(10-20 条)', TIPS.length >= 10 && TIPS.length <= 20 && badTips.length === 0,
  badTips.map((t) => t.id).join(','))
const tipIds = new Set(TIPS.map((t) => t.id))
check('小贴士 id 无重复', tipIds.size === TIPS.length)

// ---------- 12. 宏量预设 ----------
const { MACRO_PRESETS, MODE_PRESET } = await import('../src/core/nutrition.js')
const badPresets = MACRO_PRESETS.filter(
  (p) =>
    (p.value !== 'custom' &&
      (!(p.proteinPerKg >= 1.0 && p.proteinPerKg <= 2.5) || !(p.fatRatio >= 0.15 && p.fatRatio <= 0.35)))
)
check('宏量预设数值在安全区间', badPresets.length === 0, badPresets.map((p) => p.value).join(','))
check('模式联动映射完整', ['cut', 'maintain', 'bulk'].every((m) => MACRO_PRESETS.some((p) => p.value === MODE_PRESET[m])))
// 抽查:套用 cut 预设后目标计算的蛋白符合预期
const cutPreset = MACRO_PRESETS.find((p) => p.value === 'cut')
const tCut = calcTargets({ gender: 'male', age: 30, height: 175, weight: 70, activity: 1.375, mode: 'cut', proteinPerKg: cutPreset.proteinPerKg, fatRatio: cutPreset.fatRatio })
check('减脂预设蛋白 = 2.0g/kg × 70 = 140g', Math.abs(tCut.protein - 140) < 0.01, `got ${tCut.protein}`)

// ---------- 13. 自定义编辑(基准份构造) ----------
const { makeBaselineItem } = await import('../src/core/planner.js')
const baseline = makeBaselineItem(RECIPES_MAP['r_pan_fried_chicken'])
const baseOk =
  baseline.recipeId === 'r_pan_fried_chicken' &&
  baseline.slot === 'protein' &&
  baseline.ingredients.length === RECIPES_MAP['r_pan_fried_chicken'].ingredients.length &&
  baseline.ingredients[0].grams === 150 // 基准克数,未缩放
check('makeBaselineItem 返回基准份且不缩放', baseOk, JSON.stringify(baseline))
const baselineNutrition = computeNutrition(baseline.ingredients, FOODS_MAP)
check('基准份营养 = 150g鸡胸+5g油 ≈ 244千卡', baselineNutrition.kcal === 244, `got ${baselineNutrition.kcal}`)

console.log(failed === 0 ? '\n全部通过 ✓' : `\n${failed} 项失败 ✗`)
process.exit(failed === 0 ? 0 : 1)
