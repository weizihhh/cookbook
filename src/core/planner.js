// 食谱组装与缩放 —— 纯函数,数据由调用方传入
//
// 核心思路:
// - 每餐按槽位模板组装:早餐=主食+蛋白+水果,午/晚=主食+蛋白+蔬菜
// - 缩放顺序:蔬菜/水果固定份 → 蛋白槽按该餐蛋白目标(85%)倒推克数 → 主食槽按剩余热量倒推
// - 缩放 = 对食谱基准配比乘系数 s(scalable 食材才乘,s 限制在 [0.3, 3] 防离谱)

import { addDays } from '../utils/date.js'

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
}

const S_MIN = 0.3
const S_MAX = 3
// 无小单位食材的绝对克数边界:防低热量目标压到"12g 红豆"、高目标撑到"660g 山药"
// (油盐等 scalable=false 的固定佐料不受此限)
const GRAMS_MIN = 20
const GRAMS_MAX = 500

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const r1 = (v) => Math.round(v * 10) / 10

/** 按 ingredients(含克数)累加营养 */
export function computeNutrition(ingredients, foods) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const ing of ingredients) {
    const f = foods[ing.foodId]
    if (!f) continue
    const k = ing.grams / 100
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

/** 食谱中可缩放部分的基准营养(固定食材不计入,缩放系数只由 scalable 部分决定) */
function scalableBase(recipe, foods) {
  const base = { kcal: 0, protein: 0 }
  for (const ing of recipe.ingredients) {
    if (!ing.scalable) continue
    const f = foods[ing.foodId]
    if (!f) continue
    const k = ing.grams / 100
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
    let grams = ing.grams * s
    if (f?.unit && f.unitGrams > 0 && f.unitGrams < 100) {
      // 小单位食材(<100g/个)吸附到整数倍,避免"3.5个鸡蛋"这类不可操作用量
      grams = Math.max(f.unitGrams, Math.round(grams / f.unitGrams) * f.unitGrams)
    } else {
      grams = clamp(grams, GRAMS_MIN, GRAMS_MAX)
    }
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

function pickFrom(candidates, usedIds) {
  const fresh = candidates.filter((r) => !usedIds.has(r.id))
  const pool = fresh.length ? fresh : candidates
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 已选槽位的热量合计 */
function usedKcal(items, foods) {
  return Object.values(items)
    .filter(Boolean)
    .reduce((sum, it) => sum + computeNutrition(it.ingredients, foods).kcal, 0)
}

/**
 * 按"缩放范围内可交付量"挑候选:能交付 ≥90% 目标的优先入池再随机,
 * 都不够时从交付量最高的前5个随机,兼顾达标与多样性
 */
function pickScored(candidates, usedIds, foods, metric, want) {
  if (!candidates.length) return null
  const scored = candidates.map((r) => {
    const base = scalableBase(r, foods)
    const deliverable =
      base[metric] > 0 ? base[metric] * clamp(want / base[metric], S_MIN, S_MAX) : 0
    return { r, deliverable }
  })
  let pool = scored.filter((c) => !usedIds.has(c.r.id))
  if (!pool.length) pool = scored
  const qualified = pool.filter((c) => c.deliverable >= want * 0.9)
  const finalPool = qualified.length
    ? qualified
    : [...pool].sort((a, b) => b.deliverable - a.deliverable).slice(0, 5)
  return finalPool.length ? finalPool[Math.floor(Math.random() * finalPool.length)].r : null
}

/** 组装一餐。返回 planItems 数组;某槽位无候选时该项为 null(由调用方提示) */
export function assembleMeal(mealKey, { recipes, foods, target, excludedTags, usedIds }) {
  const slots = MEAL_TEMPLATES[mealKey]
  const items = {}

  // 1) 蔬菜/水果:固定份,先算营养
  for (const slot of ['vegetable', 'fruit']) {
    if (!slots.includes(slot)) continue
    const cand = filterCandidates(recipes, { slot, meal: mealKey, excludedTags })
    const recipe = pickFrom(cand, usedIds)
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
  const proteinQualified = proteinPool.filter((c) => c.deliverable >= proteinWant * 0.9)
  const proteinFinal = proteinQualified.length
    ? proteinQualified
    : [...proteinPool].sort((a, b) => b.deliverable - a.deliverable).slice(0, 5)
  const proteinPick = proteinFinal.length
    ? proteinFinal[Math.floor(Math.random() * proteinFinal.length)]
    : null
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
  const stapleRecipe = pickScored(stapleCand, usedIds, foods, 'kcal', Math.max(80, target.kcal - usedKcal(items, foods)))
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
export function generateDayPlan({ recipes, foods, targets, excludedTags, date, sharedUsedIds = null }) {
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

/** 单槽位换菜:返回换好的 planItem(排除当前食谱,给一个不同的候选) */
export function swapSlotItem(mealKey, slot, currentRecipeId, { recipes, foods, target, excludedTags, usedIds }) {
  const cand = filterCandidates(recipes, { slot, meal: mealKey, excludedTags })
  const pool = cand.filter((r) => r.id !== currentRecipeId)
  if (!pool.length) return null
  const recipe = pool[Math.floor(Math.random() * pool.length)]

  if (slot === 'protein') {
    return scaleRecipe(recipe, foods, {
      byProtein: target.protein * 0.85,
      maxKcal: target.kcal * 0.45,
    })
  }
  if (slot === 'staple') {
    return scaleRecipe(recipe, foods, { byKcal: target.kcal * 0.45 }) // 换主食时无上下文可扣,按经验占比45%
  }
  return { recipeId: recipe.id, slot, ingredients: recipe.ingredients.map((ing) => ({ ...ing })) }
}

/** 基准份 planItem(自定义添加菜品用):按食谱基准克数,不按目标缩放 */
export function makeBaselineItem(recipe) {
  return {
    recipeId: recipe.id,
    slot: recipe.slot,
    ingredients: recipe.ingredients.map((ing) => ({ ...ing })),
  }
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
  list.push({ recipeId: recipe.id, slot: recipe.slot, ingredients: ings })
  return 'added'
}

/** 汇总全天营养与目标偏差 */
export function summarizeDay(dayPlan, foods, targets) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const mealKey of ['breakfast', 'lunch', 'dinner']) {
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
