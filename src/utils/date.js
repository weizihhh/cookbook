// 日期工具:全部基于本地时区,字符串格式 YYYY-MM-DD

export function toDateStr(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayStr() {
  return toDateStr(new Date())
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(str, n) {
  const d = parseDate(str)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** 本周一(周一为一周之始) */
export function weekStartOf(str) {
  const d = parseDate(str)
  const day = d.getDay() === 0 ? 7 : d.getDay() // 周日归上一周
  return addDays(str, 1 - day)
}

export function weekdayLabel(str) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseDate(str).getDay()]
}

/** 日期的友好显示:今天/明天/昨天 或 M月D日 周X */
export function friendlyDate(str) {
  const t = todayStr()
  if (str === t) return '今天'
  if (str === addDays(t, 1)) return '明天'
  if (str === addDays(t, -1)) return '昨天'
  return `${Number(str.slice(5, 7))}月${Number(str.slice(8, 10))}日 ${weekdayLabel(str)}`
}
