<template>
  <!-- 食谱详情弹层:营养/食材克数编辑/做法/换菜/移除 -->
  <van-popup
    :show="show"
    @update:show="$emit('update:show', $event)"
    position="bottom"
    round
    :style="{ maxHeight: '75%' }"
  >
    <div v-if="item" class="detail">
      <div class="detail-title">
        {{ recipeName }}
        <van-tag v-if="recipe?.antiInfl" color="var(--cb-primary)" size="large" style="vertical-align: 2px">抗炎</van-tag>
      </div>
      <div class="nutri-grid" style="margin-bottom: 12px">
        <div><div class="num">{{ nutrition.kcal }}</div><div class="label">千卡</div></div>
        <div><div class="num">{{ nutrition.protein }}g</div><div class="label">蛋白质</div></div>
        <div><div class="num">{{ nutrition.carbs }}g</div><div class="label">碳水</div></div>
        <div><div class="num">{{ nutrition.fat }}g</div><div class="label">脂肪</div></div>
      </div>
      <van-cell title="食材用量" />
      <van-cell v-for="ing in item.ingredients" :key="ing.foodId">
        <template #title>
          {{ FOODS_MAP[ing.foodId]?.name }}
          <span v-if="unitOf(ing.foodId)" class="unit-hint">({{ unitOf(ing.foodId) }})</span>
        </template>
        <template #label>{{ formatFoodAmount(FOODS_MAP[ing.foodId], ing.grams) }}</template>
        <template #value>
          <FoodStepper
            :food-id="ing.foodId"
            :grams="ing.grams"
            @change="(g) => $emit('grams-change', ing.foodId, g)"
          />
        </template>
      </van-cell>
      <template v-if="recipe?.steps?.length">
        <van-cell title="做法" />
        <div class="steps">
          <ol>
            <li v-for="(s, i) in recipe.steps" :key="i">{{ s }}</li>
          </ol>
        </div>
      </template>
      <div style="display: flex; gap: 10px; margin: 12px 0">
        <van-button v-if="!item.custom" block type="primary" @click="$emit('swap')">
          换一个{{ SLOT_LABELS[item.slot] }}
        </van-button>
        <van-button block type="danger" plain @click="$emit('remove')">
          移除此菜
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { computed } from 'vue'
import { SLOT_LABELS, computeNutrition } from '../../core/planner'
import { FOODS_MAP, formatFoodAmount } from '../../data/foods'
import { RECIPES_MAP } from '../../data/recipes'
import FoodStepper from './FoodStepper.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  item: { type: Object, default: null },
})
defineEmits(['update:show', 'swap', 'remove', 'grams-change'])

const recipe = computed(() => (props.item ? RECIPES_MAP[props.item.recipeId] : null))
const recipeName = computed(() =>
  props.item ? RECIPES_MAP[props.item.recipeId]?.name || props.item.recipeId : ''
)
const nutrition = computed(() =>
  props.item ? computeNutrition(props.item.ingredients, FOODS_MAP) : {}
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
