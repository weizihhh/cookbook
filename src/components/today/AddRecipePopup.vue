<template>
  <!-- 添加菜品弹层:搜索 + 最近吃过快捷区 + 槽位 tabs -->
  <van-popup
    :show="show"
    @update:show="$emit('update:show', $event)"
    position="bottom"
    round
    :style="{ height: '72%' }"
  >
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
              @click="$emit('pick', r)"
            >
              <template #title>
                {{ r.name }}
                <van-tag v-if="r.antiInfl" color="var(--cb-primary)" size="medium" style="margin-left: 4px">抗炎</van-tag>
                <van-tag v-if="r.custom" plain type="primary" size="medium" style="margin-left: 4px">
                  {{ r.source || '自定义' }}
                </van-tag>
                <van-tag v-if="addSearch.trim() && !r.mealFit.includes(mealKey)" color="#c8c9cc" size="medium" style="margin-left: 4px">
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
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { MEALS } from '../../core/nutrition'
import { computeNutrition, recipeMatchesKw } from '../../core/planner'
import { FOODS_MAP } from '../../data/foods'
import { RECIPES, RECIPES_MAP } from '../../data/recipes'
import { useWeekStore } from '../../stores/week'
import { useCustomFoodsStore } from '../../stores/customFoods'
import { todayStr } from '../../utils/date'

const props = defineProps({
  show: { type: Boolean, default: false },
  mealKey: { type: String, required: true },
})
const emit = defineEmits(['update:show', 'pick'])

const week = useWeekStore()
const customFoods = useCustomFoodsStore()
const today = todayStr()

const addSearch = ref('')
const addTab = ref(0)
// 打开时重置搜索与 tab(等价原 openAdd 的清空行为)
watch(
  () => props.show,
  (v) => {
    if (v) {
      addSearch.value = ''
      addTab.value = 0
    }
  }
)

const addSlots = [
  { value: 'all', label: '全部' },
  { value: 'staple', label: '主食' },
  { value: 'protein', label: '蛋白' },
  { value: 'vegetable', label: '蔬菜' },
  { value: 'fruit', label: '水果' },
  { value: 'custom', label: '自定义' },
]

const addMealLabel = computed(() => MEALS.find((m) => m.key === props.mealKey)?.label || '')

// 最近吃过:与生成偏好共用 store 逻辑(按天倒序去重、skip 餐不计),取前 8
const recentRecipeIds = computed(() => week.recentRecipeIds(today).slice(0, 8))

// 种子食谱 + 自定义食物(伪食谱,slot=custom 不进组装池,只在此手动添加)
const allAddRecipes = computed(() => RECIPES.concat(customFoods.recipes))

function filteredAddRecipes(slot) {
  const kw = addSearch.value.trim()
  return allAddRecipes.value.filter(
    (r) =>
      (slot === 'all' || r.slot === slot) &&
      (kw ? true : r.mealFit.includes(props.mealKey)) &&
      (!kw || recipeMatchesKw(r, kw, FOODS_MAP))
  )
}

function baseKcal(recipe) {
  return computeNutrition(recipe.ingredients, FOODS_MAP).kcal
}

function quickAdd(id) {
  const r = RECIPES_MAP[id]
  if (r) emit('pick', r)
}

function recipeName(id) {
  return RECIPES_MAP[id]?.name || id
}
</script>

<style scoped>
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
</style>
