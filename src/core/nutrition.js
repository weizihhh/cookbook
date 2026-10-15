// 营养目标计算 —— 纯函数,无框架依赖
// 公式:Mifflin-St Jeor(公开通用公式);数值为估算,供参考不作医疗建议
import { addDays, parseDate } from '../utils/date.js'

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: '久坐(几乎不运动)' },
  { value: 1.375, label: '轻度(每周运动1-3次)' },
  { value: 1.55, label: '中度(每周运动3-5次)' },
  { value: 1.725, label: '高度(每周运动6-7次)' },
]

export const GOAL_MODES = [
  { value: 'cut', label: '减脂', adjust: -0.17, hint: '热量缺口17%,配合力量训练保肌肉' },
  { value: 'maintain', label: '维持', adjust: 0, hint: '热量持平,体重稳定' },
  { value: 'bulk', label: '增肌', adjust: 0.1, hint: '热量盈余10%,配合训练增肌' },
]

// 宏量营养素预设:蛋白按 g/kg 定量、脂肪按供能占比、碳水补齐,
// 均参照运动营养学常用区间整理;等效供能比随个人数据变化,UI 中实时展示
export const MACRO_PRESETS = [
  {
    value: 'balanced', label: '均衡(膳食指南)',
    proteinPerKg: 1.4, fatRatio: 0.27,
    hint: '接近《中国居民膳食指南》的均衡结构,适合维持期与日常饮食',
  },
  {
    value: 'cut', label: '减脂·保肌(高蛋白)',
    proteinPerKg: 2.0, fatRatio: 0.25,
    hint: '高蛋白保肌肉、增饱腹感,碳水相对较低',
  },
  {
    value: 'bulk', label: '增肌·标准',
    proteinPerKg: 1.8, fatRatio: 0.25,
    hint: '蛋白修复肌肉,碳水支撑训练',
  },
  {
    value: 'bulk_high_carb', label: '增肌·高碳',
    proteinPerKg: 1.6, fatRatio: 0.2,
    hint: '碳水优先供训练,约 4-5g/kg;网传"三倍碳水"≈3g/kg,属增肌碳水参考范围(3-6g/kg)的下限',
  },
  { value: 'custom', label: '自定义', proteinPerKg: null, fatRatio: null, hint: '手动调整下方滑块' },
]

// 目标模式切换时默认套用的预设
export const MODE_PRESET = {
  cut: 'cut',
  maintain: 'balanced',
  bulk: 'bulk',
}

export const EXCLUDE_TAGS = [
  { value: 'pork', label: '猪肉' },
  { value: 'beef', label: '牛肉' },
  { value: 'chicken', label: '鸡肉' },
  { value: 'duck', label: '鸭肉' },
  { value: 'rabbit', label: '兔肉' },
  { value: 'lamb', label: '羊肉' },
  { value: 'seafood', label: '海鲜/鱼虾' },
  { value: 'egg', label: '蛋' },
  { value: 'milk', label: '奶制品' },
  { value: 'soy', label: '豆制品' },
  { value: 'spicy', label: '辣' },
  { value: 'gluten', label: '麸质/小麦' },
  { value: 'nuts', label: '坚果' },
]

// noTarget:加餐无目标额度(占比 0),只记录不考核;不计入 calcTargets 的三餐分配
export const MEALS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐', noTarget: true },
]

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const round = (v, digits = 0) => {
  const p = 10 ** digits
  return Math.round(v * p) / p
}

/** today 起往前 days 个日历日的窗口起始日(YYYY-MM-DD) */
function windowFrom(today, days) {
  const [y, m, d] = today.split('-').map(Number)
  const start = new Date(y, m - 1, d - (days - 1))
  const p = (n) => String(n).padStart(2, '0')
  return `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`
}

/** Mifflin-St Jeor 基础代谢 */
export function calcBMR({ gender, weight, height, age }) {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

/** 近 N 个日历日内的体重均值(稀疏称重:窗口内无记录返回 null) */
export function recentWeightAvg(records, today, days = 7) {
  const from = windowFrom(today, days)
  const inRange = records.filter((r) => r.date >= from && r.date <= today)
  if (!inRange.length) return null
  return inRange.reduce((s, r) => s + r.kg, 0) / inRange.length
}

/**
 * 半动态计算体重:近 7 天均值相对档案体重每满 2kg 调整一档,
 * 不足 2kg 不动(±1kg ≈ ±12-16 kcal/天,低于饮食记录误差,逐日微调只制造噪音);
 * 取整朝档案体重方向保守(涨 3.9kg 按 +2 算,降 3.9kg 按 -2 算)。
 * 热量与蛋白 g/kg 同步跟随该体重。无近期记录时用档案体重。
 */
export function effectiveWeight(profileWeight, recentAvg) {
  if (!(recentAvg > 0)) return profileWeight
  const steps = Math.trunc((recentAvg - profileWeight) / 2)
  return profileWeight + steps * 2
}

export function calcTDEE(bmr, activity) {
  return bmr * activity
}

/** 体脂能量密度常用近似:减/增 1kg 体重 ≈ 7700 kcal(个体与代谢适应会带来浮动) */
export const KCAL_PER_KG = 7700

/**
 * 理论体重进度:按"目标热量 vs TDEE"的静态缺口(减脂)/盈余(增肌)推算
 * 每周变化量与到达目标体重所需天数。维持模式(无缺口)、目标未设或方向与
 * 模式不符(如增肌却把目标设在当前之下)时返回 null。
 * @returns null | { gapKcal, weeklyKg, days, date }  weeklyKg 带符号(减脂为负)
 */
export function theoryProgress({ tdee, kcal, currentWeight, targetWeight, today }) {
  if (!(targetWeight > 0) || !(currentWeight > 0)) return null
  const gap = tdee - kcal
  if (Math.abs(gap) < 1) return null
  const remaining = currentWeight - targetWeight
  if (remaining === 0 || remaining * gap < 0) return null
  const weeklyKg = -(gap * 7) / KCAL_PER_KG // 缺口(正)→体重下降(负),盈余→上升
  const days = Math.ceil((Math.abs(remaining) * KCAL_PER_KG) / Math.abs(gap))
  return { gapKcal: Math.round(gap), weeklyKg, days, date: addDays(today, days) }
}

/**
 * 实测周变化率:近 windowDays 天(默认 28)窗口内体重记录首尾差换算 kg/周。
 * 与记录页"区间体重变化"同为首尾口径;少于 2 条或跨度不足 14 天返回 null
 * (短期水分波动会淹没真实趋势)。
 */
export function measuredWeeklyRate(records, today, windowDays = 28) {
  const from = windowFrom(today, windowDays)
  const inRange = records.filter((r) => r.date >= from && r.date <= today)
  if (inRange.length < 2) return null
  const spanMs = parseDate(inRange[inRange.length - 1].date) - parseDate(inRange[0].date)
  const spanDays = Math.round(spanMs / 86400000)
  if (spanDays < 14) return null
  return ((inRange[inRange.length - 1].kg - inRange[0].kg) / spanDays) * 7
}

/**
 * 计算完整目标
 * @param profile { gender, weight, height, age, activity, mode, manualKcal, proteinPerKg, fatRatio, mealSplit }
 * @returns { bmr, tdee, kcal, protein, carbs, fat, meals: [{key, kcal, protein, carbs, fat}] }
 */
export function calcTargets(profile) {
  const {
    gender,
    weight,
    height,
    age,
    activity,
    mode = 'maintain',
    manualKcal = null,
    proteinPerKg = 1.8,
    fatRatio = 0.25,
    mealSplit = [0.25, 0.45, 0.3],
  } = profile

  const bmr = calcBMR({ gender, weight, height, age })
  const tdee = calcTDEE(bmr, activity)
  const modeDef = GOAL_MODES.find((m) => m.value === mode) || GOAL_MODES[1]

  const kcal = manualKcal != null && manualKcal > 0 ? manualKcal : tdee * (1 + modeDef.adjust)

  // 蛋白按体重,脂肪按热量占比,碳水补齐
  const protein = weight * proteinPerKg
  const fat = (kcal * fatRatio) / 9
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4)

  const meals = MEALS.filter((m) => !m.noTarget).map((m, i) => ({
    key: m.key,
    kcal: round(kcal * mealSplit[i]),
    protein: round(protein * mealSplit[i], 1),
    carbs: round(carbs * mealSplit[i], 1),
    fat: round(fat * mealSplit[i], 1),
  }))

  return {
    bmr: round(bmr),
    tdee: round(tdee),
    kcal: round(kcal),
    protein: round(protein),
    carbs: round(carbs, 1),
    fat: round(fat, 1),
    meals,
  }
}
