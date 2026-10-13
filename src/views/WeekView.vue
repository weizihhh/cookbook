<template>
  <div class="page">
    <van-cell-group inset>
      <template #title>
        <div class="week-header">
          <span>本周计划</span>
          <span class="week-range">{{ weekRangeText }}</span>
        </div>
      </template>
      <div class="week-actions">
        <van-button size="small" type="primary" @click="generateWeek">
          {{ hasAny ? '重新生成本周' : '生成本周计划' }}
        </van-button>
        <van-button size="small" type="primary" plain :disabled="!hasAny" @click="showShopping = true">
          采购清单
        </van-button>
      </div>
      <div v-if="hasAny" class="week-summary">
        已生成 {{ generatedCount }}/7 天 · 平均 {{ weekAvgKcal }} 千卡/天
        <template v-if="weekCheckinDays > 0">· 全打卡 {{ weekCheckinDays }}/7 天</template>
      </div>
    </van-cell-group>

    <van-empty v-if="!hasAny" image="normal" description="还没有本周计划,点击上方生成" />

    <van-collapse v-model:active="activeDays" v-else>
      <van-collapse-item
        v-for="date in week.weekDates"
        :key="date"
        :name="date"
        :is-link="false"
      >
        <template #title>
          <div class="day-title">
            <span :class="{ today: date === today }">
              {{ friendlyDate(date) }}
            </span>
            <van-tag v-if="checkinDone(date) === 3" type="success" size="medium">全打卡</van-tag>
          </div>
        </template>
        <template #value>
          <div class="day-right">
            <span v-if="week.hasDay(date)" class="day-kcal">{{ week.summaryOf(date)?.totals.kcal }} 千卡</span>
            <span v-else class="day-kcal none">未生成</span>
            <van-icon
              v-if="week.hasDay(date)"
              name="delete-o"
              class="day-clear"
              @click.stop="confirmClear(date)"
            />
          </div>
        </template>

        <template v-if="week.hasDay(date)">
          <div v-for="meal in MEALS" :key="meal.key" class="meal-block">
            <div class="meal-row">
              <van-tag plain size="medium">{{ meal.label }}</van-tag>
              <span v-if="checkin.statusOf(date, meal.key)" class="checkin-mark" :class="checkin.statusOf(date, meal.key)">
                {{ checkin.statusOf(date, meal.key) === 'done' ? '已吃' : '跳过' }}
              </span>
            </div>
            <van-cell
              v-for="(item, i) in week.mealsOf(date)[meal.key]"
              :key="i"
              :border="i < 2"
              @click="openDetail(date, meal.key, i)"
            >
              <template #title>
                <span class="slot-tag">{{ SLOT_LABELS[item.slot] }}</span>
                {{ recipeName(item.recipeId) }}
              </template>
              <template #value>
                <span class="kcal">{{ itemNutrition(item).kcal }} 千卡</span>
                <van-icon name="replay" class="swap-icon" @click.stop="doSwap(date, meal.key, item.slot, item.recipeId)" />
              </template>
            </van-cell>
            <van-cell v-if="!week.mealsOf(date)[meal.key].every(Boolean)" title="有槽位无候选" label="排除项太多,去设置调整" />
          </div>
        </template>
        <van-empty v-else image-size="60" description="未生成,可在今日页单独生成这一天" />
      </van-collapse-item>
    </van-collapse>

    <!-- 菜品详情弹层 -->
    <van-popup v-model:show="detailShow" position="bottom" round :style="{ maxHeight: '75%' }">
      <div v-if="detailItem" class="detail">
        <div class="detail-title">{{ recipeName(detailItem.recipeId) }}</div>
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
        <van-button block type="primary" style="margin: 12px 0" @click="doSwap(detailDate, detailMealKey, detailItem.slot, detailItem.recipeId)">
          换一个{{ SLOT_LABELS[detailItem.slot] }}
        </van-button>
      </div>
    </van-popup>

    <!-- 采购清单弹层 -->
    <van-popup v-model:show="showShopping" position="bottom" round :style="{ maxHeight: '80%' }">
      <div class="shopping">
        <div class="detail-title">本周采购清单</div>
        <div class="shopping-sub">按 7 天计划聚合的食材总量(净重,不含损耗)</div>
        <van-cell-group v-for="group in shoppingGroups" :key="group.label" :title="group.label">
          <van-cell v-for="f in group.items" :key="f.foodId">
            <template #title>
              {{ f.name }}
              <span class="shopping-days">{{ f.days }}天用到</span>
            </template>
            <template #value>{{ f.grams }}g<span class="jin">(约{{ gramsToJin(f.grams) }})</span></template>
          </van-cell>
        </van-cell-group>
        <van-empty v-if="!shoppingGroups.length" description="暂无数据" />
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { MEALS } from '../core/nutrition'
import { SLOT_LABELS, computeNutrition, buildShoppingList } from '../core/planner'
import { FOODS_MAP } from '../data/foods'
import { RECIPES_MAP } from '../data/recipes'
import { FOOD_CATEGORIES } from '../data/foods'
import { useWeekStore } from '../stores/week'
import { useCheckinStore } from '../stores/checkin'
import { todayStr, friendlyDate } from '../utils/date'

const week = useWeekStore()
const checkin = useCheckinStore()
const today = todayStr()

const activeDays = ref([today])
const hasAny = computed(() => week.hasAny)
const generatedCount = computed(() => week.weekDates.filter((d) => week.hasDay(d)).length)
const weekAvgKcal = computed(() => {
  const days = week.weekDates.filter((d) => week.hasDay(d))
  if (!days.length) return 0
  return Math.round(days.reduce((s, d) => s + week.summaryOf(d).totals.kcal, 0) / days.length)
})
const weekCheckinDays = computed(
  () => week.weekDates.filter((d) => checkinDone(d) === 3).length
)

const weekRangeText = computed(() => {
  const d = week.weekDates
  const fmt = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`
  return `${fmt(d[0])} - ${fmt(d[6])}`
})

function generateWeek() {
  week.generateWeek()
  showToast('已生成本周')
}

function confirmClear(date) {
  showConfirmDialog({ title: '清除这一天', message: `确定清除 ${friendlyDate(date)} 的计划?` })
    .then(() => {
      week.clearDay(date)
      showToast('已清除')
    })
    .catch(() => {})
}

function checkinDone(date) {
  return ['breakfast', 'lunch', 'dinner'].filter((m) => checkin.statusOf(date, m) === 'done').length
}

function recipeName(id) {
  return RECIPES_MAP[id]?.name || id
}
function itemNutrition(item) {
  return computeNutrition(item.ingredients, FOODS_MAP)
}

// ---- 详情弹层 ----
const detailShow = ref(false)
const detailDate = ref('')
const detailMealKey = ref('')
const detailIndex = ref(-1)
const detailItem = computed(() =>
  detailShow.value && week.hasDay(detailDate.value)
    ? week.mealsOf(detailDate.value)[detailMealKey.value][detailIndex.value]
    : null
)
const detailRecipe = computed(() =>
  detailItem.value ? RECIPES_MAP[detailItem.value.recipeId] : null
)
const detailNutrition = computed(() =>
  detailItem.value ? computeNutrition(detailItem.value.ingredients, FOODS_MAP) : {}
)

function openDetail(date, mealKey, index) {
  detailDate.value = date
  detailMealKey.value = mealKey
  detailIndex.value = index
  detailShow.value = true
}

function doSwap(date, mealKey, slot, currentId) {
  const ok = week.swap(date, mealKey, slot)
  if (!ok) {
    showToast('没有其他可用的候选了')
    return
  }
  detailShow.value = false
}

// ---- 采购清单 ----
const showShopping = ref(false)
const shoppingGroups = computed(() => {
  const list = buildShoppingList(week.days, FOODS_MAP)
  return FOOD_CATEGORIES.map((cat) => ({
    label: cat.label,
    items: list.filter((f) => f.category === cat.value),
  })).filter((g) => g.items.length)
})

function gramsToJin(g) {
  if (g >= 500) {
    const jin = Math.round(g / 50) / 10
    return `${jin}斤`
  }
  return `${Math.max(1, Math.round(g / 50))}两`
}
</script>

<style scoped>
.week-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.week-range {
  font-size: 12px;
  color: #969799;
  font-weight: normal;
}
.week-actions {
  display: flex;
  gap: 10px;
  padding: 8px 16px 12px;
}
.week-summary {
  font-size: 12px;
  color: #969799;
  padding: 0 16px 12px;
}
.day-title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.day-title.today {
  color: #1989fa;
  font-weight: 600;
}
.day-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 18px; /* 给折叠箭头留位 */
}
.day-kcal {
  font-size: 12px;
  color: #323233;
}
.day-kcal.none {
  color: #c8c9cc;
}
.day-clear {
  font-size: 16px;
  color: #969799;
  padding: 4px 2px;
}
.meal-block {
  margin-bottom: 6px;
}
.meal-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 2px;
}
.checkin-mark {
  font-size: 11px;
}
.checkin-mark.done {
  color: #07c160;
}
.checkin-mark.skip {
  color: #969799;
}
.slot-tag {
  font-size: 11px;
  color: #1989fa;
  border: 1px solid #1989fa;
  border-radius: 3px;
  padding: 0 3px;
  margin-right: 6px;
}
.kcal {
  font-size: 12px;
  color: #969799;
  margin-right: 8px;
}
.swap-icon {
  color: #1989fa;
  font-size: 15px;
  vertical-align: middle;
}
.detail {
  padding: 16px;
}
.detail-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 8px;
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
.shopping {
  padding: 16px 0;
}
.shopping-sub {
  font-size: 12px;
  color: #969799;
  padding: 0 16px 8px;
}
.shopping-days {
  font-size: 11px;
  color: #969799;
  margin-left: 6px;
}
.jin {
  font-size: 11px;
  color: #969799;
  margin-left: 3px;
}
</style>
