// 营养目标计算 —— 纯函数,无框架依赖
// 公式:Mifflin-St Jeor(公开通用公式);数值为估算,供参考不作医疗建议

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

export const MEALS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
]

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const round = (v, digits = 0) => {
  const p = 10 ** digits
  return Math.round(v * p) / p
}

/** Mifflin-St Jeor 基础代谢 */
export function calcBMR({ gender, weight, height, age }) {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

/** 近 N 个日历日内的体重均值(稀疏称重:窗口内无记录返回 null) */
export function recentWeightAvg(records, today, days = 7) {
  const [y, m, d] = today.split('-').map(Number)
  const start = new Date(y, m - 1, d - (days - 1))
  const p = (n) => String(n).padStart(2, '0')
  const from = `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`
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

  const meals = MEALS.map((m, i) => ({
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
