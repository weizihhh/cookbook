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
check('三餐分配 25/45/30', Math.abs(t.meals[1].kcal - t.kcal * 0.45) < 1)

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

// 生成偏好:传 recentIds 时三餐全部选自该池(池内每餐每槽位有足量候选)
{
  const pool = []
  for (const meal of ['breakfast', 'lunch', 'dinner']) {
    for (const slot of ['staple', 'protein', 'vegetable', 'fruit']) {
      pool.push(
        ...RECIPES.filter((r) => r.slot === slot && r.mealFit.includes(meal))
          .slice(0, 4)
          .map((r) => r.id)
      )
    }
  }
  const ids = new Set(pool)
  let allFromPool = true
  for (let i = 0; i < 5; i++) {
    const pl = generateDayPlan({ recipes: RECIPES, foods: FOODS_MAP, targets, excludedTags: [], date: 'test-recent', recentIds: pool })
    for (const it of Object.values(pl.meals).flat()) {
      if (it && !ids.has(it.recipeId)) allFromPool = false
    }
  }
  check('生成偏好:三餐全部来自最近吃过池', allFromPool)
}

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

// ---------- 14. 添加菜品累加 ----------
const { addItemToMeal } = await import('../src/core/planner.js')
const meals4 = {
  breakfast: [{ recipeId: 'r_boiled_egg', slot: 'protein', ingredients: [{ foodId: 'f_egg', grams: 100, scalable: true }] }],
}
const r1 = addItemToMeal(meals4, 'breakfast', RECIPES_MAP['r_boiled_egg'])
check('重复添加返回 merged', r1 === 'merged')
const eggGrams = meals4.breakfast[0].ingredients[0].grams
check('两次鸡蛋累加为 200g(约4个)', eggGrams === 200, `got ${eggGrams}`)
const r2 = addItemToMeal(meals4, 'breakfast', RECIPES_MAP['r_banana_one'])
check('新菜品返回 added 且条目+1', r2 === 'added' && meals4.breakfast.length === 2)
const eggOnly = computeNutrition(meals4.breakfast[0].ingredients, FOODS_MAP)
check('200g 鸡蛋 ≈ 26.6g 蛋白(4个鸡蛋)', Math.abs(eggOnly.protein - 26.6) < 0.1, `got ${eggOnly.protein}`)

// ---------- 15. 生活单位 ----------
const { formatFoodAmount } = await import('../src/data/foods.js')
const unitFoods = FOODS.filter((f) => f.unit)
check('带单位食材数量合理(15-25)', unitFoods.length >= 15 && unitFoods.length <= 25, `got ${unitFoods.length}`)
const badUnit = unitFoods.filter((f) => !(f.unitGrams >= 10 && f.unitGrams <= 500))
check('单位换算克数在合理区间', badUnit.length === 0, badUnit.map((f) => f.name).join(','))
check('4 个鸡蛋显示', formatFoodAmount(FOODS_MAP['f_egg'], 200) === '4个(200g)')
check('无单位食材显示纯克数', formatFoodAmount(FOODS_MAP['f_chicken_breast'], 150) === '150g')
check('带克数添加(4个鸡蛋=200g)', (() => {
  meals4.lunch = []
  const r = addItemToMeal(meals4, 'lunch', RECIPES_MAP['r_boiled_egg'], [{ foodId: 'f_egg', grams: 200, scalable: true }])
  return r === 'added' && meals4.lunch[0].ingredients[0].grams === 200
})())

// ---------- 16. 营养成分表解析(labelScan)与自定义食物 ----------
const { parseNutritionLabel, normalizeTo100g, kjToKcal } = await import('../src/core/labelScan.js')

const label100g = `营养成分表
项目 每100g NRV%
能量 1600千焦 19%
蛋白质 8.0克 13%
脂肪 15.2克 25%
碳水化合物 62.0克 21%
钠 400毫克 20%`
const p1 = parseNutritionLabel(label100g)
check('成分表:识别每100g口径', p1?.basis === '100g', JSON.stringify(p1))
check('成分表:能量/三大营养素提取(NRV% 不干扰)', p1?.energyKj === 1600 && p1?.protein === 8 && p1?.carbs === 62 && p1?.fat === 15.2, JSON.stringify(p1))
check('kJ→kcal 换算', kjToKcal(1600) === 382.4, `got ${kjToKcal(1600)}`)
const n1 = normalizeTo100g(p1)
check('每100g 归一不改变数值', n1.kcal === 382.4 && n1.protein === 8 && n1.fat === 15.2)

const labelServe = `营养成分表 每份30g
能量 500kJ 6%
蛋白质 3.0g 5%
脂肪 4.5g 8%
碳水化合物 22.5g 8%`
const p2 = parseNutritionLabel(labelServe)
check('成分表:识别每份口径与克数', p2?.basis === 'perServe' && p2?.perServeGrams === 30, JSON.stringify(p2))
const n2 = normalizeTo100g(p2)
check('每份30g 归一到每100g(×100/30)', n2?.protein === 10 && n2?.carbs === 75 && n2?.fat === 15 && n2?.kcal === 398.3, JSON.stringify(n2))
const p2b = parseNutritionLabel('每份\n能量 500kJ\n蛋白质 3.0g\n脂肪 4.5g\n碳水化合物 22.5g')
check('每份缺克数时归一返回 null(走人工补填)', normalizeTo100g(p2b) === null && normalizeTo100g(p2b, 25)?.protein === 12)

const p3 = parseNutritionLabel('每100ml\n能量 180千焦\n蛋白质 3.2g\n脂肪 3.5g\n碳水化合物 4.8g')
check('每100mL 口径按 1:1 近似', p3?.basis === '100ml' && normalizeTo100g(p3)?.protein === 3.2)

const p4 = parseNutritionLabel(`能量 1600千焦 19%
蛋白质 8.0克 13%
饱和脂肪 3.0克
反式脂肪 0克`)
check('细分脂肪行不误取主行:反式/饱和不抢主行,仅退化时取饱和', p4?.fat === 3 && p4?.carbs === null, JSON.stringify(p4))
check('垃圾文本返回 null(走纯手填)', parseNutritionLabel('随便一段话,没有营养数值') === null)

// 真实 OCR 输出样本:中文逐字识别带字间空格、"千焦"认成"干焦"、数字前混入智能引号
const labelOcr = `营养 成 分 表
项 目 每 100g NRV%
能 量 1600 干 焦 19%
蛋白 质 ”8.0 克 13%
脂肪 15.2 克 25%
碳水 化 合 物 62.0 克 21%
钠 400 毫 克 20%`
const p5 = parseNutritionLabel(labelOcr)
check('OCR 噪声样本(字间空格/干焦/引号)仍可解析', p5?.energyKj === 1600 && p5?.protein === 8 && p5?.carbs === 62 && p5?.fat === 15.2, JSON.stringify(p5))

// 自定义食物伪食谱与既有链路
const { buildCustomRecipe } = await import('../src/stores/customFoods.js')
const cfFood = { id: 'cf_verify', name: '测试面包', kcal: 250, protein: 9, carbs: 45, fat: 4, source: '山姆' }
const cfRecipe = buildCustomRecipe(cfFood)
const crOk =
  cfRecipe.slot === 'custom' &&
  cfRecipe.custom === true &&
  cfRecipe.mealFit.length === 3 &&
  cfRecipe.ingredients[0].grams === 100
check('伪食谱:槽位 custom/三餐可用/基准份100g', crOk, JSON.stringify(cfRecipe))
check('组装池(种子 RECIPES)不含 custom 槽位', RECIPES.every((r) => r.slot !== 'custom'))

// 注册进 MAP 后,营养计算/加餐累加/采购清单隔离走既有链路
FOODS_MAP['cf_verify'] = cfFood
const cfNutrition = computeNutrition(cfRecipe.ingredients, FOODS_MAP)
check('伪食谱营养 = 食物每百克数值', cfNutrition.kcal === 250 && cfNutrition.protein === 9, JSON.stringify(cfNutrition))
const meals5 = { breakfast: [] }
addItemToMeal(meals5, 'breakfast', cfRecipe, [{ foodId: 'cf_verify', grams: 120, scalable: true }])
const addedCustom = meals5.breakfast[0]
check('加餐条目带 custom 标记', addedCustom?.custom === true && addedCustom?.ingredients[0].grams === 120)
const shoppingWithCustom = buildShoppingList({ '2026-10-13': meals5 }, FOODS_MAP)
check('自定义食物不进采购清单', shoppingWithCustom.length === 0, JSON.stringify(shoppingWithCustom))
delete FOODS_MAP['cf_verify']

// ---------- 17. 复制昨日条目(cloneMealItems) ----------
const { cloneMealItems } = await import('../src/core/planner.js')
const srcMeal = [
  { recipeId: 'r_boiled_egg', slot: 'protein', ingredients: [{ foodId: 'f_egg', grams: 100, scalable: true }] },
  null, // 组装失败遗留的空槽位应被剔除
]
const copiedMeal = cloneMealItems(srcMeal)
copiedMeal[0].ingredients[0].grams = 250
check(
  '复制条目为独立副本:剔除空槽,改副本不影响源',
  copiedMeal.length === 1 &&
    copiedMeal[0].ingredients[0].grams === 250 &&
    srcMeal[0].ingredients[0].grams === 100 &&
    srcMeal.length === 2,
  JSON.stringify({ copied: copiedMeal.length, srcGrams: srcMeal[0].ingredients[0].grams })
)
check('复制条目保留 recipeId/slot/custom 标记', copiedMeal[0].recipeId === 'r_boiled_egg' && copiedMeal[0].slot === 'protein')

// ---------- 18. v0.15.4 修复回归 ----------
// 单位吸附共享规则:小单位非整数倍克数吸附到最近整数倍(生成缩放与手动添加共用),
// 大单位/无单位原样返回(大单位走 1 位小数显示路线)
const { snapGramsToUnit } = await import('../src/data/foods.js')
const cfBag = { unit: '袋', unitGrams: 30 }
check('吸附:100g/袋30g → 90g(3袋,显示与克数自洽)', snapGramsToUnit(cfBag, 100) === 90)
check('吸附:已整数倍不变(150g/个50g)', snapGramsToUnit(FOODS_MAP['f_egg'], 150) === 150)
check('吸附:大单位原样返回(350g/杯250g)', snapGramsToUnit(FOODS_MAP['f_milk'], 350) === 350)
check('吸附:无单位原样返回', snapGramsToUnit(FOODS_MAP['f_chicken_breast'], 137) === 137)

// 搜索关键词:命中食谱名或所含食材名(搜"鸡蛋"能命中"水煮蛋")
const { recipeMatchesKw } = await import('../src/core/planner.js')
check('搜索:按食材名命中(鸡蛋→水煮蛋)', recipeMatchesKw(RECIPES_MAP['r_boiled_egg'], '鸡蛋', FOODS_MAP) === true)
check('搜索:按名称命中(鸡胸→香煎鸡胸)', recipeMatchesKw(RECIPES_MAP['r_pan_fried_chicken'], '鸡胸', FOODS_MAP) === true)
check('搜索:无命中返回 false', recipeMatchesKw(RECIPES_MAP['r_boiled_egg'], '三文鱼', FOODS_MAP) === false)
check('搜索:空关键词恒 true', recipeMatchesKw(RECIPES_MAP['r_boiled_egg'], '', FOODS_MAP) === true)

// ---------- 19. 体重挂钩热量半动态 ----------
const { recentWeightAvg, effectiveWeight } = await import('../src/core/nutrition.js')
check('近7天均值:窗口内多条取均值', Math.abs(recentWeightAvg([{ date: '2026-10-13', kg: 70 }, { date: '2026-10-14', kg: 72 }], '2026-10-14') - 71) < 1e-9)
check('近7天均值:窗口外记录不计入(8天前排除)', recentWeightAvg([{ date: '2026-10-07', kg: 80 }, { date: '2026-10-14', kg: 70 }], '2026-10-14') === 70)
check('近7天均值:跨月窗口(9/28-10/4 起算)', Math.abs(recentWeightAvg([{ date: '2026-09-28', kg: 69 }, { date: '2026-10-04', kg: 71 }], '2026-10-04') - 70) < 1e-9)
check('近7天均值:无记录返回 null', recentWeightAvg([], '2026-10-14') === null)
check('有效体重:无近期记录用档案体重', effectiveWeight(70, null) === 70)
check('有效体重:差不足2kg不调整', effectiveWeight(70, 71.9) === 70 && effectiveWeight(70, 68.1) === 70)
check('有效体重:涨满2kg上调一档', effectiveWeight(70, 72) === 72)
check('有效体重:降满2kg下调一档', effectiveWeight(70, 68) === 68)
check('有效体重:朝档案体重保守(涨/降3.9只按2)', effectiveWeight(70, 73.9) === 72 && effectiveWeight(70, 66.1) === 68)

console.log(failed === 0 ? '\n全部通过 ✓' : `\n${failed} 项失败 ✗`)
process.exit(failed === 0 ? 0 : 1)
