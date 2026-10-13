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
      <!-- 每日贴士 -->
      <van-cell-group inset style="margin-bottom: 12px">
        <template #title>
          <div class="target-header">
            <span>💡 每日一读</span>
            <span class="tips-more" @click="$router.push('/profile')">全部贴士 →</span>
          </div>
        </template>
        <div class="tips-body">
          <div class="tips-title">{{ dailyTip.title }}</div>
          <div class="tips-text">{{ dailyTip.body }}</div>
        </div>
      </van-cell-group>

      <!-- 目标概览 -->
      <van-cell-group inset style="margin-bottom: 12px">
        <template #title>
          <div class="target-header">
            <span>今日目标 · {{ modeLabel }}</span>
            <span class="deviation" :class="deviationClass">
              {{ deviationText }}
            </span>
          </div>
        </template>
        <div class="target-body">
          <div class="nutri-grid">
            <div>
              <div class="num">{{ totals.kcal }}</div>
              <div class="label">热量 / {{ targets.kcal }}</div>
            </div>
            <div>
              <div class="num">{{ totals.protein }}g</div>
              <div class="label">蛋白 / {{ targets.protein }}</div>
            </div>
            <div>
              <div class="num">{{ totals.carbs }}g</div>
              <div class="label">碳水 / {{ targets.carbs }}</div>
            </div>
            <div>
              <div class="num">{{ totals.fat }}g</div>
              <div class="label">脂肪 / {{ targets.fat }}</div>
            </div>
          </div>
          <van-progress
            :percentage="kcalPercentage"
            :show-pivot="false"
            color="#1989fa"
            track-color="#ebedf0"
            style="margin-top: 10px"
          />
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
          <span v-else class="trend-empty">记录两周以上可看趋势</span>
        </div>
      </van-cell-group>

      <!-- 未生成 -->
      <van-empty
        v-if="!todayMeals"
        image="normal"
        description="还没有生成今日食谱"
      >
        <van-button round type="primary" @click="generate">生成今日三餐</van-button>
      </van-empty>

      <!-- 三餐列表 -->
      <template v-else>
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
                目标 {{ mealTargets[meal.key].kcal }} 千卡 · 蛋白 {{ mealTargets[meal.key].protein }}g
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
          <template v-for="(item, i) in todayMeals[meal.key]" :key="i">
            <van-cell
              v-if="item"
              is-link
              @click="openDetail(meal.key, i)"
            >
              <template #title>
                <van-tag plain type="primary" size="medium" style="margin-right: 6px">
                  {{ SLOT_LABELS[item.slot] }}
                </van-tag>
                {{ recipeName(item.recipeId) }}
              </template>
              <template #label>
                {{ ingredientText(item) }} · {{ itemNutrition(item).kcal }} 千卡
              </template>
            </van-cell>
            <van-cell v-else title="该槽位没有可用食谱" label="排除项太多,去设置里调整偏好" />
          </template>
          <van-cell
            title="打卡"
            is-link
            :value="checkinText(meal.key)"
            @click="openCheckin(meal.key)"
          />
        </van-cell-group>

        <div style="display: flex; gap: 10px">
          <van-button block type="primary" plain @click="generate">重新生成</van-button>
          <van-button block type="danger" plain @click="clearToday">清空</van-button>
        </div>
      </template>
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
          <van-tag v-if="detailRecipe?.antiInfl" color="#07c160" size="large" style="vertical-align: 2px">抗炎</van-tag>
        </div>
        <div class="nutri-grid" style="margin-bottom: 12px">
          <div><div class="num">{{ detailNutrition.kcal }}</div><div class="label">千卡</div></div>
          <div><div class="num">{{ detailNutrition.protein }}g</div><div class="label">蛋白质</div></div>
          <div><div class="num">{{ detailNutrition.carbs }}g</div><div class="label">碳水</div></div>
          <div><div class="num">{{ detailNutrition.fat }}g</div><div class="label">脂肪</div></div>
        </div>
        <van-cell title="食材用量" />
        <van-cell
          v-for="ing in detailItem.ingredients"
          :key="ing.foodId"
          :title="FOODS_MAP[ing.foodId]?.name"
          :value="ing.grams + 'g'"
        />
        <van-cell title="做法" />
        <div class="steps">
          <ol>
            <li v-for="(s, i) in detailRecipe?.steps" :key="i">{{ s }}</li>
          </ol>
        </div>
        <van-button
          block
          type="primary"
          style="margin: 12px 0"
          @click="doSwap"
        >
          换一个{{ SLOT_LABELS[detailItem.slot] }}
        </van-button>
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
import { FOODS_MAP } from '../data/foods'
import { RECIPES_MAP } from '../data/recipes'
import { useProfileStore } from '../stores/profile'
import { useWeekStore } from '../stores/week'
import { useCheckinStore } from '../stores/checkin'
import { useWeightStore } from '../stores/weight'
import { todayStr, parseDate } from '../utils/date'
import { TIPS } from '../data/tips'

const profile = useProfileStore()
const week = useWeekStore()
const checkin = useCheckinStore()
const weight = useWeightStore()
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

const totals = computed(() =>
  summary.value ? summary.value.totals : { kcal: 0, protein: 0, carbs: 0, fat: 0 }
)
const kcalPercentage = computed(() =>
  targets.value.kcal > 0
    ? Math.min(100, Math.round((totals.value.kcal / targets.value.kcal) * 100))
    : 0
)
const deviationClass = computed(() => {
  if (!summary.value) return 'ok'
  const d = summary.value.diff.kcal
  if (Math.abs(d) <= 10) return 'ok'
  return d > 0 ? 'over' : 'under'
})
const deviationText = computed(() => {
  if (!summary.value) return '待生成'
  const d = summary.value.diff.kcal
  if (Math.abs(d) <= 10) return '达标 ✓'
  return d > 0 ? `热量超 ${d}%` : `热量低 ${-d}%`
})

const mealTargets = computed(() =>
  Object.fromEntries(targets.value.meals.map((m) => [m.key, m]))
)

function generate() {
  week.generateDay(today)
  showToast('已生成')
}
function clearToday() {
  week.clearDay(today)
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

// ---- 列表辅助 ----
function recipeName(id) {
  return RECIPES_MAP[id]?.name || id
}
function itemNutrition(item) {
  return computeNutrition(item.ingredients, FOODS_MAP)
}
function ingredientText(item) {
  return item.ingredients
    .map((ing) => `${FOODS_MAP[ing.foodId]?.name || ''}${ing.grams}g`)
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
  font-size: 12px;
  color: #969799;
  font-weight: normal;
}
.deviation {
  font-size: 12px;
  font-weight: normal;
}
.deviation.ok {
  color: #07c160;
}
.deviation.over {
  color: #ee0a24;
}
.deviation.under {
  color: #ff976a;
}
.weight-change {
  font-size: 12px;
  font-weight: normal;
}
.weight-change.ok {
  color: #07c160;
}
.weight-change.over {
  color: #ff976a;
}
.target-body {
  padding: 8px 16px 14px;
}
.weight-body {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px 12px;
}
.weight-input {
  flex: 0 0 110px;
  padding: 6px 10px;
  background: #f7f8fa;
  border-radius: 6px;
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
.tips-more {
  font-size: 12px;
  color: #1989fa;
  font-weight: normal;
}
.tips-body {
  padding: 8px 16px 12px;
}
.tips-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}
.tips-text {
  font-size: 13px;
  color: #646566;
  line-height: 1.7;
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
