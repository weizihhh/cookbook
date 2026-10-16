// week store 迁移类 action 单测(TEST_PLAN §4:只测状态迁移,CRUD 委托 E2E 顺带覆盖)。
// 走真实依赖链(planner 纯函数 / profile / checkin / jsdom localStorage),不 mock。
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWeekStore } from '../../src/stores/week'
import { useCheckinStore } from '../../src/stores/checkin'
import { RECIPES, RECIPES_MAP } from '../../src/data/recipes'
import { todayStr, addDays, weekStartOf } from '../../src/utils/date'
import { saveState } from '../../src/utils/storage'

// 从真实食谱构造存储形态条目(与 planner 组装产物同构:recipeId/slot/ingredients),
// 不硬编码食材 id,数据演进不破测试。
const mkItem = (id) => {
  const r = RECIPES_MAP[id]
  return { recipeId: r.id, slot: r.slot, ingredients: r.ingredients.map((i) => ({ ...i })) }
}
const STAPLES = RECIPES.filter((r) => r.slot === 'staple' && r.mealFit.includes('lunch'))
const [A, B, C] = STAPLES.map((r) => r.id)

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

// ---- initState:旧数据迁移与初始化 ----
describe('initState', () => {
  it('v0.1 plan key 迁移到周结构并清除旧 key', () => {
    const d = addDays(todayStr(), -3)
    saveState('plan', { date: d, meals: { breakfast: [mkItem(A)], lunch: [], dinner: [] } })
    const week = useWeekStore()
    expect(week.days[d].breakfast).toHaveLength(1)
    expect(week.weekStart).toBe(weekStartOf(d))
    expect(localStorage.getItem('cookbook:plan')).toBeNull()
    expect(week.templates).toEqual([])
  })

  it('空 localStorage 初始化为本周空结构', () => {
    const week = useWeekStore()
    expect(week.days).toEqual({})
    expect(week.templates).toEqual([])
    expect(week.weekStart).toBe(weekStartOf(todayStr()))
  })

  it('week key 老数据无 templates 字段时补默认空数组', () => {
    const t = todayStr()
    saveState('week', { weekStart: weekStartOf(t), days: { [t]: { breakfast: [] } } })
    const week = useWeekStore()
    expect(week.templates).toEqual([])
  })
})

// ---- pruneStaleEmptyDays:180 天治理 ----
describe('pruneStaleEmptyDays', () => {
  it('清远期空天,保留有内容天(含仅加餐槽)与近期空天,写回带 templates', () => {
    const t = todayStr()
    const far = addDays(t, -200)
    const farKept = addDays(t, -190)
    const farEm = addDays(t, -195) // 远期"仅加餐槽有内容" → 留(v7 F-2:hasContent 认动态槽)
    const near = addDays(t, -10)
    const tpl = { id: 't_x', mealKey: 'lunch', name: 'X', items: [mkItem(A)], createdAt: far }
    saveState('week', {
      weekStart: weekStartOf(t),
      days: {
        [far]: { breakfast: [], lunch: [], dinner: [], snack: [] }, // 远期空天 → 清
        [farKept]: { breakfast: [mkItem(A)] }, // 远期有内容 → 留
        [farEm]: { breakfast: [], lunch: [], dinner: [], snack: [], extraMeals: [{ id: 'em_old', label: '加餐 2', items: [mkItem(A)] }] },
        [near]: { breakfast: [] }, // 近期空天 → 留
      },
      templates: [tpl],
    })
    const week = useWeekStore()
    expect(week.days[far]).toBeUndefined()
    expect(week.days[farKept].breakfast).toHaveLength(1)
    expect(week.days[farEm].extraMeals[0].items).toHaveLength(1)
    expect(week.days[near]).toBeDefined()
    // 写回必须带 templates(v0.21.0 修过的丢模板隐患)
    const saved = JSON.parse(localStorage.getItem('cookbook:week'))
    expect(saved.templates).toHaveLength(1)
  })
})

// ---- generateDay:生成与保留语义 ----
describe('generateDay', () => {
  it('默认档案生成三餐非空并持久化', () => {
    const t = todayStr()
    const week = useWeekStore()
    week.generateDay(t)
    for (const k of ['breakfast', 'lunch', 'dinner']) {
      expect(week.days[t][k].length).toBeGreaterThan(0)
    }
    expect(week.days[t].snack).toEqual([])
    const saved = JSON.parse(localStorage.getItem('cookbook:week'))
    expect(saved.days[t].breakfast.length).toBeGreaterThan(0)
  })

  it('keepMealKeys 回填旧餐,snack 恒保留,未保留餐重新生成', () => {
    const t = todayStr()
    const week = useWeekStore()
    const keepItem = mkItem(A)
    week.pushMealItems(t, 'breakfast', [keepItem])
    week.pushMealItems(t, 'snack', [mkItem(B)])
    week.generateDay(t, ['breakfast'])
    expect(week.days[t].breakfast).toEqual([keepItem])
    expect(week.days[t].snack).toHaveLength(1)
    expect(week.days[t].lunch.length).toBeGreaterThan(0)
  })

  it('keep 指定但该餐此前无数据时得到空餐(回填语义,非生成)', () => {
    const t = todayStr()
    const week = useWeekStore()
    week.generateDay(t, ['breakfast'])
    expect(week.days[t].breakfast).toEqual([])
  })
})

// ---- swap:换菜定向 ----
describe('swap', () => {
  it('snack 拒绝换菜', () => {
    const week = useWeekStore()
    expect(week.swap(todayStr(), 'snack', 'staple')).toBe(false)
  })

  it('不存在的天返回 false', () => {
    const week = useWeekStore()
    expect(week.swap('2020-01-01', 'lunch', 'staple')).toBe(false)
  })

  it('index 定向:只换指定下标条目,同槽其他条目不动(v0.15.4 换菜错位回归)', () => {
    const t = todayStr()
    const week = useWeekStore()
    const a = mkItem(A)
    const b = mkItem(B)
    week.pushMealItems(t, 'lunch', [a, b])
    const ok = week.swap(t, 'lunch', 'staple', 1)
    expect(ok).toBe(true)
    expect(week.days[t].lunch[0]).toEqual(a) // idx0 原样
    expect(week.days[t].lunch[1].slot).toBe('staple')
    expect(week.days[t].lunch[1].recipeId).not.toBe(b.recipeId) // idx1 真的换了
  })

  it('index 与槽位不符时回退按槽位找第一个', () => {
    const t = todayStr()
    const week = useWeekStore()
    const a = mkItem(A)
    week.pushMealItems(t, 'lunch', [a])
    // index=5 越界 → 回退 findIndex,槽位存在则成功
    const ok = week.swap(t, 'lunch', 'staple', 5)
    expect(ok).toBe(true)
    expect(week.days[t].lunch).toHaveLength(1)
  })
})

// ---- clearDayExcept:清空保护 ----
describe('clearDayExcept', () => {
  it('保留餐与加餐不动,清其余三餐并返回被清餐数', () => {
    const t = todayStr()
    const week = useWeekStore()
    for (const k of ['breakfast', 'lunch', 'dinner', 'snack']) {
      week.pushMealItems(t, k, [mkItem(A)])
    }
    const cleared = week.clearDayExcept(t, ['breakfast'])
    expect(cleared).toBe(2)
    expect(week.days[t].breakfast).toHaveLength(1)
    expect(week.days[t].lunch).toEqual([])
    expect(week.days[t].dinner).toEqual([])
    expect(week.days[t].snack).toHaveLength(1)
  })

  it('无该天返回 0', () => {
    const week = useWeekStore()
    expect(week.clearDayExcept(todayStr(), [])).toBe(0)
  })
})

// ---- copyMeal / pushMealItems:复制与写入 ----
describe('copyMeal & pushMealItems', () => {
  it('copyMeal 追加:目标餐原条目保留,打卡状态不带', () => {
    const from = addDays(todayStr(), -1)
    const to = todayStr()
    const week = useWeekStore()
    const checkin = useCheckinStore()
    week.pushMealItems(from, 'breakfast', [mkItem(A)])
    checkin.mark(from, 'breakfast', 'done')
    week.pushMealItems(to, 'breakfast', [mkItem(B)])
    const n = week.copyMeal(from, to, 'breakfast')
    expect(n).toBe(1)
    expect(week.days[to].breakfast).toHaveLength(2)
    expect(checkin.statusOf(to, 'breakfast')).toBeNull()
  })

  it('copyMeal 覆盖:replace 先清目标餐再写入', () => {
    const from = addDays(todayStr(), -1)
    const to = todayStr()
    const week = useWeekStore()
    week.pushMealItems(from, 'breakfast', [mkItem(A), mkItem(B)])
    week.pushMealItems(to, 'breakfast', [mkItem(C)])
    const n = week.copyMeal(from, to, 'breakfast', true)
    expect(n).toBe(2)
    expect(week.days[to].breakfast).toHaveLength(2)
    expect(week.days[to].breakfast[0].recipeId).toBe(A)
  })

  it('pushMealItems 深拷贝:写入后改源对象不影响 store(两层)', () => {
    const t = todayStr()
    const week = useWeekStore()
    const items = [mkItem(A)]
    week.pushMealItems(t, 'lunch', items)
    items[0].recipeId = 'x'
    items[0].ingredients[0].grams = 999
    expect(week.days[t].lunch[0].recipeId).toBe(A)
    expect(week.days[t].lunch[0].ingredients[0].grams).not.toBe(999)
  })

  it('pushMealItems 空数组返回 0 不建天', () => {
    const t = todayStr()
    const week = useWeekStore()
    expect(week.pushMealItems(t, 'lunch', [])).toBe(0)
    expect(week.days[t]).toBeUndefined()
  })

  it('老数据天无 snack 键时写入 snack 惰性补键', () => {
    const t = todayStr()
    saveState('week', { weekStart: weekStartOf(t), days: { [t]: { breakfast: [], lunch: [], dinner: [] } } })
    const week = useWeekStore()
    week.pushMealItems(t, 'snack', [mkItem(A)])
    expect(week.days[t].snack).toHaveLength(1)
  })
})

// ---- addItem:免生成直接记录(记录型用户核心路径) ----
describe('addItem & addItemCustom', () => {
  it('空库状态下直接添加:惰性建天+四餐键与动态槽结构键齐全', () => {
    const t = todayStr()
    const week = useWeekStore()
    const result = week.addItem(t, 'lunch', A)
    expect(result).toBeTruthy()
    expect(Object.keys(week.days[t]).sort()).toEqual(['breakfast', 'dinner', 'extraMeals', 'lunch', 'snack'])
    expect(Array.isArray(week.days[t].extraMeals)).toBe(true)
    expect(week.days[t].lunch).toHaveLength(1)
  })

  it('同餐同食谱重复添加走克数累加(委托 addItemToMeal)', () => {
    const t = todayStr()
    const week = useWeekStore()
    week.addItem(t, 'lunch', A)
    week.addItem(t, 'lunch', A)
    expect(week.days[t].lunch).toHaveLength(1)
    const g1 = RECIPES_MAP[A].ingredients[0].grams
    expect(week.days[t].lunch[0].ingredients[0].grams).toBe(g1 * 2)
  })

  it('未知食谱返回 null 不建天', () => {
    const t = todayStr()
    const week = useWeekStore()
    expect(week.addItem(t, 'lunch', 'r_not_exist')).toBeNull()
    expect(week.days[t]).toBeUndefined()
  })
})

// ---- 动态加餐槽(v0.26.0 多餐次) ----
describe('extraMeals 动态加餐槽', () => {
  it('addExtraMeal 编号从"加餐 2"起,删除后剩余槽重新编号', () => {
    const t = todayStr()
    const week = useWeekStore()
    const id2 = week.addExtraMeal(t)
    const id3 = week.addExtraMeal(t)
    expect(week.days[t].extraMeals.map((e) => e.label)).toEqual(['加餐 2', '加餐 3'])
    expect(week.removeExtraMeal(t, id2)).toBe(true)
    expect(week.days[t].extraMeals.map((e) => e.label)).toEqual(['加餐 2']) // 删除后重编号
    expect(week.days[t].extraMeals[0].id).toBe(id3)
    expect(week.removeExtraMeal(t, id2)).toBe(false) // 已删的槽
  })

  it('em_ 键路由:添加累加/移除/改克数/取列表都作用于槽内条目', () => {
    const t = todayStr()
    const week = useWeekStore()
    const emId = week.addExtraMeal(t)
    expect(week.addItem(t, emId, A)).toBeTruthy()
    expect(week.addItem(t, emId, A)).toBeTruthy() // 累加:1 条克数翻倍
    const em = week.days[t].extraMeals[0]
    expect(em.items).toHaveLength(1)
    const g1 = RECIPES_MAP[A].ingredients[0].grams
    expect(em.items[0].ingredients[0].grams).toBe(g1 * 2)
    expect(week.itemListOf(t, emId)).toBe(em.items)
    expect(week.updateGrams(t, emId, 0, em.items[0].ingredients[0].foodId, 150)).toBe(true)
    expect(em.items[0].ingredients[0].grams).toBe(150)
    expect(week.removeItem(t, emId, 0)).toBe(true)
    expect(em.items).toHaveLength(0)
    // 不存在的槽
    expect(week.addItem(t, 'em_none', A)).toBeNull()
    expect(week.itemListOf(t, 'em_none')).toBeNull()
  })

  it('swap 拒绝动态加餐槽', () => {
    const t = todayStr()
    const week = useWeekStore()
    const emId = week.addExtraMeal(t)
    week.addItem(t, emId, A)
    expect(week.swap(t, emId, 'staple')).toBe(false)
  })

  it('generateDay 保留动态加餐槽,clearDayExcept 一并保留(手动记录语义)', () => {
    const t = todayStr()
    const week = useWeekStore()
    const emId = week.addExtraMeal(t)
    week.addItem(t, emId, A)
    week.addItem(t, 'lunch', B)
    week.generateDay(t)
    expect(week.days[t].extraMeals).toHaveLength(1)
    expect(week.days[t].extraMeals[0].items).toHaveLength(1)
    week.clearDayExcept(t, [])
    expect(week.days[t].extraMeals).toHaveLength(1) // 清空三餐不动动态槽
  })

  it('老数据天无 extraMeals 键时,操作惰性补键', () => {
    const t = todayStr()
    saveState('week', { weekStart: weekStartOf(t), days: { [t]: { breakfast: [], lunch: [], dinner: [], snack: [] } } })
    const week = useWeekStore()
    const emId = week.addExtraMeal(t)
    expect(week.days[t].extraMeals).toHaveLength(1)
    week.addItem(t, emId, A)
    expect(week.days[t].extraMeals[0].items).toHaveLength(1)
  })

  it('removeRecipeEverywhere 联动清动态槽条目', () => {
    const t = todayStr()
    const week = useWeekStore()
    const emId = week.addExtraMeal(t)
    week.addItem(t, emId, A)
    week.addItem(t, 'lunch', A)
    expect(week.removeRecipeEverywhere(A)).toBe(2)
    expect(week.days[t].extraMeals[0].items).toHaveLength(0)
    expect(week.days[t].lunch).toHaveLength(0)
  })

  it('recentRecipeIds 含动态加餐槽里吃过的', () => {
    const t = todayStr()
    const week = useWeekStore()
    const emId = week.addExtraMeal(t)
    week.addItem(t, emId, B)
    expect(week.recentRecipeIds()).toContain(B)
  })
})

// ---- recentRecipeIds:"最近吃过"语义(v0.26.1 评审 v7 F-1) ----
describe('recentRecipeIds skip 语义', () => {
  it('打卡 skip 的餐不计,未跳过餐与动态加餐槽计入', () => {
    const t = todayStr()
    const week = useWeekStore()
    const checkin = useCheckinStore()
    week.pushMealItems(t, 'lunch', [mkItem(A)])
    week.pushMealItems(t, 'dinner', [mkItem(B)])
    const emId = week.addExtraMeal(t)
    week.addItem(t, emId, C)
    checkin.mark(t, 'dinner', 'skip')
    const ids = week.recentRecipeIds()
    expect(ids).toContain(A) // 未跳过的餐计入
    expect(ids).toContain(C) // 动态槽无打卡概念,恒计入
    expect(ids).not.toContain(B) // skip 的餐没吃过,不计
  })
})

// ---- 模板:常吃组合 ----
describe('templates', () => {
  it('saveTemplate 空餐或空名拒绝', () => {
    const t = todayStr()
    const week = useWeekStore()
    expect(week.saveTemplate(t, 'breakfast', '名')).toBe(false) // 空餐
    week.pushMealItems(t, 'breakfast', [mkItem(A)])
    expect(week.saveTemplate(t, 'breakfast', '  ')).toBe(false) // 空名(trim 后)
  })

  it('saveTemplate 同餐同名覆盖更新不新增', () => {
    const t = todayStr()
    const week = useWeekStore()
    week.pushMealItems(t, 'breakfast', [mkItem(A)])
    expect(week.saveTemplate(t, 'breakfast', '标配')).toBe(true)
    const id = week.templates[0].id
    week.pushMealItems(t, 'breakfast', [mkItem(B)])
    expect(week.saveTemplate(t, 'breakfast', '标配')).toBe(true)
    expect(week.templates).toHaveLength(1)
    expect(week.templates[0].id).toBe(id)
    expect(week.templates[0].items).toHaveLength(2)
  })

  it('applyTemplate 追加与覆盖双模式', () => {
    const t = todayStr()
    const week = useWeekStore()
    week.pushMealItems(addDays(t, -1), 'lunch', [mkItem(A)])
    week.saveTemplate(addDays(t, -1), 'lunch', '标配')
    const tplId = week.templates[0].id
    week.pushMealItems(t, 'lunch', [mkItem(B)])
    expect(week.applyTemplate(tplId, t)).toBe(1) // 追加
    expect(week.days[t].lunch).toHaveLength(2)
    expect(week.applyTemplate(tplId, t, true)).toBe(1) // 覆盖:只剩模板 1 条
    expect(week.days[t].lunch).toHaveLength(1)
    expect(week.days[t].lunch[0].recipeId).toBe(A)
  })

  it('applyTemplate 不存在的 id 返回 0;deleteTemplate 幂等语义', () => {
    const t = todayStr()
    const week = useWeekStore()
    expect(week.applyTemplate('t_none', t)).toBe(0)
    week.pushMealItems(t, 'lunch', [mkItem(A)])
    week.saveTemplate(t, 'lunch', '标配')
    const tplId = week.templates[0].id
    expect(week.deleteTemplate(tplId)).toBe(true)
    expect(week.deleteTemplate(tplId)).toBe(false)
  })
})

// ---- removeRecipeEverywhere:删除食物联动清理 ----
describe('removeRecipeEverywhere', () => {
  it('清各天各餐与模板条目,空模板删除,其他食谱保留,计数正确', () => {
    const d1 = addDays(todayStr(), -2)
    const d2 = addDays(todayStr(), -1)
    const week = useWeekStore()
    week.pushMealItems(d1, 'breakfast', [mkItem(A)])
    week.pushMealItems(d1, 'lunch', [mkItem(A)])
    week.pushMealItems(d1, 'snack', [mkItem(A)])
    week.pushMealItems(d2, 'dinner', [mkItem(B), mkItem(A)])
    week.saveTemplate(d1, 'lunch', '含饭')
    const removed = week.removeRecipeEverywhere(A)
    expect(removed).toBe(5) // 4 个餐条目 + 1 个模板条目
    expect(week.days[d2].dinner).toHaveLength(1) // B 保留
    expect(week.days[d2].dinner[0].recipeId).toBe(B)
    expect(week.days[d1].breakfast).toEqual([])
    expect(week.templates).toHaveLength(0) // 空模板删除
    const saved = JSON.parse(localStorage.getItem('cookbook:week'))
    expect(saved.days[d2].dinner).toHaveLength(1)
  })

  it('无引用时返回 0 且不写盘', () => {
    const week = useWeekStore()
    expect(week.removeRecipeEverywhere(A)).toBe(0)
    expect(localStorage.getItem('cookbook:week')).toBeNull()
  })
})

// ---- syncWeekOf / mealsOf / persist ----
describe('syncWeekOf & mealsOf & persist', () => {
  it('mealsOf 无天返回 null,有天返回该天对象', () => {
    const t = todayStr()
    const week = useWeekStore()
    expect(week.mealsOf(t)).toBeNull()
    week.pushMealItems(t, 'lunch', [mkItem(A)])
    expect(week.mealsOf(t)).toBe(week.days[t])
  })

  it('切周保留其他周已生成数据', () => {
    const t = todayStr()
    const old = addDays(t, -30)
    const week = useWeekStore()
    week.pushMealItems(old, 'lunch', [mkItem(A)])
    expect(week.weekStart).toBe(weekStartOf(old))
    week.generateDay(t)
    expect(week.weekStart).toBe(weekStartOf(t))
    expect(week.days[old].lunch).toHaveLength(1) // 老周数据还在
  })

  it('persist 序列化字段完整(weekStart/days/templates)', () => {
    const t = todayStr()
    const week = useWeekStore()
    week.pushMealItems(t, 'lunch', [mkItem(A)])
    week.saveTemplate(t, 'lunch', 'T')
    const saved = JSON.parse(localStorage.getItem('cookbook:week'))
    expect(Object.keys(saved).sort()).toEqual(['days', 'templates', 'weekStart'])
    expect(saved.templates).toHaveLength(1)
  })

  it('clearAll 清空 days 与 templates', () => {
    const t = todayStr()
    const week = useWeekStore()
    week.pushMealItems(t, 'lunch', [mkItem(A)])
    week.saveTemplate(t, 'lunch', 'T')
    week.clearAll()
    expect(week.days).toEqual({})
    expect(week.templates).toEqual([])
    const saved = JSON.parse(localStorage.getItem('cookbook:week'))
    expect(saved.days).toEqual({})
    expect(saved.templates).toEqual([])
  })
})
