// customFoods store 单测:与种子库隔离的独立层
// 注意:sync() 会写运行时 FOODS_MAP/RECIPES_MAP(模块级单例,跨用例共享),
// 涉及注册的用例在结尾 remove/clear 收尾,避免污染后续用例
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCustomFoodsStore } from '../../src/stores/customFoods'
import { FOODS_MAP } from '../../src/data/foods'
import { RECIPES_MAP } from '../../src/data/recipes'

const FOOD = { id: 'f_test_bar', name: '测试能量棒', kcal: 300, protein: 20, fat: 8, carbs: 35 }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('customFoods store', () => {
  it('空初始化:foods 空,sources 含四个预设渠道', () => {
    const s = useCustomFoodsStore()
    expect(s.foods).toEqual([])
    expect(s.sources).toEqual(['山姆', '盒马', '麦当劳', '肯德基'])
  })

  it('upsert 新增并注册进运行时 MAP(按 id / cr_ 前缀伪食谱)', () => {
    const s = useCustomFoodsStore()
    s.upsert(FOOD)
    expect(s.foods).toHaveLength(1)
    expect(FOODS_MAP['f_test_bar']?.name).toBe('测试能量棒')
    expect(RECIPES_MAP['cr_f_test_bar']?.custom).toBe(true)
    expect(RECIPES_MAP['cr_f_test_bar']?.slot).toBe('custom')
    s.remove('f_test_bar') // 收尾:撤销 MAP 注册
  })

  it('伪食谱结构:基准 100g 可缩放、三餐 mealFit、自定义渠道透传', () => {
    const s = useCustomFoodsStore()
    s.upsert({ ...FOOD, source: '山姆' })
    const r = s.recipes[0]
    expect(r.ingredients).toEqual([{ foodId: 'f_test_bar', grams: 100, scalable: true }])
    expect(r.mealFit).toEqual(['breakfast', 'lunch', 'dinner'])
    expect(r.source).toBe('山姆')
    s.remove('f_test_bar')
  })

  it('upsert 同 id 更新不新增;remove 撤销 MAP 注册', () => {
    const s = useCustomFoodsStore()
    s.upsert(FOOD)
    s.upsert({ ...FOOD, kcal: 320 })
    expect(s.foods).toHaveLength(1)
    expect(s.foods[0].kcal).toBe(320)
    s.remove('f_test_bar')
    expect(s.foods).toHaveLength(0)
    expect(FOODS_MAP['f_test_bar']).toBeUndefined()
    expect(RECIPES_MAP['cr_f_test_bar']).toBeUndefined()
  })

  it('新渠道进入 sources 且 allSources 汇总食物用过的渠道', () => {
    const s = useCustomFoodsStore()
    s.upsert({ ...FOOD, source: '瑞幸' })
    expect(s.sources).toContain('瑞幸')
    expect(s.allSources).toContain('瑞幸')
    s.remove('f_test_bar')
  })

  it('clear 清空并撤销全部 MAP 注册', () => {
    const s = useCustomFoodsStore()
    s.upsert(FOOD)
    s.clear()
    expect(s.foods).toEqual([])
    expect(FOODS_MAP['f_test_bar']).toBeUndefined()
    expect(RECIPES_MAP['cr_f_test_bar']).toBeUndefined()
  })

  it('persist 往返:localStorage 恢复 foods 与自定义渠道', () => {
    const s = useCustomFoodsStore()
    s.upsert({ ...FOOD, source: '瑞幸' })
    setActivePinia(createPinia())
    const again = useCustomFoodsStore()
    expect(again.foods[0].name).toBe('测试能量棒')
    expect(again.sources).toContain('瑞幸')
    again.clear() // 收尾
  })
})
