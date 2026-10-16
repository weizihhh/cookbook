// checkin store 单测:打卡状态标记与日期键卫生
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCheckinStore } from '../../src/stores/checkin'
import { saveState } from '../../src/utils/storage'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('checkin store', () => {
  it('mark 记录 done/skip,statusOf 默认 null', () => {
    const checkin = useCheckinStore()
    expect(checkin.statusOf('2026-01-01', 'breakfast')).toBeNull()
    checkin.mark('2026-01-01', 'breakfast', 'done')
    checkin.mark('2026-01-01', 'lunch', 'skip')
    expect(checkin.statusOf('2026-01-01', 'breakfast')).toBe('done')
    expect(checkin.statusOf('2026-01-01', 'lunch')).toBe('skip')
    expect(checkin.statusOf('2026-01-01', 'dinner')).toBeNull()
  })

  it('mark(null) 清除单个标记;清到最后一个时日期键整体删除', () => {
    const checkin = useCheckinStore()
    checkin.mark('2026-01-01', 'breakfast', 'done')
    checkin.mark('2026-01-01', 'dinner', 'skip')
    checkin.mark('2026-01-01', 'breakfast', null)
    expect(checkin.statusOf('2026-01-01', 'breakfast')).toBeNull()
    expect(checkin.marks['2026-01-01']).toEqual({ dinner: 'skip' })
    checkin.mark('2026-01-01', 'dinner', null)
    expect(checkin.marks['2026-01-01']).toBeUndefined()
  })

  it('persist 往返与 initState 恢复', () => {
    const checkin = useCheckinStore()
    checkin.mark('2026-01-01', 'breakfast', 'done')
    const saved = JSON.parse(localStorage.getItem('cookbook:checkin'))
    expect(saved.marks['2026-01-01'].breakfast).toBe('done')
    // 新 store 实例(同 localStorage)恢复
    setActivePinia(createPinia())
    const again = useCheckinStore()
    expect(again.statusOf('2026-01-01', 'breakfast')).toBe('done')
  })

  it('损坏数据容错:非对象 marks 回退为空', () => {
    saveState('checkin', 'not-an-object')
    const checkin = useCheckinStore()
    expect(checkin.marks).toEqual({})
  })

  it('clear 全清并持久化', () => {
    const checkin = useCheckinStore()
    checkin.mark('2026-01-01', 'breakfast', 'done')
    checkin.clear()
    expect(checkin.marks).toEqual({})
    expect(JSON.parse(localStorage.getItem('cookbook:checkin')).marks).toEqual({})
  })
})
