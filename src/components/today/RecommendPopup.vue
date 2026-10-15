<template>
  <!-- 剩余预算推荐一餐:把剩余热量/蛋白当作一餐目标,给 2~3 个达标候选 -->
  <van-popup
    :show="show"
    @update:show="$emit('update:show', $event)"
    position="bottom"
    round
    :style="{ height: '68%' }"
  >
    <div class="rec-panel">
      <div class="rec-head">
        <div>
          <div class="rec-title">按剩余预算推荐一餐</div>
          <div class="rec-sub">还剩 {{ remaining.kcal }} 千卡 · 蛋白 {{ remaining.protein }}g,可以这样凑:</div>
        </div>
        <span class="rec-reroll" @click="generate">换一批</span>
      </div>
      <div class="rec-list">
        <div v-for="(c, i) in candidates" :key="i" class="rec-card">
          <div class="rec-card-head">
            <span class="rec-card-title">组合 {{ i + 1 }}</span>
            <span class="rec-card-kcal">{{ c.kcal }} 千卡 · 蛋白 {{ c.protein }}g</span>
          </div>
          <div v-for="it in c.items" :key="it.recipeId" class="rec-item">
            <span class="slot-chip">{{ SLOT_LABELS[it.slot] }}</span>
            <span class="rec-item-name">{{ recipeName(it.recipeId) }}</span>
            <span class="rec-item-sub">{{ ingredientText(it) }}</span>
          </div>
          <van-button size="small" round type="primary" plain class="rec-use" @click="$emit('apply', c.items)">
            就吃这个
          </van-button>
        </div>
        <div v-if="!candidates.length" class="rec-empty">没有凑出合适的组合,可去设置放宽排除项后再试</div>
      </div>
      <div class="rec-note">组合按剩余预算缩放,采纳后写入晚餐;实际吃了多少,点开菜品再调克数</div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, watch } from 'vue'
import { SLOT_LABELS, computeNutrition, recommendMeals, recentFoodDays } from '../../core/planner'
import { FOODS_MAP, formatFoodAmount } from '../../data/foods'
import { RECIPES, RECIPES_MAP } from '../../data/recipes'
import { useWeekStore } from '../../stores/week'
import { useProfileStore } from '../../stores/profile'
import { useToday } from '../../composables/useToday'

const props = defineProps({
  show: { type: Boolean, default: false },
  // 剩余预算 { kcal, protein },由今日页按已吃口径算好传入
  remaining: { type: Object, required: true },
})
const emit = defineEmits(['update:show', 'apply'])

const week = useWeekStore()
const profile = useProfileStore()
const today = useToday()

const candidates = ref([])

// 打开与"换一批"时生成:排除项与频次约束(近 7 天)和生成端同源
function generate() {
  const lists = recommendMeals({
    recipes: RECIPES,
    foods: FOODS_MAP,
    kcal: props.remaining.kcal,
    protein: props.remaining.protein,
    mealKey: 'dinner',
    excludedTags: profile.excludedTags,
    foodDayCounts: recentFoodDays(week.days, today.value),
  })
  candidates.value = lists.map((items) => {
    let kcal = 0
    let protein = 0
    for (const it of items) {
      const n = computeNutrition(it.ingredients, FOODS_MAP)
      kcal += n.kcal
      protein += n.protein
    }
    return { items, kcal: Math.round(kcal), protein: Math.round(protein) }
  })
}
watch(
  () => props.show,
  (v) => v && generate()
)

function recipeName(id) {
  return RECIPES_MAP[id]?.name || id
}
function ingredientText(item) {
  return item.ingredients
    .map((ing) => `${FOODS_MAP[ing.foodId]?.name || ''} ${formatFoodAmount(FOODS_MAP[ing.foodId], ing.grams)}`)
    .join(' + ')
}
</script>

<style scoped>
.rec-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding-top: 8px;
}
.rec-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 6px 16px 10px;
}
.rec-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}
.rec-sub {
  font-size: 12px;
  color: #969799;
  margin-top: 3px;
}
.rec-reroll {
  font-size: 12px;
  color: var(--cb-primary);
  padding: 4px 0;
  cursor: pointer;
}
.rec-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 8px;
}
.rec-card {
  border: 1px solid #eef2f0;
  border-radius: var(--cb-card-radius, 22px);
  padding: 10px 12px;
  margin-bottom: 10px;
}
.rec-card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
}
.rec-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #323233;
}
.rec-card-kcal {
  font-size: 12px;
  color: var(--cb-primary);
  font-variant-numeric: tabular-nums;
}
.rec-item {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 6px;
  padding: 3px 0;
  font-size: 13px;
}
.slot-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--cb-primary-light);
  color: var(--cb-primary);
  font-size: 10px;
}
.rec-item-name {
  color: #323233;
}
.rec-item-sub {
  width: 100%;
  font-size: 11px;
  color: #969799;
}
.rec-use {
  margin-top: 6px;
}
.rec-empty {
  padding: 28px 0;
  text-align: center;
  font-size: 12px;
  color: #c8c9cc;
}
.rec-note {
  padding: 6px 16px 12px;
  font-size: 11px;
  color: #c8c9cc;
}
</style>
