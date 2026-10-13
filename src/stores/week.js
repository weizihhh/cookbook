import { defineStore } from 'pinia'
import { RECIPES, RECIPES_MAP } from '../data/recipes'
import { FOODS_MAP } from '../data/foods'
import { generateDayPlan, generateWeekPlan, swapSlotItem, makeBaselineItem, summarizeDay } from '../core/planner'
import { useProfileStore } from './profile'
import { loadState, saveState } from '../utils/storage'
import { todayStr, weekStartOf, addDays } from '../utils/date'

const KEY = 'week'

/** 读取并迁移 v0.1 的单日 plan 数据到周结构 */
function initState() {
  const saved = loadState(KEY, null)
  if (saved?.days) return saved
  const oldPlan = loadState('plan', null)
  if (oldPlan?.meals && oldPlan.date) {
    return { weekStart: weekStartOf(oldPlan.date), days: { [oldPlan.date]: oldPlan.meals } }
  }
  return { weekStart: weekStartOf(todayStr()), days: {} }
}

export const useWeekStore = defineStore('week', {
  state: () => initState(),

  getters: {
    /** 本周日期数组(周一到周日) */
    weekDates: (s) => Array.from({ length: 7 }, (_, i) => addDays(s.weekStart, i)),
    hasAny: (s) => Object.values(s.days).some((m) => m),
  },

  actions: {
    persist() {
      saveState(KEY, { weekStart: this.weekStart, days: this.days })
    },
    /** 切到某天所在周(保留其他周已生成的数据) */
    syncWeekOf(date) {
      const ws = weekStartOf(date)
      if (ws !== this.weekStart) this.weekStart = ws
    },
    mealsOf(date) {
      return this.days[date] || null
    },
    hasDay(date) {
      return !!this.days[date]
    },
    /** 生成单日(今日页"生成今日三餐"用) */
    generateDay(date) {
      const profile = useProfileStore()
      this.syncWeekOf(date)
      this.days[date] = generateDayPlan({
        recipes: RECIPES,
        foods: FOODS_MAP,
        targets: profile.targets,
        excludedTags: profile.excludedTags,
        date,
      }).meals
      this.persist()
    },
    /** 生成整周(覆盖本周已有天) */
    generateWeek() {
      const profile = useProfileStore()
      const week = generateWeekPlan({
        recipes: RECIPES,
        foods: FOODS_MAP,
        targets: profile.targets,
        excludedTags: profile.excludedTags,
        weekStart: this.weekStart,
      })
      this.days = { ...this.days, ...week }
      this.persist()
    },
    /** 换掉某天某餐某槽位的菜,无可用候选时返回 false */
    swap(date, mealKey, slot) {
      const meals = this.days[date]
      if (!meals) return false
      const profile = useProfileStore()
      const idx = meals[mealKey].findIndex((it) => it && it.slot === slot)
      if (idx < 0) return false
      const current = meals[mealKey][idx]
      const usedIds = new Set(
        Object.values(this.days)
          .flat()
          .filter(Boolean)
          .map((it) => it.recipeId)
      )
      const target = profile.targets.meals.find((m) => m.key === mealKey)
      const next = swapSlotItem(mealKey, slot, current?.recipeId, {
        recipes: RECIPES,
        foods: FOODS_MAP,
        target,
        excludedTags: profile.excludedTags,
        usedIds,
      })
      if (!next) return false
      meals[mealKey][idx] = next
      this.persist()
      return true
    },
    clearDay(date) {
      delete this.days[date]
      this.persist()
    },
    // ---- 自定义编辑:添加/移除菜品、改克数(记录实际进食) ----
    /** 添加菜品(基准份,不按目标缩放) */
    addItem(date, mealKey, recipeId) {
      const meals = this.days[date]
      const recipe = RECIPES_MAP[recipeId]
      if (!meals || !recipe) return false
      meals[mealKey].push(makeBaselineItem(recipe))
      this.persist()
      return true
    },
    /** 移除某餐第 index 个菜品 */
    removeItem(date, mealKey, index) {
      const meals = this.days[date]
      if (!meals || !meals[mealKey] || index < 0 || index >= meals[mealKey].length) return false
      meals[mealKey].splice(index, 1)
      this.persist()
      return true
    },
    /** 修改菜品中某食材克数(实时重算营养) */
    updateGrams(date, mealKey, index, foodId, grams) {
      const item = this.days[date]?.[mealKey]?.[index]
      if (!item) return false
      const ing = item.ingredients.find((i) => i.foodId === foodId)
      if (!ing || !(grams >= 5 && grams <= 1000)) return false
      ing.grams = Math.round(grams)
      this.persist()
      return true
    },
    clearAll() {
      this.days = {}
      this.persist()
    },
    summaryOf(date) {
      const profile = useProfileStore()
      const meals = this.days[date]
      if (!meals) return null
      return summarizeDay({ date, meals }, FOODS_MAP, profile.targets)
    },
  },
})
