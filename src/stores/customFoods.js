// 自定义食物(拍照导入/手动录入)—— 与种子库完全隔离的独立层
//
// 接入方式:注册进运行时 FOODS_MAP / RECIPES_MAP(按 id 查询、营养计算、
// 添加菜品、克数步进全部自然生效),但不动 FOODS / RECIPES 数组 ——
// 自动组装池、食材库种子列表天然看不到自定义食物。
// localStorage key: customFoods;导出格式 v3 随备份走。
import { defineStore } from 'pinia'
import { FOODS_MAP } from '../data/foods.js'
import { RECIPES_MAP } from '../data/recipes.js'
import { loadState, saveState } from '../utils/storage.js'

const KEY = 'customFoods'
const PRESET_SOURCES = ['山姆', '盒马', '麦当劳', '肯德基']

/** 伪食谱:让自定义食物走"添加菜品"既有链路(基准份=100g,不参与缩放与组装) */
export function buildCustomRecipe(food) {
  return {
    id: 'cr_' + food.id,
    name: food.name,
    slot: 'custom', // 不在 MEAL_TEMPLATES 槽位中,组装池天然排除
    mealFit: ['breakfast', 'lunch', 'dinner'],
    tags: [],
    custom: true,
    source: food.source || '',
    ingredients: [{ foodId: food.id, grams: 100, scalable: true }],
  }
}

function initState() {
  const saved = loadState(KEY, null)
  return {
    foods: (saved?.foods || []).map((f) => ({ ...f })),
    sources: [...new Set([...PRESET_SOURCES, ...(saved?.sources || [])])],
  }
}

export const useCustomFoodsStore = defineStore('customFoods', {
  state: initState,

  getters: {
    recipes: (s) => s.foods.map(buildCustomRecipe),
    /** 可选渠道 = 预设 ∪ 用户新增 ∪ 历史食物用过的 */
    allSources: (s) => [...new Set([...s.sources, ...s.foods.map((f) => f.source).filter(Boolean)])],
  },

  actions: {
    persist() {
      saveState(KEY, { foods: this.foods, sources: this.sources })
    },
    /** 同步注册进运行时 MAP(幂等,store 初始化与每次增删改后调用) */
    sync() {
      for (const f of this.foods) {
        FOODS_MAP[f.id] = f
        RECIPES_MAP['cr_' + f.id] = buildCustomRecipe(f)
      }
    },
    upsert(food) {
      const i = this.foods.findIndex((f) => f.id === food.id)
      if (i >= 0) this.foods[i] = { ...this.foods[i], ...food }
      else this.foods.push(food)
      if (food.source && !this.sources.includes(food.source)) this.sources.push(food.source)
      this.persist()
      this.sync()
    },
    remove(id) {
      this.foods = this.foods.filter((f) => f.id !== id)
      delete FOODS_MAP[id]
      delete RECIPES_MAP['cr_' + id]
      this.persist()
    },
    clear() {
      for (const f of this.foods) {
        delete FOODS_MAP[f.id]
        delete RECIPES_MAP['cr_' + f.id]
      }
      this.foods = []
      this.persist()
    },
  },
})
