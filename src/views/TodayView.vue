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
    <van-popup
      v-model:show="detailShow"
      position="bottom"
      round
      :style="{ maxHeight: '75%' }"
    >
      <div v-if="detailItem" class="detail">
        <div class="detail-title">
          {{ recipeName(detailItem.recipeId) }}
          <van-tag v-if="detailRecipe?.antiInfl" color="var(--cb-primary)" size="large" style="vertical-align: 2px">抗炎</van-tag>
        </div>
        <div class="nutri-grid" style="margin-bottom: 12px">
          <div><div class="num">{{ detailNutrition.kcal }}</div><div class="label">千卡</div></div>
          <div><div class="num">{{ detailNutrition.protein }}g</div><div class="label">蛋白质</div></div>
          <div><div class="num">{{ detailNutrition.carbs }}g</div><div class="label">碳水</div></div>
          <div><div class="num">{{ detailNutrition.fat }}g</div><div class="label">脂肪</div></div>
        </div>
        <van-cell title="食材用量" />
        <van-cell v-for="ing in detailItem.ingredients" :key="ing.foodId">
          <template #title>
            {{ FOODS_MAP[ing.foodId]?.name }}
            <span v-if="unitOf(ing.foodId)" class="unit-hint">({{ unitOf(ing.foodId) }})</span>
          </template>
          <template #label>{{ ing.grams }}g</template>
          <template #value>
            <!-- 个数型食材按"个"步进,其余按 5g 步进 -->
            <van-stepper
              v-if="unitOf(ing.foodId)"
              :model-value="Math.round((ing.grams / unitGramsOf(ing.foodId)) * 10) / 10"
              :min="1"
              :max="Math.ceil(1000 / unitGramsOf(ing.foodId))"
              :step="1"
              :decimal-length="unitGramsOf(ing.foodId) >= 100 ? 1 : 0"
              input-width="40px"
              button-size="24px"
              @change="(v) => onGramsChange(ing.foodId, v * unitGramsOf(ing.foodId))"
            />
            <van-stepper
              v-else
              :model-value="ing.grams"
              :min="5"
              :max="1000"
              :step="5"
              integer
              input-width="44px"
              button-size="24px"
              @change="(v) => onGramsChange(ing.foodId, v)"
            />
          </template>
        </van-cell>
        <template v-if="detailRecipe?.steps?.length">
          <van-cell title="做法" />
          <div class="steps">
            <ol>
              <li v-for="(s, i) in detailRecipe.steps" :key="i">{{ s }}</li>
            </ol>
          </div>
        </template>
        <div style="display: flex; gap: 10px; margin: 12px 0">
          <van-button v-if="!detailItem.custom" block type="primary" @click="doSwap">
            换一个{{ SLOT_LABELS[detailItem.slot] }}
          </van-button>
          <van-button block type="danger" plain @click="doRemove">
            移除此菜
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 添加菜品弹层 -->
    <van-popup v-model:show="addShow" position="bottom" round :style="{ height: '72%' }">
      <div class="add-panel">
        <van-search v-model="addSearch" placeholder="搜索食谱,如:鸡胸、豆腐" />
        <div v-if="recentRecipeIds.length" class="recent-row">
          <span class="recent-label">最近</span>
          <div class="recent-chips">
            <van-tag
              v-for="id in recentRecipeIds"
              :key="id"
              plain
              type="primary"
              size="large"
              class="recent-chip"
              @click="quickAdd(id)"
            >
              {{ recipeName(id) }}
            </van-tag>
          </div>
        </div>
        <van-tabs v-model:active="addTab" shrink>
          <van-tab v-for="s in addSlots" :key="s.value" :title="s.label">
            <div class="add-list">
              <van-cell
                v-for="r in filteredAddRecipes(s.value)"
                :key="r.id"
                is-link
                @click="doAdd(r)"
              >
                <template #title>
                  {{ r.name }}
                  <van-tag v-if="r.antiInfl" color="var(--cb-primary)" size="medium" style="margin-left: 4px">抗炎</van-tag>
                  <van-tag v-if="r.custom" plain type="primary" size="medium" style="margin-left: 4px">
                    {{ r.source || '自定义' }}
                  </van-tag>
                  <van-tag v-if="addSearch.trim() && !r.mealFit.includes(addMealKey)" color="#c8c9cc" size="medium" style="margin-left: 4px">
                    非{{ addMealLabel }}
                  </van-tag>
                </template>
                <template #value>
                  <span class="add-kcal">{{ baseKcal(r) }} 千卡/基准份</span>
                </template>
              </van-cell>
              <van-empty v-if="!filteredAddRecipes(s.value).length" image-size="60" description="没有匹配的食谱" />
            </div>
          </van-tab>
        </van-tabs>
      </div>
    </van-popup>

    <!-- 添加确认:先定克数再入餐 -->
    <van-popup v-model:show="addConfirmShow" position="bottom" round :style="{ maxHeight: '70%' }">
      <div v-if="addDraft" class="detail">
        <div class="detail-title">
          添加:{{ RECIPES_MAP[addDraft.recipeId]?.name }}
          <van-tag v-if="RECIPES_MAP[addDraft.recipeId]?.antiInfl" color="var(--cb-primary)" size="large" style="vertical-align: 2px">抗炎</van-tag>
        </div>
        <van-cell title="用量调整" />
        <van-cell v-for="ing in addDraft.ingredients" :key="ing.foodId">
          <template #title>
            {{ FOODS_MAP[ing.foodId]?.name }}
            <span v-if="unitOf(ing.foodId)" class="unit-hint">({{ unitOf(ing.foodId) }})</span>
          </template>
          <template #label>{{ ing.grams }}g</template>
          <template #value>
            <van-stepper
              v-if="unitOf(ing.foodId)"
              :model-value="Math.round((ing.grams / unitGramsOf(ing.foodId)) * 10) / 10"
              :min="1"
              :max="Math.ceil(1000 / unitGramsOf(ing.foodId))"
              :step="1"
              :decimal-length="unitGramsOf(ing.foodId) >= 100 ? 1 : 0"
              input-width="40px"
              button-size="24px"
              @change="(v) => (ing.grams = Math.round(v * unitGramsOf(ing.foodId)))"
            />
            <van-stepper
              v-else
              :model-value="ing.grams"
              :min="5"
              :max="1000"
              :step="5"
              integer
              input-width="44px"
              button-size="24px"
              @change="(v) => (ing.grams = v)"
            />
          </template>
        </van-cell>
        <div class="nutri-grid" style="margin: 10px 0">
          <div><div class="num">{{ draftNutrition.kcal }}</div><div class="label">千卡</div></div>
          <div><div class="num">{{ draftNutrition.protein }}g</div><div class="label">蛋白质</div></div>
          <div><div class="num">{{ draftNutrition.carbs }}g</div><div class="label">碳水</div></div>
          <div><div class="num">{{ draftNutrition.fat }}g</div><div class="label">脂肪</div></div>
        </div>
        <div style="display: flex; gap: 10px; margin: 12px 0">
          <van-button block @click="addConfirmShow = false">取消</van-button>
          <van-button block type="primary" @click="confirmAddDraft">添加</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 打卡选择 -->
    <van-action-sheet
      v-model:show="checkinShow"
      :actions="checkinActions"
      cancel-text="取消"
      close-on-click-action
      @select="onCheckinSelect"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast } from 'vant'
import { MEALS, GOAL_MODES } from '../core/nutrition'
import { SLOT_LABELS, computeNutrition } from '../core/planner'
import { FOODS_MAP, formatFoodAmount } from '../data/foods'
import { RECIPES, RECIPES_MAP } from '../data/recipes'
import { useProfileStore } from '../stores/profile'
import { useWeekStore } from '../stores/week'
import { useCheckinStore } from '../stores/checkin'
import { useWeightStore } from '../stores/weight'
import { useCustomFoodsStore } from '../stores/customFoods'
import { todayStr, parseDate } from '../utils/date'
import { TIPS } from '../data/tips'

const profile = useProfileStore()
const week = useWeekStore()
const checkin = useCheckinStore()
const weight = useWeightStore()
const customFoods = useCustomFoodsStore()
customFoods.sync() // 注册进 RECIPES_MAP,添加菜品/详情/加餐链路即席可用
const today = todayStr()

// 按日期轮换,一天一条看完全部
const dailyTip = computed(() => {
  const dayNumber = Math.floor(parseDate(today).getTime() / 86400000)
  return TIPS[dayNumber % TIPS.length]
})

const targets = computed(() => profile.targets)
const modeLabel = computed(
  () => GOAL_MODES.find((m) => m.value === profile.mode)?.label || ''
)
const todayMeals = computed(() => week.mealsOf(today))
const summary = computed(() => (todayMeals.value ? week.summaryOf(today) : null))

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
  if (!summary.value || !hasAnyItem.value) return 'none'
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
      skipped: checkin.statusOf(today, m.key) === 'skip',
    }
  }
  return out
})

// 顶部合计按"已吃"口径:跳过的餐次不计入(打卡 skip 表示没吃这餐)
const totals = computed(() => {
  if (!todayMeals.value) return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  const out = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const m of MEALS) {
    if (mealActuals.value[m.key].skipped) continue
    for (const it of todayMeals.value[m.key] || []) {
      if (!it) continue
      const n = computeNutrition(it.ingredients, FOODS_MAP)
      out.kcal += n.kcal
      out.protein += n.protein
      out.carbs += n.carbs
      out.fat += n.fat
    }
  }
  out.kcal = Math.round(out.kcal)
  out.protein = Math.round(out.protein)
  out.carbs = Math.round(out.carbs * 10) / 10
  out.fat = Math.round(out.fat * 10) / 10
  return out
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
    if (summary.value && hasAnyItem.value && !allSkipped.value && target > 0) {
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

function generate() {
  week.generateDay(today)
  showToast('已生成')
}
function clearToday() {
  week.clearDay(today)
}
function mealItems(mealKey) {
  return todayMeals.value?.[mealKey] || []
}

// ---- 体重 ----
const weightInput = ref(weight.kgOf(today) != null ? String(weight.kgOf(today)) : '')

function logWeight() {
  const kg = Number(weightInput.value)
  if (!(kg > 0 && kg < 500)) {
    showToast('请输入有效体重')
    return
  }
  weight.log(today, kg)
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
  const s = checkin.statusOf(today, mealKey)
  return s === 'done' ? '已吃 ✓' : s === 'skip' ? '跳过' : '未打卡'
}
function openCheckin(mealKey) {
  checkinMeal.value = mealKey
  checkinShow.value = true
}
function onCheckinSelect(action) {
  checkin.mark(today, checkinMeal.value, action.value)
}

// ---- 详情弹层 ----
const detailShow = ref(false)
const detailMealKey = ref(null)
const detailIndex = ref(-1)
const detailItem = computed(() =>
  detailShow.value && todayMeals.value && detailMealKey.value != null
    ? todayMeals.value[detailMealKey.value][detailIndex.value]
    : null
)
const detailRecipe = computed(() =>
  detailItem.value ? RECIPES_MAP[detailItem.value.recipeId] : null
)
const detailNutrition = computed(() =>
  detailItem.value ? computeNutrition(detailItem.value.ingredients, FOODS_MAP) : {}
)

function openDetail(mealKey, index) {
  detailMealKey.value = mealKey
  detailIndex.value = index
  detailShow.value = true
}

function doSwap() {
  const ok = week.swap(today, detailMealKey.value, detailItem.value.slot)
  if (!ok) {
    showToast('没有其他可用的候选了')
    return
  }
  detailShow.value = false
}

// ---- 详情编辑:改克数 / 移除 ----
function unitOf(foodId) {
  return FOODS_MAP[foodId]?.unit || null
}
function unitGramsOf(foodId) {
  return FOODS_MAP[foodId]?.unitGrams || 100
}

function onGramsChange(foodId, v) {
  week.updateGrams(today, detailMealKey.value, detailIndex.value, foodId, v)
}

function doRemove() {
  week.removeItem(today, detailMealKey.value, detailIndex.value)
  detailShow.value = false
  showToast('已移除')
}

// ---- 添加菜品 ----
const addShow = ref(false)
const addMealKey = ref('')
const addSearch = ref('')
const addTab = ref(0)
const addSlots = [
  { value: 'all', label: '全部' },
  { value: 'staple', label: '主食' },
  { value: 'protein', label: '蛋白' },
  { value: 'vegetable', label: '蔬菜' },
  { value: 'fruit', label: '水果' },
  { value: 'custom', label: '自定义' },
]

function openAdd(mealKey) {
  addMealKey.value = mealKey
  addSearch.value = ''
  addShow.value = true
}

// 最近吃过:与生成偏好共用 store 逻辑(按天倒序去重、skip 餐不计),取前 8
const recentRecipeIds = computed(() => week.recentRecipeIds(today).slice(0, 8))

function quickAdd(id) {
  const r = RECIPES_MAP[id]
  if (r) doAdd(r)
}

// 搜索会放开到全库,对不属于当前餐次的候选加"非早/午/晚餐"标记
const addMealLabel = computed(() => MEALS.find((m) => m.key === addMealKey.value)?.label || '')

function filteredAddRecipes(slot) {
  const kw = addSearch.value.trim()
  // 种子食谱 + 自定义食物(伪食谱,slot=custom 不进组装池,只在此手动添加)
  return allAddRecipes.value.filter(
    (r) =>
      (slot === 'all' || r.slot === slot) &&
      (kw ? true : r.mealFit.includes(addMealKey.value)) &&
      (!kw || r.name.includes(kw))
  )
}

const allAddRecipes = computed(() => RECIPES.concat(customFoods.recipes))

function baseKcal(recipe) {
  return computeNutrition(recipe.ingredients, FOODS_MAP).kcal
}

function doAdd(recipe) {
  // 打开确认弹层:先调整克数(个数型按"个"),再确认入餐
  addDraft.value = {
    recipeId: recipe.id,
    slot: recipe.slot,
    ingredients: recipe.ingredients.map((ing) => ({ ...ing })),
  }
  addShow.value = false
  addConfirmShow.value = true
}

const addConfirmShow = ref(false)
const addDraft = ref(null)
const draftNutrition = computed(() =>
  addDraft.value ? computeNutrition(addDraft.value.ingredients, FOODS_MAP) : {}
)

function confirmAddDraft() {
  if (!addDraft.value) return
  const recipe = RECIPES_MAP[addDraft.value.recipeId]
  const result = week.addItemCustom(today, addMealKey.value, recipe.id, addDraft.value.ingredients)
  if (result === 'added') {
    showToast(`已添加:${recipe.name}`)
  } else if (result === 'merged') {
    const main = week.mealsOf(today)?.[addMealKey.value]?.find((it) => it.recipeId === recipe.id)
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
.add-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.add-list {
  max-height: calc(72vh - 180px);
  overflow-y: auto;
  padding-bottom: 20px;
}
.recent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 8px;
}
.recent-label {
  flex: 0 0 auto;
  font-size: 12px;
  color: #969799;
}
.recent-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}
.recent-chip {
  flex: 0 0 auto;
  cursor: pointer;
}
.add-kcal {
  font-size: 12px;
  color: #969799;
}
.unit-hint {
  font-size: 11px;
  color: var(--cb-primary);
}
.detail {
  padding: 16px;
}
.detail-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 12px;
}
.steps {
  padding: 0 16px;
  color: #323233;
  font-size: 14px;
  line-height: 1.8;
}
.steps ol {
  padding-left: 18px;
  margin: 0;
}
</style>
