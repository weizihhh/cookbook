// weight store 单测:记录/排序/覆盖/均值 getter
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWeightStore } from '../../src/stores/weight'
import { todayStr, addDays } from '../../src/utils/date'

const T = () => todayStr()

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('weight store', () => {
  it('log 乱序日期写入后按日期升序', () => {
    const w = useWeightStore()
    w.log(addDays(T(), -1), 71)
    w.log(addDays(T(), -3), 73)
    w.log(T(), 70)
    expect(w.records.map((r) => r.kg)).toEqual([73, 71, 70])
  })

  it('log 同一天覆盖只留最新', () => {
    const w = useWeightStore()
    w.log(T(), 70)
    w.log(T(), 70.5)
    expect(w.records).toHaveLength(1)
    expect(w.records[0].kg).toBe(70.5)
  })

  it('log 非法值拒绝且不写盘', () => {
    const w = useWeightStore()
    expect(w.log(T(), 0)).toBe(false)
    expect(w.log(T(), 500)).toBe(false)
    expect(w.log(T(), NaN)).toBe(false)
    expect(w.records).toHaveLength(0)
    expect(localStorage.getItem('cookbook:weight')).toBeNull()
  })

  it('kgOf / latest / totalChange', () => {
    const w = useWeightStore()
    expect(w.kgOf(T())).toBeNull()
    w.log(addDays(T(), -2), 72)
    w.log(T(), 70)
    expect(w.kgOf(T())).toBe(70)
    expect(w.latest.kg).toBe(70)
    expect(w.totalChange).toBeCloseTo(-2)
  })

  it('recentAvg7:近 7 日历日均值,窗口外与空记录不计', () => {
    const w = useWeightStore()
    expect(w.recentAvg7).toBeNull() // 无记录
    w.log(addDays(T(), -10), 100) // 窗口外
    expect(w.recentAvg7).toBeNull()
    w.log(addDays(T(), -1), 73)
    w.log(T(), 75)
    expect(w.recentAvg7).toBe(74)
  })

  it('remove 删除指定日期', () => {
    const w = useWeightStore()
    w.log(addDays(T(), -1), 73)
    w.log(T(), 75)
    w.remove(addDays(T(), -1))
    expect(w.records).toHaveLength(1)
    expect(w.records[0].date).toBe(T())
  })

  it('persist 往返与 clear', () => {
    const w = useWeightStore()
    w.log(T(), 70)
    expect(JSON.parse(localStorage.getItem('cookbook:weight')).records).toHaveLength(1)
    w.clear()
    expect(w.records).toEqual([])
    expect(JSON.parse(localStorage.getItem('cookbook:weight')).records).toEqual([])
  })
})
