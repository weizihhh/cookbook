<template>
  <div class="page">
    <!-- 未完成设置 -->
    <van-empty
      v-if="!profile.isConfigured"
      image="search"
      description="先完善身体数据,才能计算你的每日热量与营养目标"
    >
      <van-button round type="primary" class="bottom-button" @click="$router.replace('/profile')">
        去设置
      </van-button>
    </van-empty>

    <template v-else>
      <!-- 目标概览:热量环主视觉 + 三大营养素逐行达标 -->
      <van-cell-group inset style="margin-bottom: 12px">
        <template #title>
          <div class="target-header">
            <span>今日目标 · {{ modeLabel }}</span>
          </div>
        </template>
        <div class="target-body">
          <div class="kcal-hero">
            <div class="kcal-ring">
              <svg viewBox="0 0 120 120">
                <circle class="ring-track" cx="60" cy="60" r="52" />
                <circle
                  class="ring-bar"
                  cx="60"
                  cy="60"
                  r="52"
                  :stroke="ringColor"
                  :stroke-dasharray="ringDash"
                />
              </svg>
              <div class="kcal-center">
                <div class="kcal-num">{{ totals.kcal }}</div>
                <div class="kcal-target">目标 {{ targets.kcal }} 千卡</div>
              </div>
            </div>
            <div class="kcal-caption">
              <span class="kcal-chip" :class="deviationClass">{{ deviationText }}</span>
              <span class="kcal-remaining">{{ remainingText }}</span>
            </div>
          </div>
          <div class="macro-divider"></div>
          <div v-for="m in macroRows" :key="m.key" class="metric-row">
            <div class="metric-head">
              <span class="metric-name">{{ m.label }}</span>
              <span class="metric-val"><b>{{ m.actual }}</b> / {{ m.target }} g</span>
              <span class="metric-status" :class="m.statusClass">{{ m.statusText }}</span>
            </div>
            <van-progress
              :percentage="m.pct"
              :show-pivot="false"
              :color="m.color"
              track-color="#eef2f0"
              rounded
            />
          </div>
          <div v-if="hasSkippedMeal" class="skip-note">已跳过的餐次不计入上方合计</div>
        </div>
      </van-cell-group>

      <!-- 体重快记 -->
      <van-cell-group inset style="margin-bottom: 12px">
        <template #title>
          <div class="target-header">
            <span>今日体重</span>
            <span v-if="weight.latest" class="weight-change" :class="weight.totalChange <= 0 ? 'ok' : 'over'">
              较首次 {{ weight.totalChange > 0 ? '+' : '' }}{{ weight.totalChange.toFixed(1) }}kg
            </span>
          </div>
        </template>
        <div class="weight-body">
          <van-field
            v-model="weightInput"
            type="number"
            placeholder="kg"
            class="weight-input"
            @keyup.enter="logWeight"
          />
          <van-button size="small" type="primary" @click="logWeight">记录</van-button>
          <svg v-if="trendPoints.length >= 2" class="trend" :viewBox="`0 0 ${trendPoints.length * 20} 36`">
            <polyline :points="trendPolyline" fill="none" stroke="#1989fa" stroke-width="2" />
            <circle
              v-for="(p, i) in trendPoints"
              :key="i"
              :cx="i * 20 + 4"
              :cy="p.y"
              r="2.5"
              :fill="i === trendPoints.length - 1 ? '#1989fa' : '#c8c9cc'"
            />
          </svg>
          <span v-else class="trend-empty">记录 2 次起显示趋势折线</span>
        </div>
      </van-cell-group>

      <!-- 三餐列表:免生成,未生成也可直接添加菜品记录实际进食 -->
      <van-cell-group
        v-for="meal in MEALS"
        :key="meal.key"
        inset
        style="margin-bottom: 12px"
      >
          <template #title>
            <div class="meal-header">
              <span>{{ meal.label }}</span>
              <span class="meal-target">
                实际 {{ mealActuals[meal.key].kcal }} / {{ mealTargets[meal.key].kcal }} 千卡
                · 蛋白 {{ mealActuals[meal.key].protein }} / {{ mealTargets[meal.key].protein }}g
                <van-tag
                  v-if="checkin.statusOf(today, meal.key)"
                  :type="checkin.statusOf(today, meal.key) === 'done' ? 'success' : 'default'"
                  size="medium"
                  style="margin-left: 4px"
                >
                  {{ checkin.statusOf(today, meal.key) === 'done' ? '已吃' : '跳过' }}
                </van-tag>
              </span>
            </div>
          </template>
          <template v-for="(item, i) in mealItems(meal.key)" :key="i">
            <van-cell
              v-if="item"
              is-link
              @click="openDetail(meal.key, i)"
            >
              <template #title>
                <span class="slot-chip">{{ SLOT_LABELS[item.slot] }}</span>
                {{ recipeName(item.recipeId) }}
              </template>
              <template #label>
                {{ ingredientText(item) }} · {{ itemNutrition(item).kcal }} 千卡
              </template>            </van-cell>
            <van-cell v-else title="该槽位没有可用食谱" label="排除项太多,去设置里调整偏好" />
          </template>
          <van-cell v-if="!mealItems(meal.key).length" title="未记录" label="点下方 + 添加菜品,记录实际吃的" />
          <div class="meal-actions">
            <van-button size="small" round plain type="primary" @click="openAdd(meal.key)">
              + 添加菜品
            </van-button>
            <van-button size="small" round plain type="primary" @click="openCheckin(meal.key)">
              打卡 · {{ checkinText(meal.key) }}
            </van-button>
            <van-button
              v-if="yesterdayCount(meal.key)"
              size="small"
              round
              plain
              type="primary"
              @click="copyYesterday(meal.key)"
            >
              复制昨日
            </van-button>
          </div>
        </van-cell-group>

        <div style="display: flex; gap: 10px">
          <template v-if="todayMeals">
            <van-button block round type="primary" plain @click="generate">重新生成</van-button>
            <van-button block round type="danger" plain @click="clearToday">清空</van-button>
          </template>
          <van-button v-else block round type="primary" @click="generate">生成今日三餐</van-button>
        </div>

      <!-- 每日贴士:置于页尾,轻度呈现 -->
      <div class="tips-card">
        <div class="tips-head">
          <span>💡 每日一读</span>
          <span class="tips-more" @click="$router.push('/profile')">全部贴士 →</span>
        </div>
        <div class="tips-title">{{ dailyTip.title }}</div>
        <div class="tips-text">{{ dailyTip.body }}</div>
      </div>
    </template>

    <!-- 食谱详情弹层 -->
    <MealDetailPopup
      v-model:show="detailShow"
      :item="detailItem"
      @swap="doSwap"
      @remove="doRemove"
      @grams-change="onGramsChange"
    />

    <!-- 添加菜品弹层 -->
    <AddRecipePopup v-model:show="addShow" :meal-key="addMealKey" @pick="doAdd" />

    <!-- 添加确认:先定克数再入餐 -->
    <AddConfirmPopup v-model:show="addConfirmShow" :draft="addDraft" :limit-hits="confirmLimitHits" @confirm="confirmAddDraft" />

    <!-- 打卡选择 -->
    <van-action-sheet
      v-model:show="checkinShow"
      :actions="checkinActions"
      cancel-text="取消"
      close-on-click-action
      @select="onCheckinSelect"
    />

    <!-- 复制方式选择:今天该餐已有菜品时,问追加还是覆盖 -->
    <van-action-sheet
      v-model:show="copySheetShow"
      :actions="copySheetActions"
      cancel-text="取消"
      close-on-click-action
      @select="onCopySheetSelect"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { MEALS, GOAL_MODES } from '../core/nutrition'
import { SLOT_LABELS, computeNutrition, summarizeIntake, recentFoodDays, weeklyLimitHits } from '../core/planner'
import { FOODS_MAP, formatFoodAmount, snapGramsToUnit } from '../data/foods'
import { RECIPES_MAP } from '../data/recipes'
import { useProfileStore } from '../stores/profile'
import { useWeekStore } from '../stores/week'
import { useCheckinStore } from '../stores/checkin'
import { useWeightStore } from '../stores/weight'
import { parseDate, addDays } from '../utils/date'
import { useToday } from '../composables/useToday'
import { TIPS } from '../data/tips'
import MealDetailPopup from '../components/today/MealDetailPopup.vue'
import AddRecipePopup from '../components/today/AddRecipePopup.vue'
import AddConfirmPopup from '../components/today/AddConfirmPopup.vue'

const profile = useProfileStore()
const week = useWeekStore()
const checkin = useCheckinStore()
const weight = useWeightStore()
// 跨零点自愈:页面常驻后台过夜后 today 会刷新为新的当天,记录/打卡不再写错日期
const today = useToday()
const yesterday = computed(() => addDays(today.value, -1))

// 按日期轮换,一天一条看完全部
const dailyTip = computed(() => {
  const dayNumber = Math.floor(parseDate(today.value).getTime() / 86400000)
  return TIPS[dayNumber % TIPS.length]
})

const targets = computed(() => profile.targets)
const modeLabel = computed(
  () => GOAL_MODES.find((m) => m.value === profile.mode)?.label || ''
)
const todayMeals = computed(() => week.mealsOf(today.value))

const kcalPercentage = computed(() =>
  targets.value.kcal > 0
    ? Math.min(100, Math.round((totals.value.kcal / targets.value.kcal) * 100))
    : 0
)
const allSkipped = computed(() => MEALS.every((m) => mealActuals.value[m.key]?.skipped))
// 当天是否记录过任何条目(空天/未记录时状态文案用"未记录",不算偏差)
const hasAnyItem = computed(() =>
  MEALS.some((m) => (todayMeals.value?.[m.key] || []).some(Boolean))
)
const deviationClass = computed(() => {
  if (!hasAnyItem.value) return 'none'
  if (allSkipped.value) return 'none'
  const d = Math.round(((totals.value.kcal - targets.value.kcal) / targets.value.kcal) * 100)
  if (Math.abs(d) <= 10) return 'ok'
  return d > 0 ? 'over' : 'under'
})
const deviationText = computed(() => {
  if (!hasAnyItem.value) return '未记录'
  if (allSkipped.value) return '今日未进食'
  const d = Math.round(((totals.value.kcal - targets.value.kcal) / targets.value.kcal) * 100)
  if (Math.abs(d) <= 10) return '达标 ✓'
  return d > 0 ? `超 ${d}%` : `低 ${-d}%`
})

const mealTargets = computed(() =>
  Object.fromEntries(targets.value.meals.map((m) => [m.key, m]))
)

// 每餐实际合计(随添加/移除/改克数实时变化);skipped 标记该餐是否被打卡跳过
const mealActuals = computed(() => {
  const out = {}
  for (const m of MEALS) {
    const items = todayMeals.value?.[m.key] || []
    const total = { kcal: 0, protein: 0 }
    for (const it of items) {
      if (!it) continue
      const n = computeNutrition(it.ingredients, FOODS_MAP)
      total.kcal += n.kcal
      total.protein += n.protein
    }
    out[m.key] = {
      kcal: Math.round(total.kcal),
      protein: Math.round(total.protein),
      skipped: checkin.statusOf(today.value, m.key) === 'skip',
    }
  }
  return out
})

// 顶部合计按"已吃"口径:跳过的餐次不计入(打卡 skip 表示没吃这餐)。
// 实现下沉到 summarizeIntake(skipMealKeys),与记录页统计共用同一口径
const totals = computed(() => {
  if (!todayMeals.value) return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  const skipped = MEALS.filter((m) => mealActuals.value[m.key].skipped).map((m) => m.key)
  const s = summarizeIntake({ date: today.value, meals: todayMeals.value }, FOODS_MAP, targets.value, skipped).totals
  return { ...s, protein: Math.round(s.protein) }
})
const hasSkippedMeal = computed(() => MEALS.some((m) => mealActuals.value[m.key]?.skipped))

// 三大营养素逐行展示:实际/目标 + 进度条 + 达标状态;±10% 内视为达标(与热量口径一致)
const MACRO_META = [
  { key: 'protein', label: '蛋白质', color: '#00b578' },
  { key: 'carbs', label: '碳水', color: '#1989fa' },
  { key: 'fat', label: '脂肪', color: '#ff976a' },
]
const macroRows = computed(() =>
  MACRO_META.map((meta) => {
    const actual = totals.value[meta.key] ?? 0
    const target = targets.value[meta.key] || 0
    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0
    let statusClass = 'none'
    let statusText = '—'
    if (hasAnyItem.value && !allSkipped.value && target > 0) {
      const d = Math.round(((actual - target) / target) * 100)
      if (Math.abs(d) <= 10) {
        statusClass = 'ok'
        statusText = '达标 ✓'
      } else if (d > 0) {
        statusClass = 'over'
        statusText = `超 ${d}%`
      } else {
        statusClass = 'under'
        statusText = `低 ${-d}%`
      }
    }
    return { ...meta, actual, target, pct, statusClass, statusText }
  })
)

// 热量环:SVG 圆环,颜色随达标状态变化(stroke 属性不支持 var(),用色值)
const RING_CIRCUMFERENCE = 2 * Math.PI * 52
const ringColor = computed(
  () =>
    ({ ok: '#00b578', over: '#ee0a24', under: '#ff976a', none: '#dce1de' })[
      deviationClass.value
    ] || '#00b578'
)
const ringDash = computed(
  () => `${(kcalPercentage.value / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`
)
const remainingText = computed(() => {
  if (!hasAnyItem.value) return '记录菜品后开始统计'
  if (allSkipped.value) return '今日未进食'
  const r = Math.round(targets.value.kcal - totals.value.kcal)
  return r >= 0 ? `还可摄入 ${r} 千卡` : `已超 ${-r} 千卡`
})

// 重新生成:已打卡"已吃"的餐视为锁定(与清空保护同语义)——先问是否一并重生成;
// 被重新生成的餐同步清打卡标记,避免"已吃/跳过"悬挂到新内容上
async function generate() {
  const locked = MEALS.filter((m) => checkin.statusOf(today.value, m.key) === 'done')
  if (!locked.length) {
    regen([])
    return
  }
  const names = locked.map((m) => m.label).join('、')
  let regenAll = false
  try {
    await showConfirmDialog({
      title: `${names}已打卡"已吃"`,
      message: '已吃的餐是既成记录。要重新生成这些内容吗?取消则保留已吃的餐,只重新生成其余。',
      confirmButtonText: '全部重新生成',
      cancelButtonText: '保留已吃',
    })
    regenAll = true
  } catch {
    regenAll = false
  }
  regen(regenAll ? [] : locked.map((m) => m.key), regenAll ? '' : names)
}

function regen(keepMealKeys, lockedNames = '') {
  week.generateDay(today.value, keepMealKeys)
  const keep = new Set(keepMealKeys)
  for (const m of MEALS) {
    // 重新生成的餐清打卡;保留的餐若内容为空(此前对空餐打过卡)同样清,
    // 避免"已吃"标记悬空在空餐上与"未记录"同屏矛盾
    const keptEmpty = keep.has(m.key) && !(week.mealsOf(today.value)?.[m.key] || []).some(Boolean)
    if (!keep.has(m.key) || keptEmpty) checkin.mark(today.value, m.key, null)
  }
  showToast(lockedNames ? `已重新生成,保留已吃的${lockedNames}` : '已生成')
}
// 清空:已打卡"已吃"的餐视为锁定——先问是否一并清;取消则保留已吃的餐,只清其余。
// 清掉的餐同步清打卡标记,避免"已吃/跳过"tag 悬挂在空餐上。
async function clearToday() {
  const locked = MEALS.filter((m) => checkin.statusOf(today.value, m.key) === 'done')
  if (!locked.length) {
    week.clearDay(today.value)
    for (const m of MEALS) checkin.mark(today.value, m.key, null)
    showToast('已清空')
    return
  }
  const names = locked.map((m) => m.label).join('、')
  let clearAll = false
  try {
    await showConfirmDialog({
      title: `${names}已打卡"已吃"`,
      message: '已吃的餐视为已锁定。要连同这些记录一并清空吗?取消则保留已吃的餐,只清空其余。',
      confirmButtonText: '一并清空',
      cancelButtonText: '保留已吃',
    })
    clearAll = true
  } catch {
    clearAll = false
  }
  if (clearAll) {
    week.clearDay(today.value)
    for (const m of MEALS) checkin.mark(today.value, m.key, null)
    showToast('已清空')
  } else {
    week.clearDayExcept(today.value, locked.map((m) => m.key))
    for (const m of MEALS) {
      if (checkin.statusOf(today.value, m.key) !== 'done') checkin.mark(today.value, m.key, null)
    }
    showToast(`已清空,保留已吃的${names}`)
  }
}
function mealItems(mealKey) {
  return todayMeals.value?.[mealKey] || []
}

// ---- 复制昨日:吃的单一固定时,一键把昨天同餐的记录搬到今天 ----
function yesterdayCount(mealKey) {
  return (week.mealsOf(yesterday.value)?.[mealKey] || []).filter(Boolean).length
}
// 今天该餐为空直接复制;已有菜品时让用户选追加还是覆盖
function copyYesterday(mealKey) {
  if (!mealItems(mealKey).length) {
    doCopyYesterday(mealKey, 'copy')
    return
  }
  copySheetMeal.value = mealKey
  copySheetShow.value = true
}
const copySheetShow = ref(false)
const copySheetMeal = ref('')
const copySheetActions = [
  { name: '追加到现有菜品后', value: 'append' },
  { name: '覆盖现有菜品', value: 'replace' },
]
function onCopySheetSelect(action) {
  doCopyYesterday(copySheetMeal.value, action.value)
}
function doCopyYesterday(mealKey, mode) {
  const label = MEALS.find((m) => m.key === mealKey)?.label || ''
  const n = week.copyMeal(yesterday.value, today.value, mealKey, mode === 'replace')
  if (!n) return
  // 覆盖=该餐记录重来,清掉旧打卡标记防悬挂
  if (mode === 'replace') checkin.mark(today.value, mealKey, null)
  const prefix =
    mode === 'replace' ? `已覆盖为昨日${label}` : mode === 'append' ? `已追加昨日${label}` : `已复制昨日${label}`
  showToast(`${prefix} ${n} 个菜品`)
}

// ---- 体重 ----
const weightInput = ref(weight.kgOf(today.value) != null ? String(weight.kgOf(today.value)) : '')
// 跨零点跟随:today 刷新后输入框重置为新当天已记值,防止次日直接点"记录"
// 把昨天显示的旧值写进新日期
watch(today, (t) => {
  const kg = weight.kgOf(t)
  weightInput.value = kg != null ? String(kg) : ''
})

function logWeight() {
  const kg = Number(weightInput.value)
  if (!(kg > 0 && kg < 500)) {
    showToast('请输入有效体重')
    return
  }
  weight.log(today.value, kg)
  showToast('已记录')
}

/** 最近 14 条记录的迷你趋势点(归一化到 36px 高) */
const trendPoints = computed(() => {
  const recent = weight.records.slice(-14)
  if (recent.length < 2) return []
  const kgs = recent.map((r) => r.kg)
  const min = Math.min(...kgs)
  const max = Math.max(...kgs)
  const span = Math.max(max - min, 0.1) // 防止全部相同除零
  return recent.map((r) => ({ y: 30 - ((r.kg - min) / span) * 24 + 3 }))
})
const trendPolyline = computed(() =>
  trendPoints.value.map((p, i) => `${i * 20 + 4},${p.y}`).join(' ')
)

// ---- 打卡 ----
const checkinShow = ref(false)
const checkinMeal = ref('')
const checkinActions = [
  { name: '已按计划吃', value: 'done' },
  { name: '这餐跳过了', value: 'skip' },
  { name: '清除打卡', value: null },
]
function checkinText(mealKey) {
  const s = checkin.statusOf(today.value, mealKey)
  return s === 'done' ? '已吃 ✓' : s === 'skip' ? '跳过' : '未打卡'
}
function openCheckin(mealKey) {
  checkinMeal.value = mealKey
  checkinShow.value = true
}
function onCheckinSelect(action) {
  checkin.mark(today.value, checkinMeal.value, action.value)
}

// ---- 详情弹层:定位条目,编辑与换菜/移除事件转给 week store ----
const detailShow = ref(false)
const detailMealKey = ref(null)
const detailIndex = ref(-1)
const detailItem = computed(() =>
  detailShow.value && todayMeals.value && detailMealKey.value != null
    ? todayMeals.value[detailMealKey.value][detailIndex.value]
    : null
)

function openDetail(mealKey, index) {
  detailMealKey.value = mealKey
  detailIndex.value = index
  detailShow.value = true
}

function doSwap() {
  const ok = week.swap(today.value, detailMealKey.value, detailItem.value.slot, detailIndex.value)
  if (!ok) {
    showToast('没有其他可用的候选了')
    return
  }
  detailShow.value = false
}

function onGramsChange(foodId, v) {
  week.updateGrams(today.value, detailMealKey.value, detailIndex.value, foodId, v)
}

function doRemove() {
  week.removeItem(today.value, detailMealKey.value, detailIndex.value)
  detailShow.value = false
  showToast('已移除')
}

// ---- 添加菜品:弹层与确认层为子组件,这里只构造 draft 与入餐 ----
const addShow = ref(false)
const addMealKey = ref('')

function openAdd(mealKey) {
  addMealKey.value = mealKey
  addShow.value = true
}

function doAdd(recipe) {
  // 打开确认弹层:先调整克数(个数型按"个"),再确认入餐。
  // 可缩放的小单位食材基准份吸附到整数倍(与生成端同规则):
  // 自定义食物基准 100g/袋30g 这类非整数倍,不吸附会出现"3袋(100g)"的袋数克数不自洽
  addDraft.value = {
    recipeId: recipe.id,
    slot: recipe.slot,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      grams: ing.scalable ? Math.round(snapGramsToUnit(FOODS_MAP[ing.foodId], ing.grams)) : ing.grams,
    })),
  }
  addShow.value = false
  addConfirmShow.value = true
}

const addConfirmShow = ref(false)
const addDraft = ref(null)
// 频次约束软提示:确认层所含食材近 7 天已吃满建议上限(达到即提示,不阻断)
const confirmLimitHits = computed(() =>
  addDraft.value
    ? weeklyLimitHits(addDraft.value.ingredients, FOODS_MAP, recentFoodDays(week.days, today.value))
    : []
)

function confirmAddDraft() {
  if (!addDraft.value) return
  const recipe = RECIPES_MAP[addDraft.value.recipeId]
  const result = week.addItemCustom(today.value, addMealKey.value, recipe.id, addDraft.value.ingredients)
  if (result === 'added') {
    showToast(`已添加:${recipe.name}`)
  } else if (result === 'merged') {
    const main = week.mealsOf(today.value)?.[addMealKey.value]?.find((it) => it.recipeId === recipe.id)
    const mainIng = main?.ingredients.find((i) => i.scalable) || main?.ingredients[0]
    showToast(`已累加:${recipe.name}(共 ${formatFoodAmount(FOODS_MAP[mainIng?.foodId], mainIng?.grams || 0)})`)
  }
  addConfirmShow.value = false
}

// ---- 列表辅助 ----
function recipeName(id) {
  return RECIPES_MAP[id]?.name || id
}
function itemNutrition(item) {
  return computeNutrition(item.ingredients, FOODS_MAP)
}
function ingredientText(item) {
  return item.ingredients
    .map((ing) => `${FOODS_MAP[ing.foodId]?.name || ''} ${formatFoodAmount(FOODS_MAP[ing.foodId], ing.grams)}`)
    .join(' + ')
}
</script>

<style scoped>
.bottom-button {
  width: 160px;
}
.target-header,
.meal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.meal-target {
  font-size: 11px;
  color: #969799;
  font-weight: normal;
  text-align: right;
}
.metric-row + .metric-row {
  margin-top: 12px;
}
.metric-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 5px;
}
.metric-name {
  flex: 0 0 3.5em;
  font-size: 13px;
  color: #323233;
}
.metric-val {
  flex: 1;
  font-size: 13px;
  color: #646566;
}
.metric-val b {
  color: #323233;
  font-weight: 600;
}
.metric-status {
  font-size: 12px;
}
.metric-status.none {
  color: #c8c9cc;
}
.metric-status.ok {
  color: var(--cb-primary);
}
.metric-status.over {
  color: #ee0a24;
}
.metric-status.under {
  color: #ff976a;
}
.skip-note {
  margin-top: 6px;
  font-size: 11px;
  color: #969799;
}
.weight-change {
  font-size: 12px;
  font-weight: normal;
}
.weight-change.ok {
  color: var(--cb-primary);
}
.weight-change.over {
  color: #ff976a;
}
.target-body {
  padding: 8px 16px 14px;
}
/* 热量环主视觉 */
.kcal-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0 2px;
}
.kcal-ring {
  position: relative;
  width: 132px;
  height: 132px;
}
.kcal-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-track {
  fill: none;
  stroke: #edf1ef;
  stroke-width: 10;
}
.ring-bar {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s;
}
.kcal-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.kcal-num {
  font-size: 30px;
  font-weight: 700;
  color: var(--cb-text, #1f2d27);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.kcal-target {
  font-size: 11px;
  color: #969799;
  margin-top: 2px;
}
.kcal-caption {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.kcal-chip {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
}
.kcal-chip.none {
  background: #f1f3f2;
  color: #969799;
}
.kcal-chip.ok {
  background: var(--cb-primary-light);
  color: var(--cb-primary);
}
.kcal-chip.over {
  background: #ffeceb;
  color: #ee0a24;
}
.kcal-chip.under {
  background: #fff3eb;
  color: #ff976a;
}
.kcal-remaining {
  font-size: 12px;
  color: #697771;
}
.macro-divider {
  height: 1px;
  background: #eef2f0;
  margin: 12px 0;
}
.slot-chip {
  display: inline-block;
  padding: 2px 8px;
  margin-right: 6px;
  border-radius: 999px;
  background: var(--cb-primary-light);
  color: var(--cb-primary);
  font-size: 10px;
  vertical-align: 1px;
}
.meal-actions {
  display: flex;
  gap: 10px;
  padding: 8px 16px 12px;
}
.meal-actions .van-button {
  flex: 1;
}
.weight-body {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px 12px;
}
.weight-input {
  flex: 0 0 110px;
  padding: 6px 14px;
  background: #f7f8fa;
  border-radius: 999px;
}
.trend {
  flex: 1;
  height: 36px;
  min-width: 0;
}
.trend-empty {
  flex: 1;
  font-size: 11px;
  color: #c8c9cc;
}
.tips-card {
  background: linear-gradient(135deg, #e9f8f1, #f2fbf7);
  border-radius: var(--cb-card-radius);
  padding: 12px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(31, 45, 39, 0.05);
}
.tips-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tips-more {
  font-size: 12px;
  color: var(--cb-primary);
  font-weight: normal;
}
.tips-title {
  font-size: 14px;
  font-weight: 600;
  margin: 8px 0 4px;
}
.tips-text {
  font-size: 13px;
  color: #646566;
  line-height: 1.7;
}
</style>
