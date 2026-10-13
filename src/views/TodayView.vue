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

      <!-- 未生成 -->
      <van-empty
        v-if="!plan.hasPlan"
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
              </span>
            </div>
          </template>
          <template v-for="(item, i) in plan.meals[meal.key]" :key="i">
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
        </van-cell-group>

        <div style="display: flex; gap: 10px">
          <van-button block type="primary" plain @click="generate">重新生成</van-button>
          <van-button block type="danger" plain @click="plan.clear()">清空</van-button>
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
import { usePlanStore } from '../stores/plan'

const profile = useProfileStore()
const plan = usePlanStore()

const targets = computed(() => profile.targets)
const modeLabel = computed(
  () => GOAL_MODES.find((m) => m.value === profile.mode)?.label || ''
)

const totals = computed(() =>
  plan.summary ? plan.summary.totals : { kcal: 0, protein: 0, carbs: 0, fat: 0 }
)
const kcalPercentage = computed(() =>
  targets.value.kcal > 0
    ? Math.min(100, Math.round((totals.value.kcal / targets.value.kcal) * 100))
    : 0
)
const deviationClass = computed(() => {
  if (!plan.summary) return 'ok'
  const d = plan.summary.diff.kcal
  if (Math.abs(d) <= 10) return 'ok'
  return d > 0 ? 'over' : 'under'
})
const deviationText = computed(() => {
  if (!plan.summary) return '待生成'
  const d = plan.summary.diff.kcal
  if (Math.abs(d) <= 10) return '达标 ✓'
  return d > 0 ? `热量超 ${d}%` : `热量低 ${-d}%`
})

const mealTargets = computed(() =>
  Object.fromEntries(targets.value.meals.map((m) => [m.key, m]))
)

function generate() {
  plan.generate()
  showToast('已生成')
}

// ---- 详情弹层 ----
const detailShow = ref(false)
const detailMealKey = ref(null)
const detailIndex = ref(-1)
const detailItem = computed(() =>
  detailShow.value && plan.meals && detailMealKey.value != null
    ? plan.meals[detailMealKey.value][detailIndex.value]
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
  const ok = plan.swap(detailMealKey.value, detailItem.value.slot)
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
.target-body {
  padding: 8px 16px 14px;
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
