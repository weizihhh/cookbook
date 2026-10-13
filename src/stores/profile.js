import { defineStore } from 'pinia'
import { calcTargets } from '../core/nutrition'
import { loadState, saveState } from '../utils/storage'

const KEY = 'profile'

const defaults = () => ({
  gender: 'male',
  age: 30,
  height: 175,
  weight: 70,
  activity: 1.375,
  mode: 'cut',
  macroPreset: 'cut', // 与 MODE_PRESET.cut 一致:新用户首屏即减脂推荐值
  manualKcal: null, // 手动覆盖目标热量,null 表示按公式算
  proteinPerKg: 2.0,
  fatRatio: 0.25,
  mealSplit: [0.25, 0.45, 0.3],
  excludedTags: [],
  configured: false, // 是否完成过首次设置
})

export const useProfileStore = defineStore('profile', {
  state: () => ({ ...defaults(), ...loadState(KEY, {}) }),

  getters: {
    isConfigured: (s) => s.configured && s.weight > 0 && s.height > 0 && s.age > 0,
    targets: (s) => calcTargets(s),
  },

  actions: {
    update(patch) {
      Object.assign(this.$state, patch)
      this.configured = true
      saveState(KEY, this.$state)
    },
    reset() {
      this.$state = defaults()
      saveState(KEY, this.$state)
    },
  },
})
