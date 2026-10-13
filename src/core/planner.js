// 食谱组装与缩放 —— 纯函数,数据由调用方传入
//
// 核心思路:
// - 每餐按槽位模板组装:早餐=主食+蛋白+水果,午/晚=主食+蛋白+蔬菜
// - 缩放顺序:蔬菜/水果固定份 → 蛋白槽按该餐蛋白目标(85%)倒推克数 → 主食槽按剩余热量倒推
// - 缩放 = 对食谱基准配比乘系数 s(scalable 食材才乘,s 限制在 [0.3, 3] 防离谱)

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

  const ingredients = recipe.ingredients.map((ing) => ({
    foodId: ing.foodId,
    grams: Math.round(ing.scalable ? ing.grams * s : ing.grams),
    scalable: ing.scalable,
  }))
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

/** 生成全天计划 { date, meals: { breakfast: [...], lunch: [...], dinner: [...] } } */
export function generateDayPlan({ recipes, foods, targets, excludedTags, date }) {
  const usedIds = new Set() // 全天尽量不重复用同一食谱
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
