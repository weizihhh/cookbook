// localStorage 封装 + 数据导出/导入

const PREFIX = 'cookbook:'

export function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

let lastQuotaToastAt = 0

export function saveState(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    /* 一般性失败(隐私模式等)保持静默,不阻塞主流程;但配额满意味着后续记录
       会持续丢失,必须让用户知道并去导出备份(30 秒节流防连环弹) */
    if ((e?.name === 'QuotaExceededError' || e?.code === 22) && Date.now() - lastQuotaToastAt > 30000) {
      lastQuotaToastAt = Date.now()
      import('vant')
        .then((m) => m.showToast('本地存储已满,新记录可能保存失败,请尽快到设置页导出备份'))
        .catch(() => {})
    }
  }
}

export function removeState(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* 忽略 */
  }
}

/** 导出全部数据为 JSON 文件下载 */
export function exportAll(data, filename = 'cookbook-backup.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 读取导入的 JSON 文件 */
export function importFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result))
      } catch (e) {
        reject(new Error('文件不是有效的 JSON'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

export function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
