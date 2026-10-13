<template>
  <div class="page">
    <van-tabs v-model:active="activeTab" sticky>
      <van-tab v-for="s in slots" :key="s.value" :title="s.label">
        <van-cell-group inset style="margin-top: 10px">
          <van-cell
            v-for="r in recipesOf(s.value)"
            :key="r.id"
            is-link
            @click="openRecipe(r)"
          >
            <template #title>
              {{ r.name }}
              <span class="fit">{{ fitText(r) }}</span>
            </template>
            <template #label>
              <van-tag
                v-for="t in r.tags"
                :key="t"
                plain
                size="medium"
                color="#969799"
                style="margin-right: 4px"
              >
                {{ tagLabel(t) }}
              </van-tag>
            </template>
            <template #value>
              <div>{{ baseNutrition(r).kcal }} 千卡</div>
              <div class="sub">蛋白 {{ baseNutrition(r).protein }}g</div>
            </template>
          </van-cell>
        </van-cell-group>
      </van-tab>
      <van-tab title="食材库">
        <van-cell-group
          v-for="cat in FOOD_CATEGORIES"
          :key="cat.value"
          inset
          :title="cat.label"
          style="margin-top: 10px"
        >
          <van-cell
            v-for="f in foodsOf(cat.value)"
            :key="f.id"
            :title="f.name"
          >
            <template #value>
              <div>{{ f.kcal }} 千卡</div>
              <div class="sub">P{{ f.protein }} · C{{ f.carbs }} · F{{ f.fat }}</div>
            </template>
            <template #label>每 100g</template>
          </van-cell>
        </van-cell-group>
      </van-tab>
    </van-tabs>

    <!-- 食谱详情 -->
    <van-popup v-model:show="recipeShow" position="bottom" round :style="{ maxHeight: '75%' }">
      <div v-if="current" class="detail">
        <div class="detail-title">{{ current.name }}</div>
        <div class="nutri-grid" style="margin-bottom: 12px">
          <div><div class="num">{{ baseNutrition(current).kcal }}</div><div class="label">千卡/基准份</div></div>
          <div><div class="num">{{ baseNutrition(current).protein }}g</div><div class="label">蛋白质</div></div>
          <div><div class="num">{{ baseNutrition(current).carbs }}g</div><div class="label">碳水</div></div>
          <div><div class="num">{{ baseNutrition(current).fat }}g</div><div class="label">脂肪</div></div>
        </div>
        <van-cell title="食材用量(基准份)" />
        <van-cell
          v-for="ing in current.ingredients"
          :key="ing.foodId"
          :title="FOODS_MAP[ing.foodId]?.name + (ing.scalable ? '(可缩放)' : '')"
          :value="ing.grams + 'g'"
        />
        <van-cell title="做法" />
        <div class="steps">
          <ol>
            <li v-for="(s, i) in current.steps" :key="i">{{ s }}</li>
          </ol>
        </div>
        <div class="hint">加入今日计划时会按你的目标热量自动调整可缩放食材的克数。</div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { RECIPES } from '../data/recipes'
import { FOODS, FOODS_MAP, FOOD_CATEGORIES } from '../data/foods'
import { computeNutrition } from '../core/planner'
import { EXCLUDE_TAGS } from '../core/nutrition'

const slots = [
  { value: 'all', label: '全部' },
  { value: 'staple', label: '主食' },
  { value: 'protein', label: '蛋白' },
  { value: 'vegetable', label: '蔬菜' },
  { value: 'fruit', label: '水果' },
]
const activeTab = ref(0)

function recipesOf(slot) {
  return slot === 'all' ? RECIPES : RECIPES.filter((r) => r.slot === slot)
}
function foodsOf(cat) {
  return FOODS.filter((f) => f.category === cat)
}
function baseNutrition(recipe) {
  return computeNutrition(recipe.ingredients, FOODS_MAP)
}
function fitText(r) {
  const map = { breakfast: '早', lunch: '午', dinner: '晚' }
  return r.mealFit.map((m) => map[m]).join('/')
}
function tagLabel(t) {
  return EXCLUDE_TAGS.find((x) => x.value === t)?.label || t
}

const recipeShow = ref(false)
const current = ref(null)
function openRecipe(r) {
  current.value = r
  recipeShow.value = true
}
</script>

<style scoped>
.fit {
  font-size: 11px;
  color: #969799;
  margin-left: 6px;
}
.sub {
  font-size: 11px;
  color: #969799;
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
.hint {
  padding: 10px 16px 16px;
  font-size: 12px;
  color: #969799;
}
</style>
