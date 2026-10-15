// 食谱组装与缩放 —— 纯函数,数据由调用方传入
//
// 核心思路:
// - 每餐按槽位模板组装:早餐=主食+蛋白+水果,午/晚=主食+蛋白+蔬菜
// - 缩放顺序:蔬菜/水果固定份 → 蛋白槽按该餐蛋白目标(85%)倒推克数 → 主食槽按剩余热量倒推
// - 缩放 = 对食谱基准配比乘系数 s(scalable 食材才乘,s 限制在 [0.3, 3] 防离谱)

import { addDays } from '../utils/date.js'
import { snapGramsToUnit } from '../data/foods.js'

export const MEAL_TEMPLATES = {
  breakfast: ['staple', 'protein', 'fruit'],
  lunch: ['staple', 'protein', 'vegetable'],
  dinner: ['staple', 'protein', 'vegetable'],
}

export const SLOT_LABELS = {
  staple: '主食',
  protein: '蛋白',
  vegetable: '蔬菜',
  fruit: '水果',
  custom: '自定义',
}

const S_MIN = 0.3
const S_MAX = 3
// 无小单位食材的绝对克数边界:防低热量目标压到"12g 红豆"、高目标撑到"660g 山药"
// (油盐等 scalable=false 的固定佐料不受此限)
const GRAMS_MIN = 20
const GRAMS_MAX = 500
// 主食槽单食材更严的上限:低热量密度主食(芋头 81kcal/100g、南瓜)按剩余热量
// 倒推时体积爆炸,500g 蒸芋头远超一餐常规量(膳食指南薯类 50-100g/天),收到 300g;
// 蔬菜/蛋白槽维持 500g(大份蔬菜是减脂期合理场景)
const STAPLE_GRAMS_MAX = 300

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const r1 = (v) => Math.round(v * 10) / 10

/** 按 ingredients(含克数)累加营养。克数为购买量口径,带壳/带骨食材(edible<1)
 *  先折算到可食部再乘每百克营养值 */
export function computeNutrition(ingredients, foods) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const ing of ingredients) {
    const f = foods[ing.foodId]
    if (!f) continue
    const k = (ing.grams * (f.edible ?? 1)) / 100
    total.kcal += f.kcal * k
    total.protein += f.protein * k
    total.carbs += f.carbs * k
    total.fat += f.fat * k
  }
  return {
    kcal: Math.round(total.kcal),
    protein: r1(total.protein),
    carbs: r1(total.carbs),
    fat: r1(total.fat),
  }
}

/** 食谱中可缩放部分的基准营养(固定食材不计入,缩放系数只由 scalable 部分决定)。
 *  与 computeNutrition 同口径:按可食部折算,否则带壳食材的缩放系数会错 */
function scalableBase(recipe, foods) {
  const base = { kcal: 0, protein: 0 }
  for (const ing of recipe.ingredients) {
    if (!ing.scalable) continue
    const f = foods[ing.foodId]
    if (!f) continue
    const k = (ing.grams * (f.edible ?? 1)) / 100
    base.kcal += f.kcal * k
    base.protein += f.protein * k
  }
  return base
}

/**
 * 按目标缩放食谱
 * @param recipe 食谱(基准配比)
 * @param byProtein 蛋白目标(g) —— 蛋白槽用
 * @param byKcal 热量目标(kcal) —— 主食槽用
 * @param maxKcal 热量上限(kcal) —— 蛋白槽防高脂蛋白源(如鸡蛋)带热量超标
 */
export function scaleRecipe(recipe, foods, { byProtein = null, byKcal = null, maxKcal = null } = {}) {
  const base = scalableBase(recipe, foods)
  let s = 1
  if (byProtein != null && base.protein > 0) {
    s = byProtein / base.protein
    if (maxKcal != null && base.kcal > 0) {
      s = Math.min(s, maxKcal / base.kcal)
    }
  } else if (byKcal != null && base.kcal > 0) {
    s = byKcal / base.kcal
  }
  s = clamp(s, S_MIN, S_MAX)

  const ingredients = recipe.ingredients.map((ing) => {
    if (!ing.scalable) return { ...ing }
    const f = foods[ing.foodId]
    const isSmallUnit = f?.unit && f.unitGrams > 0 && f.unitGrams < 100
    // 小单位食材吸附到整数倍(与显示/步进对齐),其余走绝对克数边界(主食槽更严)
    const gramsMax = recipe.slot === 'staple' ? STAPLE_GRAMS_MAX : GRAMS_MAX
    const grams = isSmallUnit
      ? snapGramsToUnit(f, ing.grams * s)
      : clamp(ing.grams * s, GRAMS_MIN, gramsMax)
    return { foodId: ing.foodId, grams: Math.round(grams), scalable: ing.scalable }
  })
  return { recipeId: recipe.id, slot: recipe.slot, ingredients, scale: r1(s) }
}

/** 槽位候选:类型匹配 + 适用餐次 + 未被排除 */
export function filterCandidates(recipes, { slot, meal, excludedTags = [] }) {
  return recipes.filter(
    (r) =>
      r.slot === slot &&
      r.mealFit.includes(meal) &&
      r.tags.every((t) => !excludedTags.includes(t))
  )
}

/**
 * 近 windowDays 个日历日内各食材"出现过的天数"(同一天多餐只计 1 天,
 * 生成/手动添加都算——健康暴露只看事实)。健康频次约束(weeklyLimit)的计数口径。
 */
export function recentFoodDays(days, today, windowDays = 7) {
  const from = addDays(today, -(windowDays - 1))
  const counts = {}
  for (const [date, meals] of Object.entries(days)) {
    if (date < from || date > today) continue
    const seen = new Set()
    for (const items of Object.values(meals || {})) {
      for (const it of items || []) {
        if (!it) continue
        for (const ing of it.ingredients) seen.add(ing.foodId)
      }
    }
    for (const id of seen) counts[id] = (counts[id] || 0) + 1
  }
  return counts
}

/** 近 windowDays 天食材多样性:滚动窗内出现过的食材种数与其中蔬菜类种数
 *  (与 recentFoodDays 同窗口、同"出现即计"口径)。膳食指南参考:平均每天 ≥12 种、每周 ≥25 种 */
export function foodDiversity(days, today, foods, windowDays = 7) {
  const counts = recentFoodDays(days, today, windowDays)
  let vegetables = 0
  for (const id of Object.keys(counts)) {
    if (foods[id]?.category === 'vegetable') vegetables++
  }
  return { total: Object.keys(counts).length, vegetables }
}

/** 按"剩余预算"推荐一餐:把剩余热量/蛋白当作一餐目标去装配若干候选组合,
 *  复用 assembleMeal 的槽位模板与 pickScored 真实交付口径(生成内核反哺记录路径)。
 *  组合间按食谱 id 集合去重;返回候选数组,每项为该餐的 items(已滤空槽) */
export function recommendMeals({ recipes, foods, kcal, protein, mealKey = 'dinner', excludedTags = [], foodDayCounts = null, count = 3 }) {
  // 预算太小无餐可配,垫到单餐下限;蛋白同理(避免 0 导致缩放系数发散)
  const target = { kcal: Math.max(150, kcal), protein: Math.max(8, protein) }
  const out = []
  const seen = new Set()
  for (let i = 0; i < count * 6 && out.length < count; i++) {
    const items = assembleMeal(mealKey, {
      recipes,
      foods,
      target,
      excludedTags,
      usedIds: new Set(),
      foodDayCounts,
    }).filter(Boolean)
    if (!items.length) continue
    const key = items
      .map((it) => it.recipeId)
      .sort()
      .join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(items)
  }
  return out
}

/** 食谱是否含"近 7 天已达建议上限"的食材。频次约束不参与池空回退:
 *  健康约束宁缺不破(蛋白池 51 候选中受控食谱仅 2 个,空槽概率可忽略) */
function overLimit(recipe, foods, foodDayCounts) {
  return recipe.ingredients.some((ing) => {
    const f = foods[ing.foodId]
    return f?.weeklyLimit > 0 && (foodDayCounts?.[ing.foodId] || 0) >= f.weeklyLimit
  })
}

/** 添加确认层软提示:所含食材近 7 天已吃满建议上限(达到即提示,不阻断记录) */
export function weeklyLimitHits(ingredients, foods, foodDayCounts) {
  const hits = []
  for (const ing of ingredients) {
    const f = foods[ing.foodId]
    if (!f?.weeklyLimit) continue
    const n = foodDayCounts?.[ing.foodId] || 0
    if (n >= f.weeklyLimit) hits.push({ name: f.name, count: n, limit: f.weeklyLimit })
  }
  return hits
}

/** 搜索关键词匹配食谱:命中名称或所含食材名(搜"鸡蛋"能命中"水煮蛋") */
export function recipeMatchesKw(recipe, kw, foods) {
  if (!kw) return true
  if (recipe.name.includes(kw)) return true
  return recipe.ingredients.some((ing) => {
    const name = foods[ing.foodId]?.name
    return name ? name.includes(kw) : false
  })
}

/** 蔬菜槽资格:蔬菜类主料合计克数。蔬菜槽的模板意图是每餐保住足量蔬菜(纤维与
 *  微量营养素),5g 干紫菜的"紫菜汤"不够格——门槛见 vegetableCandidate */
function vegetableGrams(recipe, foods) {
  return recipe.ingredients
    .filter((ing) => foods[ing.foodId]?.category === 'vegetable')
    .reduce((s, ing) => s + ing.grams, 0)
}

/** 蔬菜槽候选:非汤类点缀(蔬菜主料 ≥100g)才进组装/换菜池;用户仍可手动添加 */
function vegetableCandidate(recipe, foods) {
  return vegetableGrams(recipe, foods) >= 100
}

function pickFrom(candidates, usedIds, recentIds = []) {
  const fresh = candidates.filter((r) => !usedIds.has(r.id))
  const pool = fresh.length ? fresh : candidates
  // recentIds"最近吃过优先"分支:v0.16.1 起生产 generateDay 不再传入(独占式偏好会让
  // 重新生成永远复现同一批菜,详见 docs/DECISIONS.md);纯函数能力保留,供将来
  // "常吃优先"开关复用,行为由 verify 固化
  const recent = pool.filter((r) => recentIds.includes(r.id))
  const finalPool = recent.length ? recent : pool
  if (!finalPool.length) return null
  return finalPool[Math.floor(Math.random() * finalPool.length)]
}

/** 已选槽位的热量合计 */
function usedKcal(items, foods) {
  return Object.values(items)
    .filter(Boolean)
    .reduce((sum, it) => sum + computeNutrition(it.ingredients, foods).kcal, 0)
}

/**
 * 与 scaleRecipe 完全同口径的真实交付量:s 上限、克数边界、单位吸附之后的实际
 * 营养(含固定佐料)。选择判据必须用它——理论值 base×s 会被克数上限截断,
 * 低密度主食曾以"自称能交付"混进合格池,实际交付不足。蛋白槽 v0.20.1 起同口径
 * (评审 v5 F-2):理论值还隐含缩放系数 ≤1,可放大达标(如蒸蛋羹)的候选被低估
 */
function realDeliverable(recipe, foods, metric, want, maxKcal = null) {
  const scaled = scaleRecipe(recipe, foods, {
    ...(metric === 'kcal' ? { byKcal: want } : { byProtein: want }),
    ...(maxKcal != null ? { maxKcal } : {}),
  })
  return computeNutrition(scaled.ingredients, foods)[metric]
}

/**
 * 按"真实可交付量"挑候选:能交付 ≥90% 目标的优先入池再随机,
 * 都不够时从交付量最高的前5个随机,兼顾达标与多样性
 */
function pickScored(candidates, usedIds, foods, metric, want, recentIds = [], maxKcal = null) {
  if (!candidates.length) return null
  const scored = candidates.map((r) => ({ r, deliverable: realDeliverable(r, foods, metric, want, maxKcal) }))
  let pool = scored.filter((c) => !usedIds.has(c.r.id))
  if (!pool.length) pool = scored
  // 最近吃过优先于营养最优:生成只是参考起点,吃固定的菜的人要的是熟悉的组合
  const recent = pool.filter((c) => recentIds.includes(c.r.id))
  if (recent.length) {
    const top = [...recent].sort((a, b) => b.deliverable - a.deliverable).slice(0, 3)
    return top[Math.floor(Math.random() * top.length)].r
  }
  const qualified = pool.filter((c) => c.deliverable >= want * 0.9)
  const finalPool = qualified.length
    ? qualified
    : [...pool].sort((a, b) => b.deliverable - a.deliverable).slice(0, 5)
  return finalPool.length ? finalPool[Math.floor(Math.random() * finalPool.length)].r : null
}

/** 组装一餐。返回 planItems 数组;某槽位无候选时该项为 null(由调用方提示)。
 *  foodDayCounts:近 7 天各食材出现天数(recentFoodDays),达上限的食材的食谱退出候选 */
export function assembleMeal(mealKey, { recipes, foods, target, excludedTags, usedIds, recentIds = [], foodDayCounts = null }) {
  const slots = MEAL_TEMPLATES[mealKey]
  const items = {}

  // 1) 蔬菜/水果:固定份,先算营养(蔬菜槽要求蔬菜主料 ≥100g,汤类点缀不占槽)
  for (const slot of ['vegetable', 'fruit']) {
    if (!slots.includes(slot)) continue
    const cand = filterCandidates(recipes, { slot, meal: mealKey, excludedTags })
      .filter((r) => slot !== 'vegetable' || vegetableCandidate(r, foods))
      .filter((r) => !overLimit(r, foods, foodDayCounts))
    const recipe = pickFrom(cand, usedIds, recentIds)
    if (!recipe) {
      items[slot] = null
      continue
    }
    usedIds.add(recipe.id)
    items[slot] = {
      recipeId: recipe.id,
      slot,
      ingredients: recipe.ingredients.map((ing) => ({ ...ing })),
    }
  }

  // 2) 蛋白:优先选"热量上限内能足量供蛋白"的候选(高脂蛋白源如鸡蛋
  //    在低热量餐会供不应求,自动退居备选),再从中随机保证多样性。
  //    打分与主食槽同走 pickScored 真实交付口径(v0.20.1 评审 v5 F-2):
  //    旧理论口径隐含缩放系数 ≤1,可放大达标的奶/豆制品被挡在合格池外
  const proteinWant = target.protein * 0.85
  const proteinMaxKcal = target.kcal * 0.45
  const proteinCand = filterCandidates(recipes, { slot: 'protein', meal: mealKey, excludedTags })
    .filter((r) => !overLimit(r, foods, foodDayCounts))
  const proteinRecipe = pickScored(proteinCand, usedIds, foods, 'protein', proteinWant, recentIds, proteinMaxKcal)
  if (proteinRecipe) {
    usedIds.add(proteinRecipe.id)
    items.protein = scaleRecipe(proteinRecipe, foods, {
      byProtein: proteinWant,
      maxKcal: proteinMaxKcal,
    })
  } else {
    items.protein = null
  }

  // 3) 主食:按剩余热量倒推;优先选"缩放范围内能足量供热量"的候选
  //    (南瓜/山药等低热量密度主食在高热量目标下天然吃亏,自动退居备选)
  const stapleCand = filterCandidates(recipes, { slot: 'staple', meal: mealKey, excludedTags })
    .filter((r) => !overLimit(r, foods, foodDayCounts))
  const stapleRecipe = pickScored(stapleCand, usedIds, foods, 'kcal', Math.max(80, target.kcal - usedKcal(items, foods)), recentIds)
  if (stapleRecipe) {
    usedIds.add(stapleRecipe.id)
    const remaining = Math.max(80, target.kcal - usedKcal(items, foods))
    items.staple = scaleRecipe(stapleRecipe, foods, { byKcal: remaining })
  } else {
    items.staple = null
  }

  return slots.map((slot) => items[slot])
}

/** 生成单日计划 { date, meals: { breakfast: [...], lunch: [...], dinner: [...] } }
 *  foodDayCounts 三餐共用且天内不累计:同一天两个含同一受限食材的不同食谱可同时
 *  入选;跨天累计由 generateWeekPlan 负责(受限食材入多食谱前需先补天内累计) */
export function generateDayPlan({ recipes, foods, targets, excludedTags, date, sharedUsedIds = null, recentIds = [], foodDayCounts = null }) {
  const usedIds = sharedUsedIds ?? new Set() // 传入共享集合时跨天尽量不重复用同一食谱
  const meals = {}
  for (const mealKey of ['breakfast', 'lunch', 'dinner']) {
    const target = targets.meals.find((m) => m.key === mealKey)
    meals[mealKey] = assembleMeal(mealKey, {
      recipes,
      foods,
      target,
      excludedTags,
      usedIds,
      recentIds,
      foodDayCounts,
    })
  }
  return { date, meals }
}

/**
 * 生成一周计划(weekStart 起连续 7 天)。
 * 跨天共享 usedIds:同一食谱优先不在一周内重复出现,池子耗尽才回退复用。
 * 频次约束跨天累计:每天生成后把当天用到的食材计 1 天,后续天不再超限。
 */
export function generateWeekPlan({ recipes, foods, targets, excludedTags, weekStart, days = 7, foodDayCounts = null }) {
  const usedIds = new Set()
  const counts = { ...(foodDayCounts || {}) }
  const result = {}
  for (let i = 0; i < days; i++) {
    const date = addDays(weekStart, i)
    const meals = generateDayPlan({
      recipes,
      foods,
      targets,
      excludedTags,
      date,
      sharedUsedIds: usedIds,
      foodDayCounts: counts,
    }).meals
    result[date] = meals
    const seen = new Set()
    for (const items of Object.values(meals)) {
      for (const it of items || []) {
        if (!it) continue
        for (const ing of it.ingredients) seen.add(ing.foodId)
      }
    }
    for (const id of seen) counts[id] = (counts[id] || 0) + 1
  }
  return result
}

/**
 * 采购清单:聚合若干天的全部食材用量
 * @param days { 'YYYY-MM-DD': meals } 待聚合的天
 * @returns [{ name, category, grams, days }] 按食材聚合,含出现天数(油盐等高频佐料与主料区分用)
 */
export function buildShoppingList(days, foods) {
  const agg = new Map() // foodId -> { grams, days: Set<date> }
  for (const [date, meals] of Object.entries(days)) {
    if (!meals) continue
    // 记录本天出现过的食材(同一天多餐用同一食材只计一次出现天数)
    const today = new Map()
    for (const items of Object.values(meals)) {
      for (const item of items || []) {
        if (!item) continue
        if (item.custom) continue // 自定义食物不进备货清单(典型场景是已购单品)
        for (const ing of item.ingredients) {
          today.set(ing.foodId, (today.get(ing.foodId) || 0) + ing.grams)
        }
      }
    }
    for (const [foodId, grams] of today) {
      const entry = agg.get(foodId) || { grams: 0, days: new Set() }
      entry.grams += grams
      entry.days.add(date)
      agg.set(foodId, entry)
    }
  }
  return [...agg.entries()]
    .map(([foodId, { grams, days }]) => {
      const f = foods[foodId] || {}
      return {
        foodId,
        name: f.name || foodId,
        category: f.category || 'other',
        grams: Math.round(grams),
        days: days.size,
      }
    })
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || b.grams - a.grams)
}

const CATEGORY_ORDER = ['meat', 'seafood', 'egg_dairy_soy', 'grain', 'vegetable', 'fruit', 'oil_nuts']
function categoryOrder(c) {
  const i = CATEGORY_ORDER.indexOf(c)
  return i === -1 ? 99 : i
}

/** 从 days(周计划结构 {日期: {breakfast/lunch/dinner: 条目[]}})提取全库已出现过的
 *  食谱 id。换菜的"避开吃过的"用它;曾因 store 层 .flat() 展不开 meals 对象而
 *  恒为空集(评审 v5 F-1),下沉为纯函数供 verify 直测,堵住组装层不可测的盲区 */
export function collectUsedRecipeIds(days) {
  const ids = new Set()
  for (const meals of Object.values(days || {})) {
    for (const items of Object.values(meals || {})) {
      for (const it of items || []) {
        if (it) ids.add(it.recipeId)
      }
    }
  }
  return ids
}

/**
 * 单槽位换菜:返回换好的 planItem(排除当前食谱,给一个不同的候选)。
 * usedIds 里是全库已出现过的食谱 id,候选尽量避开(吃出新鲜感),池子耗尽才回退。
 * stapleKcal 为该餐其它条目占用后的剩余热量;缺省按经验占比 45% 估算。
 * foodDayCounts 同 generateDayPlan:达频次上限的食材的食谱不进候选(含回退池)。
 */
export function swapSlotItem(mealKey, slot, currentRecipeId, { recipes, foods, target, excludedTags, usedIds, stapleKcal = null, foodDayCounts = null }) {
  let cand = filterCandidates(recipes, { slot, meal: mealKey, excludedTags })
    .filter((r) => !overLimit(r, foods, foodDayCounts))
  if (slot === 'vegetable') cand = cand.filter((r) => vegetableCandidate(r, foods))
  const used = usedIds || new Set()
  let pool = cand.filter((r) => r.id !== currentRecipeId && !used.has(r.id))
  if (!pool.length) pool = cand.filter((r) => r.id !== currentRecipeId)
  if (!pool.length) return null
  const recipe = pool[Math.floor(Math.random() * pool.length)]

  if (slot === 'protein') {
    return scaleRecipe(recipe, foods, {
      byProtein: target.protein * 0.85,
      maxKcal: target.kcal * 0.45,
    })
  }
  if (slot === 'staple') {
    const byKcal = Math.max(80, stapleKcal != null ? stapleKcal : target.kcal * 0.45)
    return scaleRecipe(recipe, foods, { byKcal })
  }
  return { recipeId: recipe.id, slot, ingredients: recipe.ingredients.map((ing) => ({ ...ing })) }
}

/** 深拷贝一餐的全部条目(剔除空槽位);改副本不得影响源天记录 */
export function cloneMealItems(items) {
  return (items || [])
    .filter(Boolean)
    .map((it) => ({
      ...it,
      ingredients: it.ingredients.map((ing) => ({ ...ing })),
    }))
}

/**
 * 向一餐添加菜品:已有同食谱则克数累加(吃 4 个鸡蛋不必加 4 遍条目)
 * @param ingredients 可选,自定义克数的食材表;缺省用食谱基准份
 * @returns 'added' | 'merged' | null(餐不存在)
 */
export function addItemToMeal(meals, mealKey, recipe, ingredients = null) {
  const list = meals?.[mealKey]
  if (!list) return null
  const ings = (ingredients || recipe.ingredients).map((i) => ({ ...i }))
  const exist = list.find((it) => it.recipeId === recipe.id)
  if (exist) {
    for (const ing of ings) {
      const target = exist.ingredients.find((i) => i.foodId === ing.foodId)
      if (target) target.grams += ing.grams
      else exist.ingredients.push({ ...ing })
    }
    return 'merged'
  }
  list.push({
    recipeId: recipe.id,
    slot: recipe.slot,
    // 自定义食物带标记:详情层隐藏"换一个",采购清单跳过(多为已购单品)
    ...(recipe.custom ? { custom: true } : {}),
    ingredients: ings,
  })
  return 'added'
}

/**
 * 汇总全天营养与目标偏差 —— "已吃"口径:打卡"跳过"的餐(实际未进食)不计入合计。
 * 今日页 totals 与记录页统计统一走这里。
 */
export function summarizeIntake(dayPlan, foods, targets, skipMealKeys = []) {
  const skip = new Set(skipMealKeys)
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const mealKey of ['breakfast', 'lunch', 'dinner']) {
    if (skip.has(mealKey)) continue
    for (const item of dayPlan.meals[mealKey] || []) {
      if (!item) continue
      const n = computeNutrition(item.ingredients, foods)
      totals.kcal += n.kcal
      totals.protein += n.protein
      totals.carbs += n.carbs
      totals.fat += n.fat
    }
  }
  totals.kcal = Math.round(totals.kcal)
  totals.protein = r1(totals.protein)
  totals.carbs = r1(totals.carbs)
  totals.fat = r1(totals.fat)

  const diffPct = (actual, goal) =>
    goal > 0 ? Math.round(((actual - goal) / goal) * 100) : 0

  return {
    totals,
    diff: {
      kcal: diffPct(totals.kcal, targets.kcal),
      protein: diffPct(totals.protein, targets.protein),
    },
  }
}

/** 汇总全天营养与目标偏差 —— "计划"口径:全部菜品计入(生成流水线与无打卡场景用) */
export function summarizePlanned(dayPlan, foods, targets) {
  return summarizeIntake(dayPlan, foods, targets, [])
}
