// 营养成分表 OCR 文本解析 —— 纯函数
//
// 中文包装成分表的常见形态(OCR 后行序/空格/单位都可能混乱):
//   项目        每100g    NRV%
//   能量        1600千焦   19%
//   蛋白质      8.0克     13%
//   脂肪        15.2克     25%
//   碳水化合物   62.0克    21%
// 口径三种:每100g / 每100mL(按 1g/mL 近似)/ 每份(需每份克数换算)。
// OCR 只是预填辅助:数值认错(如 24.1 认成 21)对营养计算是致命的,
// 一切以确认层人工核对为准。

const NUM = '(-?\\d+(?:\\.\\d+)?)'

/** 千焦 → 千卡(1 kcal = 4.184 kJ) */
export function kjToKcal(kj) {
  return Math.round((kj / 4.184) * 10) / 10
}

/** 行内第一个"数字+物理单位"匹配;OCR 常把 g 认成 9(如 "8.0g"→"8.09"),
 *  匹配不到单位时退化为行内第一个数字(范围校验交给调用方/确认层)。
 *  "千焦"常被认成形近的"干焦",一并接受 */
function rowValue(line) {
  const m = line.match(new RegExp(`${NUM}\\s*([干千]焦|kJ|[Kk][Jj]|千卡|kcal|大卡|克|[gG]|毫克|mg)`))
  if (m) return Number(m[1])
  const bare = line.match(new RegExp(`${NUM}`))
  return bare ? Number(bare[1]) : null
}

/** 口径识别:表头可能独立成行,也可能与项目/数值粘在一行 */
function detectBasis(text) {
  if (new RegExp(`每\\s*100\\s*(克|[gG])`).test(text)) return { basis: '100g', perServeGrams: null }
  if (/每\s*100\s*(毫升|[mM][lL])/.test(text)) return { basis: '100ml', perServeGrams: null }
  const m = text.match(new RegExp(`每份[^\\d\\n]{0,8}${NUM}\\s*(克|[gG])`))
  if (m) return { basis: 'perServe', perServeGrams: Number(m[1]) }
  if (/每份/.test(text)) return { basis: 'perServe', perServeGrams: null }
  return { basis: '100g', perServeGrams: null } // 表头没认出来时按最常见口径,确认层兜底
}

/** 首个命中谓词的行取数值 */
function pick(lines, pred) {
  for (const line of lines) {
    if (!pred(line)) continue
    const v = rowValue(line)
    if (v != null) return v
  }
  return null
}

/**
 * 解析成分表文本。能量+三大营养素至少抓到 3 项才认为有效,否则返回 null(走纯手填)。
 * @returns null | { basis, perServeGrams, energyKj, energyKcal, protein, carbs, fat }(数值均为包装口径原值)
 */
export function parseNutritionLabel(text) {
  if (!text) return null
  // OCR 对中文常逐字识别带字间空格("蛋白 质""碳水 化 合 物"),
  // 关键词按连续子串匹配,必须先逐行去空白再匹配
  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.replace(/\s+/g, ''))
    .filter(Boolean)
  const flat = lines.join('\n')

  const { basis, perServeGrams } = detectBasis(flat)

  const energyLine = lines.find((l) => /能量|热量/.test(l))
  let energyKj = null
  let energyKcal = null
  if (energyLine) {
    const v = rowValue(energyLine)
    if (v != null) {
      if (/千卡|kcal|大卡/i.test(energyLine)) energyKcal = v
      else energyKj = v
    }
  }

  const protein = pick(lines, (l) => l.includes('蛋白质'))
  const carbs = pick(lines, (l) => /碳水化合物/.test(l))
  // 细分行(饱和/反式脂肪)不得抢主行;全表只有细分时退而取之(低估,确认层可改)
  const fat =
    pick(lines, (l) => l.includes('脂肪') && !/饱和|反式/.test(l)) ??
    pick(lines, (l) => /饱和脂肪/.test(l))
  // 膳食纤维:国标成分表常见行,可不出现;不参与"至少 3 项"有效性判定
  const fiber = pick(lines, (l) => l.includes('膳食纤维'))

  const hits = [energyKj != null || energyKcal != null, protein != null, carbs != null, fat != null].filter(
    Boolean
  ).length
  if (hits < 3) return null

  return { basis, perServeGrams, energyKj, energyKcal, protein, carbs, fat, fiber }
}

/**
 * 任意口径归一到每 100g。
 * @param serveGramsOverride "每份"口径下补填的每份克数(优先于解析值)
 * @returns null(每份但缺克数)| { kcal, protein, carbs, fat }
 */
export function normalizeTo100g(parsed, serveGramsOverride = null) {
  const pg = serveGramsOverride ?? parsed.perServeGrams
  const factor = parsed.basis === 'perServe' ? (pg > 0 ? 100 / pg : null) : 1
  if (factor == null) return null
  const r1 = (v) => (v == null ? null : Math.round(v * factor * 10) / 10)
  return {
    kcal:
      parsed.energyKcal != null
        ? r1(parsed.energyKcal)
        : parsed.energyKj != null
          ? kjToKcal(parsed.energyKj * factor)
          : null,
    protein: r1(parsed.protein),
    carbs: r1(parsed.carbs),
    fat: r1(parsed.fat),
    fiber: r1(parsed.fiber),
  }
}
