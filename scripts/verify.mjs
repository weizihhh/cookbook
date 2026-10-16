// 核心算法验证:npm run verify
// 覆盖:BMR/TDEE 公式手算对照、食谱食材引用完整性、随机组装收敛性、
// 排除过滤、换菜、周计划生成、采购清单聚合、日期工具。生成结果含随机性,
// 连续跑可观察稳定性。
import { calcTargets, EXCLUDE_TAGS } from '../src/core/nutrition.js'
import {
  generateDayPlan,
  generateWeekPlan,
  buildShoppingList,
  summarizePlanned,
  summarizeIntake,
  computeNutrition,
  swapSlotItem,
  foodDiversity,
  recommendMeals,
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

// 营养参考:成分表 kcal 按 蛋白4/脂肪9/可利用碳水4/膳食纤维≈2 计。高纤维蔬菜
// 的 4P+4C+9F 会系统性偏高,正向阈值取 50% 抓数量级手误;负向收紧到 12%——
// 高水分/高脂食材(鸡翅/三文鱼/北豆腐等官方条目)Atwater 加总本就普遍偏低
// 3~10%,但碳水/脂肪抄错(蒜薹曾 -33%、牛腩曾 -14%)一定深于 12%
const badKcal = FOODS.filter((f) => {
  const calc = f.protein * 4 + f.carbs * 4 + f.fat * 9
  const dev = (calc - f.kcal) / Math.max(f.kcal, 1)
  return dev < -0.12 || dev > 0.5
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

const s = summarizePlanned(plan, FOODS_MAP, targets)
console.log(`      全天合计: ${s.totals.kcal} kcal (目标 ${targets.kcal}, 偏差 ${s.diff.kcal}%), 蛋白 ${s.totals.protein}g (目标 ${targets.protein}g, 偏差 ${s.diff.protein}%)`)
check('热量偏差在 ±15% 内', Math.abs(s.diff.kcal) <= 15)
check('蛋白偏差在 -10%~+40% 内(蛋白槽合格池允许90%交付,营养学无害)', s.diff.protein >= -10 && s.diff.protein <= 40)

// 生成偏好:传 recentIds 时三餐全部选自该池(池内每餐每槽位有足量候选)。
// 注:v0.16.1 起生产 generateDay 不再传 recentIds(撤下独占偏好),本条守护的是
// 保留的纯函数能力,供将来"常吃优先"开关复用
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
  const sm = summarizePlanned(pl, FOODS_MAP, tg)
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
// 鸡胸为第6版官方口径(133kcal/P19.4/C2.5/F5.0):曾误用 22.0g 蛋白的另一套数据
const chicken = computeNutrition([{ foodId: 'f_chicken_breast', grams: 150 }], FOODS_MAP)
check('150g 鸡胸 ≈ 200kcal/29.1g 蛋白(第6版 19.4g/100g)', chicken.kcal === 200 && Math.abs(chicken.protein - 29.1) < 0.5, `got ${chicken.kcal}/${chicken.protein}`)

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
  const sm = summarizePlanned({ date, meals }, FOODS_MAP, targets)
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

// ---------- 13. 添加菜品累加(原 makeBaselineItem 死代码已删,基准份由 addItemToMeal 直接构造) ----------
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
膳食纤维 6.0克 24%
钠 400毫克 20%`
const p1 = parseNutritionLabel(label100g)
check('成分表:识别每100g口径', p1?.basis === '100g', JSON.stringify(p1))
check('成分表:能量/三大营养素提取(NRV% 不干扰)', p1?.energyKj === 1600 && p1?.protein === 8 && p1?.carbs === 62 && p1?.fat === 15.2, JSON.stringify(p1))
check('成分表:膳食纤维行提取(v0.22.0)', p1?.fiber === 6, JSON.stringify(p1))
check('kJ→kcal 换算', kjToKcal(1600) === 382.4, `got ${kjToKcal(1600)}`)
const n1 = normalizeTo100g(p1)
check('每100g 归一不改变数值', n1.kcal === 382.4 && n1.protein === 8 && n1.fat === 15.2 && n1.fiber === 6)

const labelServe = `营养成分表 每份30g
能量 500kJ 6%
蛋白质 3.0g 5%
脂肪 4.5g 8%
碳水化合物 22.5g 8%
膳食纤维 1.5克 6%`
const p2 = parseNutritionLabel(labelServe)
check('成分表:识别每份口径与克数', p2?.basis === 'perServe' && p2?.perServeGrams === 30, JSON.stringify(p2))
const n2 = normalizeTo100g(p2)
check('每份30g 归一到每100g(×100/30)', n2?.protein === 10 && n2?.carbs === 75 && n2?.fat === 15 && n2?.kcal === 398.3, JSON.stringify(n2))
check('每份纤维同系数换算(1.5→5.0)', n2?.fiber === 5, JSON.stringify(n2))
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

// ---------- 20. v0.16.2 主食克数上限与真实交付口径 ----------
const { scaleRecipe, assembleMeal } = await import('../src/core/planner.js')
// 主食槽上限 300:600kcal 剩余热量下蒸芋头不再被推到 500g
const taroScaled = scaleRecipe(RECIPES_MAP['r_steamed_taro'], FOODS_MAP, { byKcal: 600 })
check('主食槽克数上限 300g(芋头高剩余热量收到 300)', taroScaled.ingredients[0].grams === 300, `got ${taroScaled.ingredients[0].grams}`)
// 非主食槽维持 500:合成蔬菜 200g 基准 ×3 = 600g → 截到 500
const bigVeg = { id: 'x_veg', name: '合成蔬菜', slot: 'vegetable', mealFit: ['lunch'], tags: [], ingredients: [{ foodId: 'f_broccoli', grams: 200, scalable: true }], steps: [] }
check('非主食槽克数上限仍 500g', scaleRecipe(bigVeg, FOODS_MAP, { byKcal: 9999 }).ingredients[0].grams === 500)
// 真实交付口径:剩余热量高时芋头(300g 上限只交 ~243kcal)不再"假合格",
// 高密度主食(燕麦 338kcal/100g)独占合格池。蛋白/水果用合成食谱锁死上下文:
// 蛋白槽缩放后 ~153kcal + 火龙果 110kcal → 剩余 ~637kcal(90% 线 573)
const synthStaples = [
  { id: 'x_taro', name: '合成芋头主食', slot: 'staple', mealFit: ['breakfast'], tags: [], ingredients: [{ foodId: 'f_taro', grams: 250, scalable: true }], steps: [] },
  { id: 'x_oat', name: '合成燕麦主食', slot: 'staple', mealFit: ['breakfast'], tags: [], ingredients: [{ foodId: 'f_oats', grams: 60, scalable: true }], steps: [] },
]
const synthContext = [
  { id: 'x_prot', name: '合成蛋白', slot: 'protein', mealFit: ['breakfast'], tags: [], ingredients: [{ foodId: 'f_chicken_breast', grams: 120, scalable: true }], steps: [] },
  { id: 'x_fruit', name: '合成水果', slot: 'fruit', mealFit: ['breakfast'], tags: [], ingredients: [{ foodId: 'f_dragon_fruit', grams: 200, scalable: false }], steps: [] },
]
const pickedStaples = new Set()
for (let i = 0; i < 5; i++) {
  const items = assembleMeal('breakfast', { recipes: synthStaples.concat(synthContext), foods: FOODS_MAP, target: { kcal: 900, protein: 30 }, excludedTags: [], usedIds: new Set() })
  const st = items.find((it) => it?.slot === 'staple')
  if (st) pickedStaples.add(st.recipeId)
}
check('高剩余热量下低密度主食不再入选(燕麦独占合格池)', pickedStaples.size === 1 && pickedStaples.has('x_oat'), [...pickedStaples].join(','))
// 生成端到端:高热量画像(bulk 90kg)全天主食食材克数均 ≤300(小单位吸附路径天然不超)
const bigT = calcTargets({ gender: 'male', age: 30, height: 185, weight: 90, activity: 1.725, mode: 'bulk' })
const bigPlan = generateDayPlan({ recipes: RECIPES, foods: FOODS_MAP, targets: bigT, excludedTags: [], date: 'test-big' })
const overStaple = Object.values(bigPlan.meals).flat()
  .filter((it) => it?.slot === 'staple')
  .flatMap((it) => it.ingredients)
  .filter((ing) => ing.grams > 300)
check('生成结果主食食材克数均 ≤300g', overStaple.length === 0, JSON.stringify(overStaple))

// ---------- 21. v0.16.3 数据修正与口径回归 ----------
// 食材数据锚点(第6版官方口径,防止回退):燕麦 381、蒜薹总碳水 15.4、牛腩脂肪 29.3
check('燕麦片 50g ≈ 191kcal(381/100g)', computeNutrition([{ foodId: 'f_oats', grams: 50 }], FOODS_MAP).kcal === 191)
check('蒜薹 150g 碳水 ≈ 23.1g(总碳水15.4,曾误用蒜苗的8.0)', Math.abs(computeNutrition([{ foodId: 'f_garlic_sprout', grams: 150 }], FOODS_MAP).carbs - 23.1) < 0.1)
check('牛腩脂肪 = 29.3g(与 332kcal 自洽,曾误抄 24.0)', FOODS_MAP['f_beef_brisket'].fat === 29.3)
// 蔬菜槽资格:紫菜汤(5g 紫菜 + 2g 油)不再作为蔬菜槽候选,用户仍可手动添加
const synthRealVeg = {
  id: 'x_veg_real', name: '合成足量蔬菜', slot: 'vegetable', mealFit: ['lunch'], tags: [],
  ingredients: [{ foodId: 'f_broccoli', grams: 200, scalable: false }], steps: [],
}
let laverPicked = false
for (let i = 0; i < 10; i++) {
  const items = assembleMeal('lunch', {
    recipes: [synthRealVeg, RECIPES_MAP['r_laver_soup']],
    foods: FOODS_MAP, target: { kcal: 700, protein: 40 }, excludedTags: [], usedIds: new Set(),
  })
  const veg = items.find((it) => it?.slot === 'vegetable')
  if (veg?.recipeId === 'r_laver_soup') laverPicked = true
}
check('紫菜汤退出蔬菜槽候选池(蔬菜主料门槛100g,随机10次不选中)', !laverPicked)
// 抗炎派生:油类不计入"种数",紫菜汤不再误标
check('紫菜汤不再标抗炎(油不计种数)', RECIPES_MAP['r_laver_soup']?.antiInfl === false)
check('杂粮饭仍标抗炎(两种非油抗炎主料)', RECIPES_MAP['r_mixed_grain_rice']?.antiInfl === true)
// 换菜:避开已用过的食谱;主食按传入剩余热量缩放
const synthSwap = ['x_s1', 'x_s2', 'x_s3'].map((id) => ({
  id, name: `合成主食${id}`, slot: 'staple', mealFit: ['lunch'], tags: [],
  ingredients: [{ foodId: 'f_rice', grams: 100, scalable: true }], steps: [],
}))
const swapped = swapSlotItem('lunch', 'staple', 'x_s1', {
  recipes: synthSwap, foods: FOODS_MAP, target: { kcal: 700, protein: 30 },
  excludedTags: [], usedIds: new Set(['x_s2']), stapleKcal: 692,
})
check('换菜避开 usedIds 里的食谱(死参数已激活)', swapped?.recipeId === 'x_s3', `got ${swapped?.recipeId}`)
check('换主食按剩余热量缩放(692kcal → 大米 200g,非固定45%)', swapped?.ingredients[0].grams === 200, `got ${swapped?.ingredients[0]?.grams}`)
// summarizeIntake/Planned 口径:skipMealKeys 与今日页/记录页"已吃"口径一致
const skipDay = {
  breakfast: [{ recipeId: 'r_boiled_egg', slot: 'protein', ingredients: [{ foodId: 'f_egg', grams: 100, scalable: true }] }],
  lunch: [{ recipeId: 'r_boiled_egg', slot: 'protein', ingredients: [{ foodId: 'f_egg', grams: 100, scalable: true }] }],
  dinner: [],
}
const skipTotals = summarizeIntake({ date: '2026-10-14', meals: skipDay }, FOODS_MAP, targets, ['lunch'])
const allTotals = summarizePlanned({ date: '2026-10-14', meals: skipDay }, FOODS_MAP, targets)
check('summarizeIntake 排除 skip 餐(288 → 144)', skipTotals.totals.kcal === 144 && allTotals.totals.kcal === 288, `got ${skipTotals.totals.kcal}/${allTotals.totals.kcal}`)

// ---------- 22. v0.17.0 食部(edible)口径:克数=购买量,营养按可食部折算 ----------
const clamN = computeNutrition([{ foodId: 'f_clam', grams: 300 }], FOODS_MAP)
check('清汤蛤蜊 300g 带壳 → 可食 120g ≈ 12.1g 蛋白(评审验收口径)', Math.abs(clamN.protein - 12.1) < 0.1, `got ${clamN.protein}`)
const wingN = computeNutrition([{ foodId: 'f_chicken_wing', grams: 150 }], FOODS_MAP)
check('红烧鸡翅 150g 带骨(3个)→ 可食 103.5g ≈ 18.0g 蛋白', Math.abs(wingN.protein - 18.0) < 0.1, `got ${wingN.protein}`)
check('鸡翅碳水修正为 4.6(官方第6版,曾误 1.5)', FOODS_MAP['f_chicken_wing'].carbs === 4.6)
check('可食部显示:无单位(300g 蛤蜊)', formatFoodAmount(FOODS_MAP['f_clam'], 300) === '300g·约120g可食')
check('可食部显示:单位型(3个鸡翅)', formatFoodAmount(FOODS_MAP['f_chicken_wing'], 150) === '3个(150g)·约103g可食')
check('可食部显示:无食部食材不变', formatFoodAmount(FOODS_MAP['f_chicken_breast'], 150) === '150g')
// 缩放同口径:带壳食材蛋白槽倒推按可食部折算,交付量应贴近目标(吸附/上限有少量舍入)
const shrimpScaled = scaleRecipe(RECIPES_MAP['r_boiled_shrimp'], FOODS_MAP, { byProtein: 20 })
const shrimpN = computeNutrition(shrimpScaled.ingredients, FOODS_MAP)
check('带壳食材缩放同口径(20g 蛋白目标,交付 18-21g)', shrimpN.protein >= 18 && shrimpN.protein <= 21, `got ${shrimpN.protein}`)
// 虾仁炒西兰花:250g 带壳 = 150g 虾仁,虾蛋白与旧全可食口径一致(27.3g)+ 西兰花 3.3g
const shrimpB = computeNutrition(RECIPES_MAP['r_shrimp_broccoli'].ingredients, FOODS_MAP)
check('虾仁炒西兰花 250g 带壳折算 ≈ 30.6g 蛋白(与旧口径等价)', Math.abs(shrimpB.protein - 30.6) < 0.1, `got ${shrimpB.protein}`)
// 采购清单聚合的克数是购买量口径(将来恢复 UI 即"买多少")
const shellList = buildShoppingList({ '2026-10-14': { lunch: [{ recipeId: 'r_clam_broth', slot: 'protein', ingredients: [{ foodId: 'f_clam', grams: 300, scalable: true }] }] } }, FOODS_MAP)
check('采购清单输出购买量(300g 带壳蛤蜊)', shellList[0]?.grams === 300, JSON.stringify(shellList))

// ---------- 23. v0.17.1 评审 v3 落地:排除组合候选覆盖 / 红薯锚点 / 口径角标 ----------
// 排除组合边界:全部排除标签的任意单/双组合下,每餐每槽位的实际候选数(蔬菜槽含
// 100g 门槛,与 assembleMeal 同规则)必须 > 0 —— 防止后续打标/删食谱让"合理排除"
// 也掏空槽位。既有排除测试只查泄漏不查空槽(filter(Boolean) 会放过 null),本条补上。
// 三组合以上不在此断言范围;egg+milk+soy 三排时早餐蛋白槽原为 0(曾登记为
// 已知边界,见 docs/DECISIONS.md),v0.20.1 摘除鹰嘴豆误标 soy 后不再为 0,
// 由 §27 的专项断言固化。
{
  const tags = EXCLUDE_TAGS.map((t) => t.value)
  const combos = [
    ...tags.map((t) => [t]),
    ...tags.flatMap((t, i) => tags.slice(i + 1).map((u) => [t, u])),
  ]
  const vegMainGrams = (r) =>
    r.ingredients
      .filter((ing) => FOODS_MAP[ing.foodId]?.category === 'vegetable')
      .reduce((s, ing) => s + ing.grams, 0)
  const holes = []
  for (const ex of combos) {
    for (const [meal, slots] of Object.entries(MEAL_TEMPLATES)) {
      for (const slot of slots) {
        const n = RECIPES.filter(
          (r) =>
            r.slot === slot &&
            r.mealFit.includes(meal) &&
            r.tags.every((t) => !ex.includes(t)) &&
            (slot !== 'vegetable' || vegMainGrams(r) >= 100)
        ).length
        if (n === 0) holes.push(`${meal}/${slot} @ ${ex.join('+')}`)
      }
    }
  }
  check(`单/双排除组合下每餐每槽位仍有候选(${combos.length} 组合)`, holes.length === 0, holes.join(', '))
}
// 红薯 = 第6版红心甘薯(官方别名即"红薯":432kJ/103kcal、C24.7、食部90%),
// 曾用 90/21.3 无出处;评审 v3 引用的"红心 61kcal/C15.3"经官方平台核实不成立
check('红薯对齐第6版红心甘薯(103kcal/C24.7)', FOODS_MAP['f_sweet_potato'].kcal === 103 && FOODS_MAP['f_sweet_potato'].carbs === 24.7)
check('红薯 200g ≈ 206kcal', computeNutrition([{ foodId: 'f_sweet_potato', grams: 200 }], FOODS_MAP).kcal === 206)
// 生/干/熟口径角标:克数编辑处必须可见(生米与熟饭差 3 倍)
check('口径角标:大米(生)', formatFoodAmount(FOODS_MAP['f_rice'], 80) === '80g·生重')
check('口径角标:挂面(干)', formatFoodAmount(FOODS_MAP['f_noodles_dry'], 100) === '100g·干重')
check('口径角标:鹰嘴豆(熟)', formatFoodAmount(FOODS_MAP['f_chickpea_cooked'], 100) === '100g·熟重')
check('口径角标:无标记食材不受影响', formatFoodAmount(FOODS_MAP['f_yam'], 200) === '200g')

// ---------- 24. v0.18.0 目标体重进度预测 ----------
const { theoryProgress, measuredWeeklyRate } = await import('../src/core/nutrition.js')
// 理论:缺口 500kcal/天 → 周 500×7/7700 ≈ -0.455kg;剩 10kg → ceil(77000/500)=154 天
const tp = theoryProgress({ tdee: 2500, kcal: 2000, currentWeight: 75, targetWeight: 65, today: '2026-10-15' })
check('理论进度:缺口500 → 周约-0.45kg、154天、日期对齐', tp != null && Math.abs(tp.weeklyKg + 3500 / 7700) < 1e-9 && tp.days === 154 && tp.date === addDays('2026-10-15', 154))
// 增肌方向:盈余 +280 → 周 +0.255kg,剩 6kg(目标高于当前)才成立
const tpBulk = theoryProgress({ tdee: 2800, kcal: 3080, currentWeight: 64, targetWeight: 70, today: '2026-10-15' })
check('理论进度:增肌盈余280 → 周约+0.25kg', tpBulk != null && Math.abs(tpBulk.weeklyKg - 280 * 7 / 7700) < 1e-9)
// 无解场景:维持(缺口≈0)、方向与模式不符、未设目标
check('理论进度:维持/方向不符/未设目标返回 null',
  theoryProgress({ tdee: 2500, kcal: 2500, currentWeight: 75, targetWeight: 65, today: 't' }) === null &&
  theoryProgress({ tdee: 2800, kcal: 3080, currentWeight: 75, targetWeight: 65, today: 't' }) === null &&
  theoryProgress({ tdee: 2500, kcal: 2000, currentWeight: 75, targetWeight: null, today: 't' }) === null)
// 实测速率:28 天窗口首尾口径;21 天降 1.05kg → -0.35kg/周
check('实测速率:窗口内首尾差换算周速率', Math.abs(measuredWeeklyRate([
  { date: '2026-09-24', kg: 75.3 }, { date: '2026-10-01', kg: 74.9 }, { date: '2026-10-15', kg: 74.25 },
], '2026-10-15') + 0.35) < 1e-9)
check('实测速率:窗口外记录不计入(仅1条在窗内 → null)',
  measuredWeeklyRate([{ date: '2026-09-16', kg: 75.5 }, { date: '2026-10-15', kg: 74 }], '2026-10-15') === null)
check('实测速率:跨度不足14天 → null(短期波动无意义)',
  measuredWeeklyRate([{ date: '2026-10-08', kg: 75.5 }, { date: '2026-10-15', kg: 74.5 }], '2026-10-15') === null)

// ---------- 25. v0.19.0 食材频次约束(weeklyLimit) ----------
const { recentFoodCounts, weeklyLimitHits } = await import('../src/core/planner.js')
// 计数口径(v0.26.0 按次):滚动 7 天、每个食谱条目计 1 次(同天两条=2 次)、
// 窗口外不计、所有来源(生成/手动)都算;此前按天去重口径已废弃(DECISIONS 登记)
const freqDays = {
  '2026-10-08': { lunch: [{ recipeId: 'x', slot: 'protein', ingredients: [{ foodId: 'f_pork_liver', grams: 100, scalable: true }] }] },
  '2026-10-14': {
    lunch: [
      { recipeId: 'x', slot: 'protein', ingredients: [{ foodId: 'f_pork_liver', grams: 100, scalable: true }] },
      { recipeId: 'y', slot: 'protein', ingredients: [{ foodId: 'f_egg', grams: 50, scalable: true }] },
    ],
    dinner: [{ recipeId: 'x', slot: 'protein', ingredients: [{ foodId: 'f_pork_liver', grams: 80, scalable: true }] }],
  },
}
const fc = recentFoodCounts(freqDays, '2026-10-15')
check('频次计数:按次累计(10-14两条=2次)、窗口外不计(10-08在窗外)', fc['f_pork_liver'] === 2 && fc['f_egg'] === 1)
// 生成端规避:猪肝近 7 天已吃满 1 次(上限 1)→ 不再进入任何槽位候选
let liverPicked = false
for (let i = 0; i < 5; i++) {
  const pl = generateDayPlan({ recipes: RECIPES, foods: FOODS_MAP, targets, excludedTags: [], date: 't-freq', foodDayCounts: { f_pork_liver: 1 } })
  for (const it of Object.values(pl.meals).flat()) if (it?.recipeId === 'r_stir_fried_pork_liver') liverPicked = true
}
check('生成端规避:猪肝达上限不再入选(随机5次)', !liverPicked)
// 换菜端同口径规避
const liverSwaps = []
for (let i = 0; i < 10; i++) {
  const s2 = swapSlotItem('lunch', 'protein', 'r_boiled_egg', {
    recipes: RECIPES, foods: FOODS_MAP,
    target: targets.meals.find((m) => m.key === 'lunch'),
    excludedTags: [], usedIds: new Set(), foodDayCounts: { f_pork_liver: 1 },
  })
  if (s2) liverSwaps.push(s2.recipeId)
}
check('换菜端规避:猪肝达上限不被换入(随机10次)', liverSwaps.length === 10 && !liverSwaps.includes('r_stir_fried_pork_liver'))
// 周计划跨天累计:合成池下猪肝(限1)整周最多出现 1 条;对照组(去掉限值)必然出现
const synthFreq = [
  { id: 'xf_staple', name: '合成主食', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [], ingredients: [{ foodId: 'f_rice', grams: 100, scalable: true }], steps: [] },
  { id: 'xf_liver', name: '合成猪肝蛋白', slot: 'protein', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [], ingredients: [{ foodId: 'f_pork_liver', grams: 100, scalable: true }], steps: [] },
  { id: 'xf_chick', name: '合成鸡胸蛋白', slot: 'protein', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [], ingredients: [{ foodId: 'f_chicken_breast', grams: 120, scalable: true }], steps: [] },
  { id: 'xf_veg', name: '合成蔬菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [], ingredients: [{ foodId: 'f_broccoli', grams: 200, scalable: false }], steps: [] },
  { id: 'xf_fruit', name: '合成水果', slot: 'fruit', mealFit: ['breakfast'], tags: [], ingredients: [{ foodId: 'f_apple', grams: 200, scalable: false }], steps: [] },
]
const countLiverItems = (weekPlan) => Object.values(weekPlan).flatMap((meals) => Object.values(meals).flat()).filter((it) => it?.recipeId === 'xf_liver').length
const freqWeek = generateWeekPlan({ recipes: synthFreq, foods: FOODS_MAP, targets, excludedTags: [], weekStart: '2026-10-12' })
const liverDaysLimited = countLiverItems(freqWeek)
const origLiver = FOODS_MAP['f_pork_liver']
FOODS_MAP['f_pork_liver'] = { ...origLiver, weeklyLimit: undefined } // 对照组:同一池无频次约束
const ctrlWeek = generateWeekPlan({ recipes: synthFreq, foods: FOODS_MAP, targets, excludedTags: [], weekStart: '2026-10-12' })
const liverDaysCtrl = countLiverItems(ctrlWeek)
FOODS_MAP['f_pork_liver'] = origLiver
check('周计划跨天累计:限1的猪肝整周最多出现1条(对照组无约束时会出现)', liverDaysLimited <= 1 && liverDaysCtrl >= 1, `limited=${liverDaysLimited} ctrl=${liverDaysCtrl}`)
// 天内累计(v0.26.0):蛋白池仅剩猪肝时,单日只入 1 条、后续餐蛋白槽空(宁缺不破);
// 对照组(临时去掉限值)三餐全猪肝,证明机制有牙
const liverOnly = synthFreq.filter((r) => r.id !== 'xf_chick')
const intraPlan = generateDayPlan({ recipes: liverOnly, foods: FOODS_MAP, targets, excludedTags: [], date: 't-intraday' })
const intraN = Object.values(intraPlan.meals).flat().filter((it) => it?.recipeId === 'xf_liver').length
check('天内累计:单日受限食材最多1条', intraN === 1, `n=${intraN}`)
const origLimitProbe = FOODS_MAP['f_pork_liver']
FOODS_MAP['f_pork_liver'] = { ...origLimitProbe, weeklyLimit: undefined }
const intraCtrl = generateDayPlan({ recipes: liverOnly, foods: FOODS_MAP, targets, excludedTags: [], date: 't-intraday' })
const intraCtrlN = Object.values(intraCtrl.meals).flat().filter((it) => it?.recipeId === 'xf_liver').length
FOODS_MAP['f_pork_liver'] = origLimitProbe
check('天内累计对照组:无约束时三餐都可入猪肝', intraCtrlN === 3, `n=${intraCtrlN}`)
// 确认层软提示:达到上限命中、未达/无限值不命中
check('软提示:达到上限命中', weeklyLimitHits([{ foodId: 'f_pork_liver', grams: 100 }], FOODS_MAP, { f_pork_liver: 1 }).length === 1)
check('软提示:未达上限不命中', weeklyLimitHits([{ foodId: 'f_pork_liver', grams: 100 }], FOODS_MAP, { f_pork_liver: 0 }).length === 0)
check('软提示:无限值食材不命中', weeklyLimitHits([{ foodId: 'f_egg', grams: 50 }], FOODS_MAP, { f_egg: 7 }).length === 0)

// ---------- 26. v0.20.0 PWA:manifest / service worker / 图标 ----------
const { readFileSync, existsSync } = await import('node:fs')
const pub = (p) => new URL(`../public/${p}`, import.meta.url)
const manifest = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8'))
check('manifest:standalone + 三规格图标(含 maskable)+ 薄荷主题色',
  manifest.display === 'standalone' &&
    manifest.icons.length >= 3 &&
    manifest.theme_color === '#00b578' &&
    manifest.icons.some((i) => i.purpose === 'maskable') &&
    manifest.start_url === './')
check('manifest 引用的图标文件都存在', manifest.icons.every((i) => existsSync(pub(i.src.replace('./', '')))))
check('apple-touch-icon 存在(iOS 主屏)', existsSync(pub('icons/apple-touch-icon.png')))
const sw = readFileSync(pub('sw.js'), 'utf8')
check('sw.js:导航 network-first + 静态 cache-first + 旧缓存清理',
  sw.includes("request.mode === 'navigate'") &&
    sw.includes('caches.match(request)') &&
    sw.includes('caches.delete') &&
    sw.includes('skipWaiting'))
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
check('index.html:manifest 链接 + 主题色改薄荷绿 + apple 元信息',
  html.includes('manifest.webmanifest') &&
    html.includes('#00b578') &&
    !html.includes('#1989fa') &&
    html.includes('apple-touch-icon') &&
    html.includes('apple-mobile-web-app-capable'))
const isPng = (u) => {
  const b = readFileSync(u)
  return b.length > 100 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
}
check('图标为有效 PNG(192/512/maskable/apple)', ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']
  .every((f) => isPng(pub(`icons/${f}`))))

// ---------- 27. v0.20.1 评审 v5 落地:标签一致性 / usedIds 组装 / 蛋白槽真实交付口径 ----------
// 食材 → 排除标签一致性:排除标签是过敏/忌口语义,标签与配料不一致时过滤机制
// 永远"正确"(§4 只测机制),缺标(泄漏,如狮子头含蛋白缺 egg)和多标(误伤,
// 如鹰嘴豆非大豆误标 soy)都不会红。映射按现库约定以显式 foodId 固化:
// 海带/紫菜(藻类,category=vegetable)不算海鲜;绿豆芽/红豆/绿豆/鹰嘴豆等
// 非大豆杂豆不算豆制品;燕麦按麸质处理(交叉污染保守);玉米面无麸质。
// 辣味无独立食材锚点(调味写在 steps),不做断言。
// 维护规则:新增食材若属上述家族,必须同步登记本映射,否则下一行直接红。
const FOOD_REQUIRED_TAG = {
  pork: ['f_pork_loin', 'f_pork_leg', 'f_pork_liver', 'f_pork_ribs'],
  beef: ['f_beef_shank', 'f_beef_lean', 'f_beef_brisket'],
  chicken: ['f_chicken_breast', 'f_chicken_leg', 'f_chicken_wing', 'f_chicken_liver'],
  duck: ['f_duck_breast'],
  rabbit: ['f_rabbit'],
  lamb: ['f_lamb_lean'],
  seafood: ['f_bass', 'f_salmon', 'f_cod', 'f_basa', 'f_shrimp', 'f_squid', 'f_clam', 'f_tuna_canned', 'f_crucian', 'f_razor_clam', 'f_pomfret', 'f_scallop', 'f_dried_small_shrimp', 'f_oyster'],
  egg: ['f_egg', 'f_egg_white', 'f_quail_egg'],
  milk: ['f_milk', 'f_milk_low_fat', 'f_yogurt_plain', 'f_cottage_cheese'],
  soy: ['f_soy_milk', 'f_tofu_soft', 'f_black_bean_dry', 'f_tofu_firm', 'f_tofu_dried', 'f_edamame', 'f_tofu_sheet', 'f_yuba', 'f_vegetarian_chicken', 'f_soybean_sprout'],
  gluten: ['f_whole_wheat_bread', 'f_steamed_bun', 'f_buckwheat_noodle', 'f_pasta', 'f_noodles_dry', 'f_whole_wheat_flour', 'f_oats'],
  nuts: ['f_walnut', 'f_almond'],
}
const FOOD_TAG_OF = {}
for (const [tag, ids] of Object.entries(FOOD_REQUIRED_TAG)) for (const id of ids) FOOD_TAG_OF[id] = tag
const tagIssues = []
for (const r of RECIPES) {
  const ingTags = new Set(r.ingredients.map((i) => FOOD_TAG_OF[i.foodId]).filter(Boolean))
  for (const t of ingTags) if (!r.tags.includes(t)) tagIssues.push(`${r.id} 缺 ${t}`)
  for (const t of r.tags) if (FOOD_REQUIRED_TAG[t] && !ingTags.has(t)) tagIssues.push(`${r.id} 多 ${t}`)
}
check('食材→排除标签双向一致(缺标=过敏泄漏,多标=误伤)', tagIssues.length === 0, tagIssues.join('; '))
// category=seafood 的已用食材必须登记进 seafood 家族(防"生蚝"类贝科漏网:
// 名字正则不可靠,v5 评审双方初版映射都漏过 f_oyster)
const usedFoodIds = new Set(RECIPES.flatMap((r) => r.ingredients.map((i) => i.foodId)))
const unregSeafood = [...usedFoodIds].filter((id) => FOODS_MAP[id]?.category === 'seafood' && FOOD_TAG_OF[id] !== 'seafood')
check('seafood 类食材全部登记映射(category 兜底)', unregSeafood.length === 0, unregSeafood.join(', '))
// 三排边界回归:v0.20.1 摘除鹰嘴豆误标 soy 后,早餐蛋白槽不再为 0
const tripleCand = RECIPES.filter(
  (r) => r.slot === 'protein' && r.mealFit.includes('breakfast') && ['egg', 'milk', 'soy'].every((t) => !r.tags.includes(t))
)
check('egg+milk+soy 三排后早餐蛋白仍有候选(鹰嘴豆误标摘除,v0.17.1 边界撤销)', tripleCand.length >= 1, `got ${tripleCand.map((r) => r.id).join(',')}`)

// 换菜 usedIds 组装:store 层曾用 Object.values(days).flat() 展不开 meals 对象,
// usedIds 恒为空集,"避开吃过的"从未生效(评审 v5 F-1)。下沉为纯函数直测:
// 按天×餐次展开、跨天去重、跳过空天/空餐/空槽
const { collectUsedRecipeIds } = await import('../src/core/planner.js')
const daysUsed = {
  '2026-10-13': { breakfast: [{ recipeId: 'x_a' }, null], lunch: [], dinner: [{ recipeId: 'x_b' }] },
  '2026-10-14': { breakfast: [], lunch: [{ recipeId: 'x_a' }], dinner: [] },
  '2026-10-15': null,
}
const usedIdsAll = collectUsedRecipeIds(daysUsed)
check('collectUsedRecipeIds:按天×餐次展开、跨天去重、跳过空天与空槽', usedIdsAll.size === 2 && usedIdsAll.has('x_a') && usedIdsAll.has('x_b'), [...usedIdsAll].join(','))

// 蛋白槽打分口径与主食槽统一为真实交付(v0.20.1 评审 v5 F-2):
// 蒸蛋羹基准 20.3g 蛋白,25.5g 目标下理论口径(隐含 s≤1)判 20.3 不合格,
// 真实口径放大+单位吸附实际交付 28.8g
const custardScaled = scaleRecipe(RECIPES_MAP['r_steamed_egg_custard'], FOODS_MAP, { byProtein: 25.5, maxKcal: 405 })
check('蛋白槽真实交付锚点:蒸蛋羹 25.5g 目标实际交付 28.8g(理论口径会低估为 20.3)', computeNutrition(custardScaled.ingredients, FOODS_MAP).protein === 28.8)
// 合成池:x_p_big 基准 100g 鸡蛋放大后真实达标,x_p_small 基准 50g 到 s=3 上限
// 仍不足(19.95g)。旧理论口径两者都不合格、双双落入兜底随机;新口径合格池
// 只含前者,随机 10 次应恒选前者
const synthProteinPool = [
  { id: 'x_p_big', name: '合成放大达标蛋白', slot: 'protein', mealFit: ['breakfast'], tags: [], ingredients: [{ foodId: 'f_egg', grams: 100, scalable: true }], steps: [] },
  { id: 'x_p_small', name: '合成不足蛋白', slot: 'protein', mealFit: ['breakfast'], tags: [], ingredients: [{ foodId: 'f_egg', grams: 50, scalable: true }], steps: [] },
]
const proteinPicks = new Set()
for (let i = 0; i < 10; i++) {
  const items = assembleMeal('breakfast', { recipes: synthProteinPool, foods: FOODS_MAP, target: { kcal: 900, protein: 30 }, excludedTags: [], usedIds: new Set() })
  proteinPicks.add(items.find((it) => it?.slot === 'protein')?.recipeId)
}
check('蛋白槽真实交付口径:可放大达标者入合格池,不足者不再随机混入', proteinPicks.size === 1 && proteinPicks.has('x_p_big'), [...proteinPicks].join(','))

// ---------- 28. v0.21.0 记录路径反哺:食材多样性 / 剩余预算推荐一餐 ----------
// 多样性:7 天滚动窗"出现过的食材"去重计数 + 蔬菜类细分;窗口外不计、同食材多天算 1 种
const divDays = {
  // 第 8 天前:窗口外
  [addDays(todayStr(), -8)]: {
    breakfast: [{ recipeId: 'x_a', slot: 'protein', ingredients: [{ foodId: 'f_egg', grams: 50, scalable: true }] }],
    lunch: [],
    dinner: [],
  },
  [addDays(todayStr(), -1)]: {
    breakfast: [
      { recipeId: 'x_b', slot: 'vegetable', ingredients: [{ foodId: 'f_broccoli', grams: 150, scalable: true }] },
      { recipeId: 'x_c', slot: 'staple', ingredients: [{ foodId: 'f_rice', grams: 100, scalable: true }] },
    ],
    lunch: [],
    dinner: [],
  },
  [todayStr()]: {
    breakfast: [
      { recipeId: 'x_b', slot: 'vegetable', ingredients: [{ foodId: 'f_broccoli', grams: 100, scalable: true }] },
      { recipeId: 'x_d', slot: 'vegetable', ingredients: [{ foodId: 'f_spinach', grams: 120, scalable: true }] },
    ],
    lunch: [{ recipeId: 'x_e', slot: 'protein', ingredients: [{ foodId: 'f_chicken_breast', grams: 120, scalable: true }] }],
    dinner: [],
  },
}
const dv = foodDiversity(divDays, todayStr(), FOODS_MAP)
check('foodDiversity:7 天滚动窗种数=4(蛋在窗口外不计,西兰花跨天算 1)', dv.total === 4, `got ${JSON.stringify(dv)}`)
check('foodDiversity:蔬菜类细分=2(西兰花+菠菜,米/蛋不算)', dv.vegetables === 2, `got ${dv.vegetables}`)
check('foodDiversity:空数据为 0 种', foodDiversity({}, todayStr(), FOODS_MAP).total === 0)

// 剩余预算推荐:400kcal/30g 典型晚间预算,产出 1~3 个不重复组合;
// 组合内食谱 id 全部有效,营养落在预算宽松带(固定份蔬菜+缩放截断允许偏差)
const recs = recommendMeals({ recipes: RECIPES, foods: FOODS_MAP, kcal: 400, protein: 30, mealKey: 'dinner', excludedTags: [] })
check('recommendMeals:400kcal/30g 预算产出 1~3 个候选', recs.length >= 1 && recs.length <= 3, `got ${recs.length}`)
const recKeys = new Set(recs.map((items) => items.map((it) => it.recipeId).sort().join('|')))
check('recommendMeals:候选组合互不重复', recKeys.size === recs.length, [...recKeys].join(' || '))
let recOk = true
let recDetail = ''
for (const items of recs) {
  let kcal = 0
  let protein = 0
  for (const it of items) {
    if (!RECIPES_MAP[it.recipeId]) {
      recOk = false
      recDetail = `未知食谱 ${it.recipeId}`
    }
    const n = computeNutrition(it.ingredients, FOODS_MAP)
    kcal += n.kcal
    protein += n.protein
  }
  if (kcal > 400 * 1.6 || kcal < 400 * 0.4) {
    recOk = false
    recDetail = `kcal=${kcal} 超出宽松带`
  }
  if (protein < 12) {
    recOk = false
    recDetail = `protein=${protein} 过低`
  }
}
check('recommendMeals:候选营养落在预算宽松带(0.4~1.6×)且食谱 id 全部有效', recOk, recDetail)
// 端到端守卫:全池为空时返回空数组(而非崩在空池/产出空组合)
const recNone = recommendMeals({ recipes: [], foods: FOODS_MAP, kcal: 400, protein: 30, mealKey: 'dinner', excludedTags: [] })
check('recommendMeals:候选池全空时返回空数组', recNone.length === 0, `got ${recNone.length}`)

// ---------- 29. v0.22.0 膳食纤维建模 ----------
// 覆盖率:grain/vegetable/fruit 三类必须有 fiber 声明(新增食材漏登记在这里红);
// 动物性(肉/鱼虾)不声明(默认 0,生理零纤维)
const fiberMissing = FOODS.filter((f) => ['grain', 'vegetable', 'fruit'].includes(f.category) && f.fiber == null)
check('fiber:谷物/蔬菜/水果三类覆盖率 100%', fiberMissing.length === 0, fiberMissing.map((f) => f.id).join(','))
const fiberLeak = FOODS.filter((f) => ['meat', 'seafood'].includes(f.category) && f.fiber != null)
check('fiber:动物性食材不声明(生理零纤维)', fiberLeak.length === 0, fiberLeak.map((f) => f.id).join(','))

// 营养计算锚点:50g 燕麦=2.7g(5.3×0.5);纯动物零;玉米食部折算(2.9×0.46=1.334→1.3)
const oatFiber = computeNutrition([{ foodId: 'f_oats', grams: 50, scalable: true }], FOODS_MAP).fiber
check('fiber 锚点:50g 燕麦片=2.7g', oatFiber === 2.7, `got ${oatFiber}`)
const eggFiber = computeNutrition([{ foodId: 'f_egg', grams: 100, scalable: true }], FOODS_MAP).fiber
check('fiber 锚点:动物食材为零', eggFiber === 0, `got ${eggFiber}`)
const cornFiber = computeNutrition([{ foodId: 'f_corn', grams: 100, scalable: true }], FOODS_MAP).fiber
check('fiber:食部折算与热量同口径(带壳玉米 100g=1.3g)', cornFiber === 1.3, `got ${cornFiber}`)

// 抗炎派生纤维条件(基准份纤维 ≥4g):全麦馒头/魔芋/秋葵/黑豆浆等高纤餐补标;
// 紫菜汤纤维 1.08g 翻不了案(v0.16.3 摘标决策维持)
for (const [id, expect] of [
  ['r_homemade_whole_wheat_bun', true],
  ['r_konjac_cucumber', true],
  ['r_okra_blanched', true],
  ['r_whole_wheat_bread_slice', true],
  ['r_black_bean_milk', true],
  ['r_laver_soup', false],
]) {
  check(`抗炎派生:纤维条件判定 ${id} → ${expect}`, RECIPES_MAP[id]?.antiInfl === expect)
}

// ---------- 30. v0.23.0 加餐槽 ----------
// 目标分配不受加餐影响:calcTargets 仍只生成三餐(mealSplit 不下标越界)
const snackTargets = calcTargets({ gender: 'male', age: 30, height: 175, weight: 70, activity: 1.375, mode: 'cut' })
check('加餐:目标分配仍只三餐(meals 无 snack)', snackTargets.meals.length === 3 && snackTargets.meals.every((m) => m.key !== 'snack'), JSON.stringify(snackTargets.meals.map((m) => m.key)))
// 加餐计入全天已吃合计:三餐空、仅加餐 50g 燕麦 → 热量/纤维全部来自加餐
const snackDay = {
  date: '2026-10-15',
  meals: {
    breakfast: [], lunch: [], dinner: [],
    snack: [{ recipeId: 'x_oat_snack', slot: 'staple', ingredients: [{ foodId: 'f_oats', grams: 50, scalable: true }] }],
  },
}
const snackSum = summarizeIntake(snackDay, FOODS_MAP, { kcal: 1882, protein: 126 }, [])
check('加餐:计入全天已吃合计(三餐空仅加餐 → 191 千卡/纤维 2.7)', snackSum.totals.kcal === 191 && snackSum.totals.fiber === 2.7, JSON.stringify(snackSum.totals))
// 老数据无 snack 键:不炸、三餐照常合计
const legacyDay = {
  date: '2026-10-15',
  meals: { breakfast: [{ recipeId: 'x_rice_legacy', slot: 'staple', ingredients: [{ foodId: 'f_rice', grams: 100, scalable: true }] }], lunch: [], dinner: [] },
}
check('加餐:老数据无 snack 键兼容', summarizeIntake(legacyDay, FOODS_MAP, { kcal: 1882, protein: 126 }, []).totals.kcal === 346)

// weeklyLimit>0 的食材必须至少被 1 个食谱引用:配置无引用则生成/换菜的规避与
// 确认层提示永远无法触达,是死配置(v0.17.1 曾以"鸡肝无引用必红"暂缓此断言,
// v0.23.1 卤鸡肝食谱落地后转为恒绿防回归护栏)
const limitFoodsAll = FOODS.filter((f) => (f.weeklyLimit || 0) > 0)
const recipeFoodIds = new Set(RECIPES.flatMap((r) => r.ingredients.map((i) => i.foodId)))
const orphanLimits = limitFoodsAll.filter((f) => !recipeFoodIds.has(f.id))
check('weeklyLimit 配置均有食谱引用(死配置预警)', orphanLimits.length === 0, orphanLimits.map((f) => f.id).join(','))

// ---------- 31. v0.26.0 多餐次:动态加餐槽(extraMeals)的纯函数覆盖 ----------
{
  const { summarizeIntake: sum2, recentFoodCounts: rfc2, collectUsedRecipeIds: used2 } = await import('../src/core/planner.js')
  const emDay = {
    breakfast: [{ recipeId: 'r_rice', slot: 'staple', ingredients: [{ foodId: 'f_rice', grams: 70, scalable: true }] }],
    lunch: [], dinner: [], snack: [],
    extraMeals: [
      { id: 'em_a', label: '加餐 2', items: [{ recipeId: 'r_rice', slot: 'staple', ingredients: [{ foodId: 'f_rice', grams: 70, scalable: true }] }] },
      { id: 'em_b', label: '加餐 3', items: [] },
    ],
  }
  // 早餐 242 + 加餐槽 242 = 484:动态槽计入全天合计
  check('多餐次:动态加餐槽计入全天合计', sum2({ date: 't', meals: emDay }, FOODS_MAP, { kcal: 1882, protein: 140 }, []).totals.kcal === 484)
  // skip 不作用于动态槽(无打卡概念):skip 四固定餐后仍计 242
  check('多餐次:skip 只作用于固定餐,动态槽恒计入', sum2({ date: 't', meals: emDay }, FOODS_MAP, { kcal: 1882, protein: 140 }, ['breakfast', 'lunch', 'dinner', 'snack']).totals.kcal === 242)
  // 频次计数含动态槽且不因结构键误遍历而炸:两条米饭条目 = 2 次
  const emCounts = rfc2({ '2026-10-15': emDay }, '2026-10-15')
  check('多餐次:频次按次计数含动态槽(2 条米饭=2 次)', emCounts['f_rice'] === 2)
  // 换菜"避开吃过的"含动态槽
  const emUsed = used2({ '2026-10-15': emDay })
  check('多餐次:collectUsedRecipeIds 含动态槽条目', emUsed.has('r_rice'))
}

console.log(failed === 0 ? '\n全部通过 ✓' : `\n${failed} 项失败 ✗`)
process.exit(failed === 0 ? 0 : 1)
