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

export const EXCLUDE_TAGS = [
  { value: 'pork', label: '猪肉' },
  { value: 'beef', label: '牛肉' },
  { value: 'chicken', label: '鸡肉' },
  { value: 'duck', label: '鸭肉' },
  { value: 'rabbit', label: '兔肉' },
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
    mealSplit = [0.3, 0.4, 0.3],
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
