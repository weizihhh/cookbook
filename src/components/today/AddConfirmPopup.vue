<template>
  <!-- 添加确认:先定克数再入餐(克数编辑直接改 draft,确认后由父组件入餐) -->
  <van-popup
    :show="show"
    @update:show="$emit('update:show', $event)"
    position="bottom"
    round
    :style="{ maxHeight: '70%' }"
  >
    <div v-if="draft" class="detail">
      <div class="detail-title">
        添加:{{ recipeName }}
        <van-tag v-if="recipe?.antiInfl" color="var(--cb-primary)" size="large" style="vertical-align: 2px">抗炎</van-tag>
      </div>
      <van-cell title="用量调整" />
      <van-cell v-for="ing in draft.ingredients" :key="ing.foodId">
        <template #title>
          {{ FOODS_MAP[ing.foodId]?.name }}
          <span v-if="unitOf(ing.foodId)" class="unit-hint">({{ unitOf(ing.foodId) }})</span>
        </template>
        <template #label>{{ formatFoodAmount(FOODS_MAP[ing.foodId], ing.grams) }}</template>
        <template #value>
          <FoodStepper :food-id="ing.foodId" :grams="ing.grams" @change="(g) => (ing.grams = Math.round(g))" />
        </template>
      </van-cell>
      <div v-for="h in limitHits" :key="h.name" class="limit-hint">
        {{ h.name }}:近 7 天已出现 {{ h.count }} 天,已达建议上限(≤{{ h.limit }} 次/周),不建议再加
      </div>
      <div class="nutri-grid" style="margin: 10px 0">
        <div><div class="num">{{ nutrition.kcal }}</div><div class="label">千卡</div></div>
        <div><div class="num">{{ nutrition.protein }}g</div><div class="label">蛋白质</div></div>
        <div><div class="num">{{ nutrition.carbs }}g</div><div class="label">碳水</div></div>
        <div><div class="num">{{ nutrition.fat }}g</div><div class="label">脂肪</div></div>
      </div>
      <div style="display: flex; gap: 10px; margin: 12px 0">
        <van-button block @click="$emit('update:show', false)">取消</van-button>
        <van-button block type="primary" @click="$emit('confirm')">添加</van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { computed } from 'vue'
import { computeNutrition } from '../../core/planner'
import { FOODS_MAP, formatFoodAmount } from '../../data/foods'
import { RECIPES_MAP } from '../../data/recipes'
import FoodStepper from './FoodStepper.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  draft: { type: Object, default: null },
  limitHits: { type: Array, default: () => [] },
})
defineEmits(['update:show', 'confirm'])

const recipe = computed(() => (props.draft ? RECIPES_MAP[props.draft.recipeId] : null))
const recipeName = computed(() =>
  props.draft ? RECIPES_MAP[props.draft.recipeId]?.name || props.draft.recipeId : ''
)
const nutrition = computed(() =>
  props.draft ? computeNutrition(props.draft.ingredients, FOODS_MAP) : {}
)
function unitOf(foodId) {
  return FOODS_MAP[foodId]?.unit || null
}
</script>

<style scoped>
.unit-hint {
  font-size: 11px;
  color: var(--cb-primary);
}
.limit-hint {
  font-size: 12px;
  color: #ee0a24;
  background: #fff1f1;
  border-radius: 8px;
  padding: 6px 10px;
  margin-top: 4px;
}
.detail {
  padding: 16px;
}
.detail-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 12px;
}
</style>
