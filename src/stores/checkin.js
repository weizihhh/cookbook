import { defineStore } from 'pinia'
import { loadState, saveState } from '../utils/storage'

const KEY = 'checkin'

// 饮食打卡:{ marks: { 'YYYY-MM-DD': { breakfast: 'done'|'skip', ... } } }
// 注意:日期作为嵌套对象的动态 key(顶层固定为 marks),保证能被 $state 序列化持久化
export const useCheckinStore = defineStore('checkin', {
  state: () => {
    const saved = loadState(KEY, null)
    return { marks: saved?.marks || {} }
  },

  actions: {
    persist() {
      saveState(KEY, { marks: this.marks })
    },
    /** status: 'done' | 'skip' | null(清除) */
    mark(date, mealKey, status) {
      if (!this.marks[date]) this.marks[date] = {}
      if (status) this.marks[date][mealKey] = status
      else delete this.marks[date][mealKey]
      if (!Object.keys(this.marks[date]).length) delete this.marks[date]
      this.persist()
    },
    statusOf(date, mealKey) {
      return this.marks[date]?.[mealKey] || null
    },
    clear() {
      this.marks = {}
      this.persist()
    },
  },
})
