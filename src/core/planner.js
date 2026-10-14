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
 * 低密度主食曾以"自称能交付"混进合格池,实际交付不足
 */
function realDeliverable(recipe, foods, metric, want) {
  const scaled = scaleRecipe(recipe, foods, metric === 'kcal' ? { byKcal: want } : { byProtein: want })
  return computeNutrition(scaled.ingredients, foods)[metric]
}

/**
 * 按"真实可交付量"挑候选:能交付 ≥90% 目标的优先入池再随机,
 * 都不够时从交付量最高的前5个随机,兼顾达标与多样性
 */
function pickScored(candidates, usedIds, foods, metric, want, recentIds = []) {
  if (!candidates.length) return null
  const scored = candidates.map((r) => ({ r, deliverable: realDeliverable(r, foods, metric, want) }))
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

/** 组装一餐。返回 planItems 数组;某槽位无候选时该项为 null(由调用方提示) */
export function assembleMeal(mealKey, { recipes, foods, target, excludedTags, usedIds, recentIds = [] }) {
  const slots = MEAL_TEMPLATES[mealKey]
  const items = {}

  // 1) 蔬菜/水果:固定份,先算营养(蔬菜槽要求蔬菜主料 ≥100g,汤类点缀不占槽)
  for (const slot of ['vegetable', 'fruit']) {
    if (!slots.includes(slot)) continue
    const cand = filterCandidates(recipes, { slot, meal: mealKey, excludedTags }).filter(
      (r) => slot !== 'vegetable' || vegetableCandidate(r, foods)
    )
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
  //    在低热量餐会供不应求,自动退居备选),再从中随机保证多样性
  const proteinWant = target.protein * 0.85
  const proteinMaxKcal = target.kcal * 0.45
  const scoredCand = filterCandidates(recipes, { slot: 'protein', meal: mealKey, excludedTags }).map(
    (r) => {
      const base = scalableBase(r, foods)
      const deliverable =
        base.kcal > 0
          ? Math.min(proteinWant, base.protein * Math.min(1, proteinMaxKcal / base.kcal))
          : 0
      return { r, deliverable }
    }
  )
  let proteinPool = scoredCand.filter((c) => !usedIds.has(c.r.id))
  if (!proteinPool.length) proteinPool = scoredCand
  // 最近吃过优先于营养最优(与 pickScored 同规则):先从熟悉的蛋白候选中选
  const proteinRecent = proteinPool.filter((c) => recentIds.includes(c.r.id))
  let proteinPick = null
  if (proteinRecent.length) {
    const top = [...proteinRecent].sort((a, b) => b.deliverable - a.deliverable).slice(0, 3)
    proteinPick = top[Math.floor(Math.random() * top.length)]
  } else {
    const proteinQualified = proteinPool.filter((c) => c.deliverable >= proteinWant * 0.9)
    const proteinFinal = proteinQualified.length
      ? proteinQualified
      : [...proteinPool].sort((a, b) => b.deliverable - a.deliverable).slice(0, 5)
    proteinPick = proteinFinal.length
      ? proteinFinal[Math.floor(Math.random() * proteinFinal.length)]
      : null
  }
  if (proteinPick) {
    usedIds.add(proteinPick.r.id)
    items.protein = scaleRecipe(proteinPick.r, foods, {
      byProtein: proteinWant,
      maxKcal: proteinMaxKcal,
    })
  } else {
    items.protein = null
  }

  // 3) 主食:按剩余热量倒推;优先选"缩放范围内能足量供热量"的候选
  //    (南瓜/山药等低热量密度主食在高热量目标下天然吃亏,自动退居备选)
  const stapleCand = filterCandidates(recipes, { slot: 'staple', meal: mealKey, excludedTags })
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

/** 生成单日计划 { date, meals: { breakfast: [...], lunch: [...], dinner: [...] } } */
export function generateDayPlan({ recipes, foods, targets, excludedTags, date, sharedUsedIds = null, recentIds = [] }) {
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
    })
  }
  return { date, meals }
}

/**
 * 生成一周计划(weekStart 起连续 7 天)。
 * 跨天共享 usedIds:同一食谱优先不在一周内重复出现,池子耗尽才回退复用。
 */
export function generateWeekPlan({ recipes, foods, targets, excludedTags, weekStart, days = 7 }) {
  const usedIds = new Set()
  const result = {}
  for (let i = 0; i < days; i++) {
    const date = addDays(weekStart, i)
    result[date] = generateDayPlan({
      recipes,
      foods,
      targets,
      excludedTags,
      date,
      sharedUsedIds: usedIds,
    }).meals
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

/**
 * 单槽位换菜:返回换好的 planItem(排除当前食谱,给一个不同的候选)。
 * usedIds 里是全库已出现过的食谱 id,候选尽量避开(吃出新鲜感),池子耗尽才回退。
 * stapleKcal 为该餐其它条目占用后的剩余热量;缺省按经验占比 45% 估算。
 */
export function swapSlotItem(mealKey, slot, currentRecipeId, { recipes, foods, target, excludedTags, usedIds, stapleKcal = null }) {
  let cand = filterCandidates(recipes, { slot, meal: mealKey, excludedTags })
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
