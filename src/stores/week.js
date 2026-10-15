import { defineStore } from 'pinia'
import { RECIPES, RECIPES_MAP } from '../data/recipes'
import { FOODS_MAP } from '../data/foods'
import { generateDayPlan, swapSlotItem, addItemToMeal, cloneMealItems, computeNutrition, recentFoodDays, collectUsedRecipeIds } from '../core/planner'
import { useProfileStore } from './profile'
import { useCheckinStore } from './checkin'
import { loadState, saveState, removeState } from '../utils/storage'
import { todayStr, weekStartOf, addDays } from '../utils/date'

const KEY = 'week'

/** 读取并迁移 v0.1 的单日 plan 数据到周结构(迁移后清除旧 key,避免重复迁移) */
function initState() {
  const saved = loadState(KEY, null)
  if (saved?.days) {
    pruneStaleEmptyDays(saved.days, saved.templates || [])
    // 老数据没有 templates 字段,补默认空数组(state 顶层 key 固定,序列化才完整)
    return { templates: [], ...saved }
  }
  const oldPlan = loadState('plan', null)
  if (oldPlan?.meals && oldPlan.date) {
    removeState('plan')
    return { weekStart: weekStartOf(oldPlan.date), days: { [oldPlan.date]: oldPlan.meals }, templates: [] }
  }
  return { weekStart: weekStartOf(todayStr()), days: {}, templates: [] }
}

/** 数据治理:清掉 180 天前"生成过但没有任何菜品"的空天(有内容的天永不清理),
 *  防止长期使用把 localStorage 撑满;改动立即写回 */
function pruneStaleEmptyDays(days, templates = []) {
  const cutoff = addDays(todayStr(), -180)
  let changed = false
  for (const [date, meals] of Object.entries(days)) {
    if (date >= cutoff) continue
    const hasContent = ['breakfast', 'lunch', 'dinner'].some((k) => (meals?.[k] || []).some(Boolean))
    if (!hasContent) {
      delete days[date]
      changed = true
    }
  }
  // 写回必须带上 templates,否则触发清理的加载会把模板一并丢掉
  if (changed) saveState(KEY, { weekStart: weekStartOf(todayStr()), days, templates })
}

export const useWeekStore = defineStore('week', {
  state: () => initState(),

  getters: {},

  actions: {
    persist() {
      saveState(KEY, { weekStart: this.weekStart, days: this.days, templates: this.templates })
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
    /** 生成单日(今日页"生成今日三餐"用)。
     *  keepMealKeys:不参与重新生成的餐(已打卡"已吃"视为锁定,内容是既成记录)。
     *  v0.16.1 起不再带"最近吃过"偏好:独占式偏好让单调饮食者每次生成都复现
     *  同一批菜(且生成结果写回当天又会自我强化),"熟悉"的入口是添加弹层的最近 chips */
    generateDay(date, keepMealKeys = []) {
      const profile = useProfileStore()
      this.syncWeekOf(date)
      const prev = this.days[date]
      this.days[date] = generateDayPlan({
        recipes: RECIPES,
        foods: FOODS_MAP,
        targets: profile.targets,
        excludedTags: profile.excludedTags,
        date,
        // 近 7 天食材频次(猪肝维A/金枪鱼汞等 weeklyLimit),生成端规避超限
        foodDayCounts: recentFoodDays(this.days, date),
      }).meals
      const keep = new Set(keepMealKeys)
      for (const mealKey of keep) {
        this.days[date][mealKey] = prev?.[mealKey] || []
      }
      this.persist()
    },
    /** 最近吃过的食谱 id:按天倒序、跨天去重;打卡"跳过"的餐不计(没吃过) */
    recentRecipeIds(beforeDate = null) {
      const checkin = useCheckinStore()
      const seen = new Set()
      const out = []
      const dates = Object.keys(this.days)
        .filter((d) => !beforeDate || d <= beforeDate)
        .sort()
        .reverse()
      for (const d of dates) {
        const meals = this.days[d]
        if (!meals) continue
        for (const mealKey of ['breakfast', 'lunch', 'dinner']) {
          if (checkin.statusOf(d, mealKey) === 'skip') continue
          for (const it of meals[mealKey] || []) {
            if (!it || seen.has(it.recipeId)) continue
            seen.add(it.recipeId)
            out.push(it.recipeId)
          }
        }
      }
      return out
    },
    /** 换掉某天某餐某槽位的菜,无可用候选时返回 false。
     *  index 指定要换的条目下标(详情层打开的具体菜品;同餐可能有多个同槽条目);
     *  缺省或下标与槽位不符时按槽位找第一个 */
    swap(date, mealKey, slot, index = -1) {
      const meals = this.days[date]
      if (!meals) return false
      const profile = useProfileStore()
      const list = meals[mealKey]
      let idx = index
      if (idx < 0 || !list[idx] || list[idx].slot !== slot) {
        idx = list.findIndex((it) => it && it.slot === slot)
      }
      if (idx < 0) return false
      const current = list[idx]
      const usedIds = collectUsedRecipeIds(this.days)
      const target = profile.targets.meals.find((m) => m.key === mealKey)
      // 换主食按该餐剩余热量缩放(扣掉其它条目已占用的),不再用固定 45% 估算
      const othersKcal = list.reduce(
        (s, it, i) => (i === idx || !it ? s : s + computeNutrition(it.ingredients, FOODS_MAP).kcal),
        0
      )
      const next = swapSlotItem(mealKey, slot, current?.recipeId, {
        recipes: RECIPES,
        foods: FOODS_MAP,
        target,
        excludedTags: profile.excludedTags,
        usedIds,
        stapleKcal: Math.max(80, target.kcal - othersKcal),
        foodDayCounts: recentFoodDays(this.days, date),
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
    /** 清除某天的餐但保留指定餐(已打卡"已吃"视为锁定),返回被清的餐数 */
    clearDayExcept(date, keepMealKeys) {
      const meals = this.days[date]
      if (!meals) return 0
      const keep = new Set(keepMealKeys)
      let cleared = 0
      for (const mealKey of ['breakfast', 'lunch', 'dinner']) {
        if (keep.has(mealKey)) continue
        if (meals[mealKey]?.length) cleared++
        meals[mealKey] = []
      }
      this.persist()
      return cleared
    },
    // ---- 自定义编辑:添加/移除菜品、改克数(记录实际进食) ----
    /** 添加菜品(基准份;同餐已有同食谱则克数累加) */
    addItem(date, mealKey, recipeId) {
      return this.addItemCustom(date, mealKey, recipeId, null)
    },
    /** 添加菜品并指定各食材克数;当天无数据时创建空天(免生成直接记录) */
    addItemCustom(date, mealKey, recipeId, ingredients) {
      const recipe = RECIPES_MAP[recipeId]
      if (!recipe) return null
      this.syncWeekOf(date)
      if (!this.days[date]) this.days[date] = { breakfast: [], lunch: [], dinner: [] }
      const result = addItemToMeal(this.days[date], mealKey, recipe, ingredients)
      if (result) this.persist()
      return result
    },
    /** 移除某餐第 index 个菜品 */
    removeItem(date, mealKey, index) {
      const meals = this.days[date]
      if (!meals || !meals[mealKey] || index < 0 || index >= meals[mealKey].length) return false
      meals[mealKey].splice(index, 1)
      this.persist()
      return true
    },
    /** 移除菜品中某食材克数(实时重算营养) */
    updateGrams(date, mealKey, index, foodId, grams) {
      const item = this.days[date]?.[mealKey]?.[index]
      if (!item) return false
      const ing = item.ingredients.find((i) => i.foodId === foodId)
      if (!ing || !(grams >= 5 && grams <= 1000)) return false
      ing.grams = Math.round(grams)
      this.persist()
      return true
    },
    /** 移除所有天中某食谱的全部条目(删除自定义食物时清理餐单引用;模板里一并清,
     *  清空的模板随之删除),返回移除条数 */
    removeRecipeEverywhere(recipeId) {
      let removed = 0
      for (const meals of Object.values(this.days)) {
        if (!meals) continue
        for (const mealKey of ['breakfast', 'lunch', 'dinner']) {
          const list = meals[mealKey]
          if (!list?.length) continue
          const next = list.filter((it) => !it || it.recipeId !== recipeId)
          removed += list.length - next.length
          if (next.length !== list.length) meals[mealKey] = next
        }
      }
      for (const tpl of this.templates) {
        const next = tpl.items.filter((it) => it.recipeId !== recipeId)
        if (next.length !== tpl.items.length) {
          removed += tpl.items.length - next.length
          tpl.items = next
        }
      }
      this.templates = this.templates.filter((t) => t.items.length)
      if (removed > 0) this.persist()
      return removed
    },
    /** 把某天某餐复制到另一天同餐(打卡状态不带);replace 时先清目标餐再复制,返回复制条数 */
    copyMeal(fromDate, toDate, mealKey, replace = false) {
      return this.pushMealItems(toDate, mealKey, this.days[fromDate]?.[mealKey], replace)
    },
    /** 把一组菜品写入某天某餐(追加;replace 先清目标餐再写入),写入前深拷贝。
     *  复制昨日/模板套用/预算推荐采纳共用;当天无数据时创建空天(免生成直接记录) */
    pushMealItems(date, mealKey, items, replace = false) {
      const list = cloneMealItems(items)
      if (!list.length) return 0
      this.syncWeekOf(date)
      if (!this.days[date]) this.days[date] = { breakfast: [], lunch: [], dinner: [] }
      if (replace) this.days[date][mealKey] = []
      this.days[date][mealKey].push(...list)
      this.persist()
      return list.length
    },
    // ---- 常吃组合模板:把某天某餐存为命名模板("标配早餐"),任意天一键套用 ----
    /** 存为模板;同餐同名覆盖更新(吃法变了再存一次即可),返回是否成功 */
    saveTemplate(date, mealKey, name) {
      const items = cloneMealItems(this.days[date]?.[mealKey])
      const cleanName = (name || '').trim()
      if (!items.length || !cleanName) return false
      const existing = this.templates.find((t) => t.mealKey === mealKey && t.name === cleanName)
      if (existing) {
        existing.items = items
        existing.createdAt = todayStr()
      } else {
        this.templates.push({
          id: `t_${Date.now().toString(36)}`,
          mealKey,
          name: cleanName,
          items,
          createdAt: todayStr(),
        })
      }
      this.persist()
      return true
    },
    /** 套用模板到某天同餐(追加;replace 先清目标餐),返回套用条数 */
    applyTemplate(templateId, date, replace = false) {
      const tpl = this.templates.find((t) => t.id === templateId)
      if (!tpl) return 0
      return this.pushMealItems(date, tpl.mealKey, tpl.items, replace)
    },
    deleteTemplate(templateId) {
      const i = this.templates.findIndex((t) => t.id === templateId)
      if (i < 0) return false
      this.templates.splice(i, 1)
      this.persist()
      return true
    },
    clearAll() {
      this.days = {}
      this.templates = []
      this.persist()
    },
  },
})
