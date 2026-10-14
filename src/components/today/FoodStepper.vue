<template>
  <!-- 个数型食材按"个"步进,其余按 5g 步进(克数换算在内部完成,对外只吐克数) -->
  <van-stepper
    v-if="unit"
    :model-value="unitValue"
    :min="1"
    :max="Math.ceil(1000 / unitGrams)"
    :step="1"
    :decimal-length="unitGrams >= 100 ? 1 : 0"
    input-width="40px"
    button-size="24px"
    @change="(v) => $emit('change', v * unitGrams)"
  />
  <van-stepper
    v-else
    :model-value="grams"
    :min="5"
    :max="1000"
    :step="5"
    integer
    input-width="44px"
    button-size="24px"
    @change="(v) => $emit('change', v)"
  />
</template>

<script setup>
import { computed } from 'vue'
import { FOODS_MAP } from '../../data/foods'

const props = defineProps({
  foodId: { type: String, required: true },
  grams: { type: Number, required: true },
})
defineEmits(['change'])

const food = computed(() => FOODS_MAP[props.foodId])
const unit = computed(() => food.value?.unit || null)
const unitGrams = computed(() => food.value?.unitGrams || 100)
// 单位值保留 1 位小数,实际显示位数由 decimal-length 决定
const unitValue = computed(() => Math.round((props.grams / unitGrams.value) * 10) / 10)
</script>
