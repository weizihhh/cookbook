// profile store 单测:初始化/更新/重置与 targets 公式链锚点(与 verify §1 互补:
// store 层验证 getter 组装与持久化,公式细节已在 verify 手算覆盖)
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProfileStore } from '../../src/stores/profile'
import { useWeightStore } from '../../src/stores/weight'
import { todayStr, addDays } from '../../src/utils/date'
import { saveState } from '../../src/utils/storage'

const T = () => todayStr()

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('profile store', () => {
  it('空 localStorage 初始化为 defaults(含 v0.12 后的 25/45/30 三餐比例)', () => {
    const p = useProfileStore()
    expect(p.configured).toBe(false)
    expect(p.mode).toBe('cut')
    expect(p.proteinPerKg).toBe(2.0)
    expect(p.mealSplit).toEqual([0.25, 0.45, 0.3])
    expect(p.isConfigured).toBe(false)
  })

  it('loadState 合并:saved 字段覆盖 defaults,其余保持默认', () => {
    saveState('profile', { weight: 80, mode: 'bulk' })
    const p = useProfileStore()
    expect(p.weight).toBe(80)
    expect(p.mode).toBe('bulk')
    expect(p.age).toBe(30) // 未保存的字段回退默认
  })

  it('update 置 configured 并持久化;reset 回 defaults', () => {
    const p = useProfileStore()
    p.update({ weight: 80 })
    expect(p.configured).toBe(true)
    expect(p.isConfigured).toBe(true)
    expect(JSON.parse(localStorage.getItem('cookbook:profile')).weight).toBe(80)
    p.reset()
    expect(p.weight).toBe(70)
    expect(p.configured).toBe(false)
  })

  it('targets 锚点:默认档案(70kg cut)热量 1882 / 蛋白 140(v0.24 手算口径)', () => {
    const p = useProfileStore()
    expect(p.targets.kcal).toBe(1882)
    expect(p.targets.protein).toBe(140)
    expect(p.targets.meals.map((m) => m.key)).toEqual(['breakfast', 'lunch', 'dinner']) // 加餐无目标
  })

  it('manualKcal 覆盖公式热量;增肌模式 +10%', () => {
    const p = useProfileStore()
    p.update({ manualKcal: 1500 })
    expect(p.targets.kcal).toBe(1500)
    p.update({ manualKcal: null, mode: 'bulk' })
    // 2267.03 × 1.1 = 2493.73 → 2494
    expect(p.targets.kcal).toBe(2494)
  })

  it('targets 半动态:近 7 天均值 74kg 时按有效体重 74kg 计算(1927 千卡)', () => {
    const weight = useWeightStore()
    weight.log(addDays(T(), -6), 73)
    weight.log(addDays(T(), -1), 75) // 均值 74 → effectiveWeight(70,74)=74
    const p = useProfileStore()
    // 74kg:BMR 1688.75 → TDEE 2322.03 → cut-17% → 1927.29 → 1927
    expect(p.targets.kcal).toBe(1927)
    expect(p.targets.protein).toBe(148) // 74 × 2.0
  })

  it('isConfigured 边界:configured 但体重为 0 视为未配置', () => {
    saveState('profile', { configured: true, weight: 0 })
    const p = useProfileStore()
    expect(p.isConfigured).toBe(false)
  })
})
