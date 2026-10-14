<template>
  <div class="page">
    <!-- 体重趋势:x 轴按天,本周/本月切换 -->
    <van-cell-group inset style="margin-bottom: 12px">
      <template #title>
        <div class="card-header">
          <span>体重趋势</span>
          <div class="range-switch">
            <span
              v-for="r in RANGES"
              :key="r.value"
              class="range-chip"
              :class="{ on: trendRange === r.value }"
              @click="trendRange = r.value"
            >
              {{ r.label }}
            </span>
          </div>
        </div>
      </template>
      <div class="trend-chart">
        <svg v-if="trendPoints.length >= 2" :viewBox="`0 0 ${W} ${H}`">
          <polyline :points="trendPolyline" fill="none" stroke="#1989fa" stroke-width="2" />
          <circle
            v-for="(p, i) in trendPoints"
            :key="p.date"
            :cx="p.x"
            :cy="p.y"
            :r="i === trendPoints.length - 1 ? 3.5 : 2"
            :fill="i === trendPoints.length - 1 ? '#1989fa' : '#c8c9cc'"
          />
          <text
            :x="trendPoints[trendPoints.length - 1].x"
            :y="trendPoints[trendPoints.length - 1].y - 8"
            text-anchor="end"
            font-size="11"
            fill="#1989fa"
          >
            {{ trendPoints[trendPoints.length - 1].kg }}kg
          </text>
          <text
            v-for="l in xLabels"
            :key="l.text"
            :x="l.x"
            :y="H - 2"
            :text-anchor="l.anchor"
            font-size="10"
            fill="#969799"
          >
            {{ l.text }}
          </text>
        </svg>
        <div v-else class="trend-empty">{{ trendEmptyText }}</div>
      </div>
      <div v-if="weight.records.length" class="weight-stats">
        最新 <b>{{ weight.latest.kg }}kg</b> · 首次 {{ weight.records[0].kg }}kg · 共 {{ weight.records.length }} 次
        <span v-if="weight.records.length >= 2" :class="weight.totalChange <= 0 ? 'ok' : 'over'">
          · 较首次 {{ weight.totalChange > 0 ? '+' : '' }}{{ weight.totalChange.toFixed(1) }}kg
        </span>
      </div>
    </van-cell-group>

    <!-- 每日记录:日历形式,点日期查看当天食谱 -->
    <van-cell-group inset>
      <template #title>
        <div class="card-header">
          <span>每日记录</span>
          <span v-if="recordDays.length" class="header-sub">已记录 {{ recordDays.length }} 天</span>
        </div>
      </template>
      <!-- 翻页月历:箭头跨月查看任意历史记录 -->
      <div class="calendar">
        <div class="cal-head">
          <van-icon
            name="arrow-left"
            class="cal-nav"
            :class="{ disabled: !canPrev }"
            @click="prevMonth"
          />
          <span class="cal-title" @click="openMonthPicker">
            {{ calYear }}年{{ calMonth + 1 }}月
            <van-icon name="arrow-down" class="cal-title-arrow" />
          </span>
          <van-icon
            name="arrow-right"
            class="cal-nav"
            :class="{ disabled: !canNext }"
            @click="nextMonth"
          />
        </div>
        <div class="cal-weekrow">
          <span v-for="w in WEEK_LABELS" :key="w">{{ w }}</span>
        </div>
        <div class="cal-grid">
          <div
            v-for="(d, i) in monthCells"
            :key="i"
            class="cal-cell"
            :class="{
              empty: !d,
              today: d === today,
              'has-rec': d && d <= today && recordDateSet.has(d),
              selected: d === selected,
              future: d > today,
            }"
            @click="onPickDay(d)"
          >
            <span v-if="d" class="cal-num">{{ Number(d.slice(8, 10)) }}</span>
          </div>
        </div>
        <div class="cal-foot">
          <span class="cal-today-btn" @click="goToday">回到今天</span>
        </div>
      </div>

      <!-- 年月跳转 -->
      <van-popup v-model:show="showMonthPicker" position="bottom" round>
        <van-picker
          v-model="pickerValues"
          title="选择月份"
          :columns="pickerColumns"
          @confirm="onMonthConfirm"
          @cancel="showMonthPicker = false"
        />
      </van-popup>
      <!-- 选中日的食谱 -->
      <div v-if="selected" class="day-detail">
        <div class="detail-head">
          <span class="detail-date" :class="{ today: selected === today }">{{ friendlyDate(selected) }}</span>
          <span class="detail-meta">
            <template v-if="selectedData">
              <span class="day-kcal">{{ selectedData.totals.kcal }} 千卡</span>
              <van-tag v-if="selectedData.doneCount === 3" type="success" size="medium">全打卡</van-tag>
              <van-icon name="delete-o" class="del-icon" @click="confirmClear(selected)" />
            </template>
          </span>
        </div>
        <div v-if="selectedData" class="detail-macros">
          蛋白 {{ selectedData.totals.protein }}g · 碳水 {{ selectedData.totals.carbs }}g · 脂肪 {{ selectedData.totals.fat }}g
        </div>
        <template v-if="selectedData">
          <div v-for="meal in MEALS" :key="meal.key" class="meal-block">
            <div class="meal-line">
              <van-tag plain size="medium">{{ meal.label }}</van-tag>
              <span
                v-if="checkin.statusOf(selected, meal.key)"
                class="checkin-mark"
                :class="checkin.statusOf(selected, meal.key)"
              >
                {{ checkin.statusOf(selected, meal.key) === 'done' ? '已吃' : '跳过' }}
              </span>
            </div>
            <div v-for="(item, i) in itemsOf(selectedData, meal.key)" :key="i" class="item-line">
              <span v-if="item.slot" class="slot-chip">{{ SLOT_LABELS[item.slot] }}</span>
              <span class="item-name">{{ recipeName(item.recipeId) }}</span>
              <span class="item-kcal">{{ itemNutrition(item).kcal }} 千卡</span>
              <div class="item-sub">{{ ingredientText(item) }}</div>
            </div>
            <div v-if="!itemsOf(selectedData, meal.key).length" class="item-line muted">未记录</div>
          </div>
        </template>
        <div v-else class="item-line muted" style="padding: 8px 0 4px">该日未记录</div>
      </div>
      <div v-else class="empty-pad">
        <van-empty image-size="60" description="还没有记录,去今日页添加菜品或生成三餐" />
      </div>
    </van-cell-group>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { MEALS } from '../core/nutrition'
import { SLOT_LABELS, computeNutrition } from '../core/planner'
import { FOODS_MAP, formatFoodAmount } from '../data/foods'
import { RECIPES_MAP } from '../data/recipes'
import { useWeekStore } from '../stores/week'
import { useCheckinStore } from '../stores/checkin'
import { useWeightStore } from '../stores/weight'
import { useCustomFoodsStore } from '../stores/customFoods'
import { todayStr, friendlyDate, weekStartOf, addDays } from '../utils/date'

const week = useWeekStore()
const checkin = useCheckinStore()
const weight = useWeightStore()
const customFoods = useCustomFoodsStore()
customFoods.sync() // 注册进 RECIPES_MAP,历史记录里的自定义食物可显示名称

const today = todayStr()

// ---- 体重趋势:x 轴单位始终为天(范围内的每一天占一个等宽刻度) ----
const RANGES = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
]
const trendRange = ref('week')
const trendDays = computed(() => {
  if (trendRange.value === 'week') {
    const start = weekStartOf(today)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }
  const [y, m] = today.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return Array.from(
    { length: last },
    (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
  )
})

const W = 320
const H = 150
const PAD = 12
const PADY = 14
const trendPoints = computed(() => {
  const kgByDate = new Map(weight.records.map((r) => [r.date, r.kg]))
  const pts = trendDays.value
    .map((d, i) => (kgByDate.has(d) ? { date: d, kg: kgByDate.get(d), i } : null))
    .filter(Boolean)
  if (pts.length < 2) return []
  const kgs = pts.map((p) => p.kg)
  const min = Math.min(...kgs)
  const max = Math.max(...kgs)
  const span = Math.max(max - min, 0.1)
  const total = trendDays.value.length
  const x = (i) => PAD + (i / (total - 1)) * (W - 2 * PAD)
  return pts.map((p) => ({
    ...p,
    x: x(p.i),
    y: PADY + (1 - (p.kg - min) / span) * (H - 2 * PADY - 14),
  }))
})
const trendPolyline = computed(() => trendPoints.value.map((p) => `${p.x},${p.y}`).join(' '))
const xLabels = computed(() => {
  const days = trendDays.value
  const fmt = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
  return [
    { text: fmt(days[0]), x: PAD, anchor: 'start' },
    { text: fmt(days[Math.floor(days.length / 2)]), x: W / 2, anchor: 'middle' },
    { text: fmt(days[days.length - 1]), x: W - PAD, anchor: 'end' },
  ]
})
const trendEmptyText = computed(() =>
  weight.records.length < 2
    ? '记录 2 次起显示趋势,去今日页记录体重'
    : `${trendRange.value === 'week' ? '本周' : '本月'}记录不足 2 条,可切换范围查看`
)

// ---- 每日记录数据(供日历标记与详情) ----
const recordDays = computed(() => {
  const out = []
  for (const [date, meals] of Object.entries(week.days)) {
    if (!meals) continue
    const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    let has = false
    for (const m of MEALS) {
      for (const it of meals[m.key] || []) {
        if (!it) continue
        has = true
        const n = computeNutrition(it.ingredients, FOODS_MAP)
        totals.kcal += n.kcal
        totals.protein += n.protein
        totals.carbs += n.carbs
        totals.fat += n.fat
      }
    }
    if (!has) continue
    out.push({
      date,
      meals,
      totals: {
        kcal: Math.round(totals.kcal),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
      },
      doneCount: MEALS.filter((m) => checkin.statusOf(date, m.key) === 'done').length,
    })
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
})

const recordDateSet = computed(() => new Set(recordDays.value.map((d) => d.date)))

// ---- 翻页月历 ----
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const now = new Date()
const calYear = ref(now.getFullYear())
const calMonth = ref(now.getMonth())
// 可翻范围:最早一年前同月,最晚当前月往后一年(未来天置灰,仅可浏览)
const minYM = (now.getFullYear() - 1) * 12 + now.getMonth()
const maxYM = (now.getFullYear() + 1) * 12 + now.getMonth()
const canPrev = computed(() => calYear.value * 12 + calMonth.value > minYM)
const canNext = computed(() => calYear.value * 12 + calMonth.value < maxYM)
function prevMonth() {
  if (!canPrev.value) return
  if (calMonth.value === 0) {
    calMonth.value = 11
    calYear.value -= 1
  } else {
    calMonth.value -= 1
  }
}
function nextMonth() {
  if (!canNext.value) return
  if (calMonth.value === 11) {
    calMonth.value = 0
    calYear.value += 1
  } else {
    calMonth.value += 1
  }
}
function goToday() {
  calYear.value = now.getFullYear()
  calMonth.value = now.getMonth()
  selected.value = today
}

// ---- 年月跳转 ----
const showMonthPicker = ref(false)
const pickerValues = ref([now.getFullYear(), now.getMonth()])
const pickerColumns = computed(() => {
  const minYear = now.getFullYear() - 1
  const maxYear = now.getFullYear() + 1
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({
    text: `${minYear + i}年`,
    value: minYear + i,
  }))
  const months = Array.from({ length: 12 }, (_, i) => ({ text: `${i + 1}月`, value: i }))
  return [years, months]
})
function openMonthPicker() {
  pickerValues.value = [calYear.value, calMonth.value]
  showMonthPicker.value = true
}
function onMonthConfirm({ selectedValues }) {
  // 夹回可翻范围内
  const ym = Math.min(maxYM, Math.max(minYM, selectedValues[0] * 12 + selectedValues[1]))
  calYear.value = Math.floor(ym / 12)
  calMonth.value = ym % 12
  showMonthPicker.value = false
}
const monthCells = computed(() => {
  const y = calYear.value
  const m = calMonth.value
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7 // 周一=0
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const p = (n) => String(n).padStart(2, '0')
  const cells = Array.from({ length: firstWeekday }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${p(m + 1)}-${p(d)}`)
  return cells
})

const selected = ref(today)
const selectedData = computed(() => recordDays.value.find((d) => d.date === selected.value) || null)
function onPickDay(d) {
  if (d && d <= today) selected.value = d
}

function itemsOf(day, mealKey) {
  return (day.meals[mealKey] || []).filter(Boolean)
}
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

async function confirmClear(date) {
  try {
    await showConfirmDialog({ title: '删除这一天', message: `确定删除 ${friendlyDate(date)} 的全部记录?` })
  } catch {
    return
  }
  week.clearDay(date)
  showToast('已删除')
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.header-sub {
  font-size: 12px;
  font-weight: normal;
  color: #969799;
}
.range-switch {
  display: flex;
  gap: 6px;
}
.range-chip {
  padding: 2px 12px;
  border-radius: 999px;
  font-size: 12px;
  color: #969799;
  background: #f1f3f2;
  cursor: pointer;
}
.range-chip.on {
  color: var(--cb-primary);
  background: var(--cb-primary-light);
}
.trend-chart {
  padding: 8px 16px 4px;
}
.trend-chart svg {
  width: 100%;
  height: 130px;
}
.trend-empty {
  font-size: 12px;
  color: #c8c9cc;
  padding: 18px 0;
  text-align: center;
}
.weight-stats {
  padding: 4px 16px 12px;
  font-size: 12px;
  color: #969799;
}
.weight-stats b {
  color: var(--cb-text, #1f2d27);
}
.weight-stats .ok {
  color: var(--cb-primary);
}
.weight-stats .over {
  color: #ff976a;
}
/* 翻页月历 */
.calendar {
  padding: 4px 12px 0;
}
.cal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px 8px;
}
.cal-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  cursor: pointer;
}
.cal-title-arrow {
  font-size: 12px;
  color: #969799;
  vertical-align: -1px;
}
.cal-nav {
  font-size: 18px;
  color: var(--cb-primary);
  padding: 4px 10px;
  cursor: pointer;
}
.cal-nav.disabled {
  color: #c8c9cc;
  cursor: default;
}
.cal-weekrow {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  color: #969799;
  padding-bottom: 4px;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
}
.cal-cell {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.cal-cell.empty,
.cal-cell.future {
  cursor: default;
}
.cal-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 13px;
  color: #323233;
}
.cal-cell.today .cal-num {
  color: var(--cb-primary);
  font-weight: 700;
}
.cal-cell.future .cal-num {
  color: #c8c9cc;
}
.cal-cell.selected .cal-num {
  background: var(--cb-primary);
  color: #fff;
}
.cal-cell.has-rec::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cb-primary);
}
.cal-cell.selected.has-rec::after {
  background: #fff;
}
.cal-foot {
  text-align: center;
  padding: 6px 0 2px;
}
.cal-today-btn {
  font-size: 12px;
  color: var(--cb-primary);
  cursor: pointer;
}
.day-detail {
  padding: 4px 16px 14px;
  border-top: 1px solid #f2f4f3;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 0 4px;
}
.detail-date {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
}
.detail-date.today {
  color: var(--cb-primary);
}
.detail-macros {
  font-size: 12px;
  color: #969799;
  padding-bottom: 6px;
}
.detail-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.day-kcal {
  font-size: 12px;
  color: #969799;
}
.del-icon {
  font-size: 16px;
  color: #969799;
  padding: 4px 0 4px 4px;
}
.meal-block {
  margin-bottom: 6px;
}
.meal-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
.checkin-mark {
  font-size: 11px;
}
.checkin-mark.done {
  color: var(--cb-primary);
}
.checkin-mark.skip {
  color: #969799;
}
.item-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 6px;
  padding: 4px 0 4px 2px;
  font-size: 13px;
}
.item-line.muted {
  color: #c8c9cc;
  font-size: 12px;
}
.slot-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--cb-primary-light);
  color: var(--cb-primary);
  font-size: 10px;
}
.item-name {
  color: #323233;
}
.item-kcal {
  font-size: 12px;
  color: #969799;
}
.item-sub {
  width: 100%;
  font-size: 11px;
  color: #969799;
}
.empty-pad {
  padding: 8px 0 12px;
}
</style>
