import { defineStore } from 'pinia'
import { RECIPES } from '../data/recipes'
import { FOODS_MAP } from '../data/foods'
import { generateDayPlan, swapSlotItem, summarizeDay } from '../core/planner'
import { useProfileStore } from './profile'
import { loadState, saveState, todayStr } from '../utils/storage'

const KEY = 'plan'

export const usePlanStore = defineStore('plan', {
  state: () => {
    const saved = loadState(KEY, null)
    // 跨天自动失效:只保留"今天"的计划
    return saved && saved.date === todayStr() && saved.meals
      ? { date: saved.date, meals: saved.meals }
      : { date: todayStr(), meals: null }
  },

  getters: {
    hasPlan: (s) => s.meals != null,
    summary() {
      const profile = useProfileStore()
      if (!this.meals) return null
      return summarizeDay({ date: this.date, meals: this.meals }, FOODS_MAP, profile.targets)
    },
  },

  actions: {
    persist() {
      saveState(KEY, { date: this.date, meals: this.meals })
    },
    generate() {
      const profile = useProfileStore()
      this.date = todayStr()
      const plan = generateDayPlan({
        recipes: RECIPES,
        foods: FOODS_MAP,
        targets: profile.targets,
        excludedTags: profile.excludedTags,
        date: this.date,
      })
      this.meals = plan.meals
      this.persist()
    },
    /** 换掉某餐某槽位的菜,无可用候选时返回 false */
    swap(mealKey, slot) {
      if (!this.meals) return false
      const profile = useProfileStore()
      const idx = this.meals[mealKey].findIndex((it) => it && it.slot === slot)
      if (idx < 0) return false
      const current = this.meals[mealKey][idx]
      const usedIds = new Set(
        Object.values(this.meals)
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
      this.meals[mealKey][idx] = next
      this.persist()
      return true
    },
    clear() {
      this.meals = null
      this.persist()
    },
  },
})
