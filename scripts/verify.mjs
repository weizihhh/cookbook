// 核心算法验证:npm run verify
// 覆盖:BMR/TDEE 公式手算对照、食谱食材引用完整性、随机组装收敛性、
// 排除过滤、换菜。生成结果含随机性,连续跑可观察稳定性。
import { calcTargets } from '../src/core/nutrition.js'
import { generateDayPlan, summarizeDay, computeNutrition, swapSlotItem } from '../src/core/planner.js'
import { FOODS, FOODS_MAP } from '../src/data/foods.js'
import { RECIPES, RECIPES_MAP } from '../src/data/recipes.js'

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
check('蛋白偏差在 -5%~+40% 内(蛋白宁多勿少)', s.diff.protein >= -5 && s.diff.protein <= 40)

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

console.log(failed === 0 ? '\n全部通过 ✓' : `\n${failed} 项失败 ✗`)
process.exit(failed === 0 ? 0 : 1)
