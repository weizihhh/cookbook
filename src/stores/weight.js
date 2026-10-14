import { defineStore } from 'pinia'
import { recentWeightAvg } from '../core/nutrition'
import { todayStr } from '../utils/date'
import { loadState, saveState } from '../utils/storage'

const KEY = 'weight'

// 体重记录:{ records: [{ date, kg }] },同一天只留最新一条,按日期升序
export const useWeightStore = defineStore('weight', {
  state: () => {
    const saved = loadState(KEY, null)
    return { records: Array.isArray(saved?.records) ? saved.records : [] }
  },

  getters: {
    latest: (s) => (s.records.length ? s.records[s.records.length - 1] : null),
    /** 近 7 日历日体重均值(窗口内无记录为 null)——热量目标半动态用 */
    recentAvg7: (s) => recentWeightAvg(s.records, todayStr()),
    /** 与首次记录比较的变化(kg,负数=下降) */
    totalChange: (s) =>
      s.records.length >= 2 ? s.records[s.records.length - 1].kg - s.records[0].kg : 0,
  },

  actions: {
    persist() {
      saveState(KEY, { records: this.records })
    },
    /** 记录某天体重,同一天覆盖 */
    log(date, kg) {
      const value = Number(kg)
      if (!(value > 0 && value < 500)) return false
      const idx = this.records.findIndex((r) => r.date === date)
      if (idx >= 0) this.records[idx].kg = value
      else {
        this.records.push({ date, kg: value })
        this.records.sort((a, b) => (a.date < b.date ? -1 : 1))
      }
      this.persist()
      return true
    },
    remove(date) {
      this.records = this.records.filter((r) => r.date !== date)
      this.persist()
    },
    clear() {
      this.records = []
      this.persist()
    },
    kgOf(date) {
      return this.records.find((r) => r.date === date)?.kg ?? null
    },
  },
})
