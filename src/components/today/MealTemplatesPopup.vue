<template>
  <!-- 常吃组合模板:把当前餐存为命名模板 / 一键套用到今天同餐 -->
  <van-popup
    :show="show"
    @update:show="$emit('update:show', $event)"
    position="bottom"
    round
    :style="{ height: '64%' }"
  >
    <div class="tpl-panel">
      <div class="tpl-head">
        <span class="tpl-title">{{ mealLabel }} · 常吃组合</span>
        <van-icon name="cross" class="tpl-close" @click="$emit('update:show', false)" />
      </div>
      <van-cell
        v-if="todayItems.length"
        :title="`把今天的${mealLabel}存为模板`"
        label="命名保存,任意一天一键套用;同名再存即更新"
        is-link
        @click="openSave"
      />
      <div class="tpl-list">
        <van-cell v-for="t in mealTemplates" :key="t.id" is-link @click="$emit('apply', t)">
          <template #title>
            <span class="tpl-name">{{ t.name }}</span>
            <span class="tpl-meta">{{ t.items.length }} 个菜品 · 约 {{ tplKcal(t) }} 千卡</span>
          </template>
          <template #label>
            <span class="tpl-preview">{{ t.items.map((it) => recipeName(it.recipeId)).join(' + ') }}</span>
          </template>
          <template #value>
            <van-icon name="delete-o" class="tpl-del" @click.stop="confirmDelete(t)" />
          </template>
        </van-cell>
        <div v-if="!mealTemplates.length" class="tpl-empty">
          {{ todayItems.length ? '还没有模板,把常吃的一餐存进来吧' : '今天这一餐还没有记录,先去添加菜品' }}
        </div>
      </div>
    </div>
    <!-- 命名保存 -->
    <van-dialog
      v-model:show="nameShow"
      title="存为模板"
      show-cancel-button
      confirm-button-text="保存"
      @confirm="doSave"
    >
      <van-field
        v-model="nameInput"
        placeholder="模板名,如:标配早餐"
        maxlength="12"
        class="name-field"
      />
    </van-dialog>
  </van-popup>
</template>

<script setup>
import { ref, computed } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { MEALS } from '../../core/nutrition'
import { computeNutrition } from '../../core/planner'
import { FOODS_MAP } from '../../data/foods'
import { RECIPES_MAP } from '../../data/recipes'
import { useWeekStore } from '../../stores/week'
import { useToday } from '../../composables/useToday'

const props = defineProps({
  show: { type: Boolean, default: false },
  mealKey: { type: String, required: true },
})
const emit = defineEmits(['update:show', 'apply'])

const week = useWeekStore()
const today = useToday()

const mealLabel = computed(() => MEALS.find((m) => m.key === props.mealKey)?.label || '')
const mealTemplates = computed(() => week.templates.filter((t) => t.mealKey === props.mealKey))
const todayItems = computed(() => (week.mealsOf(today.value)?.[props.mealKey] || []).filter(Boolean))

function tplKcal(t) {
  let kcal = 0
  for (const it of t.items) kcal += computeNutrition(it.ingredients, FOODS_MAP).kcal
  return Math.round(kcal)
}
function recipeName(id) {
  return RECIPES_MAP[id]?.name || id
}

// 命名保存:留空则用"早餐常吃"式默认名;同餐同名覆盖更新
const nameShow = ref(false)
const nameInput = ref('')
function openSave() {
  nameInput.value = ''
  nameShow.value = true
}
function doSave() {
  const typed = nameInput.value.trim()
  const name = typed || `${mealLabel.value}常吃`
  if (week.saveTemplate(today.value, props.mealKey, name)) {
    showToast(`已保存「${name}」`)
  }
}
async function confirmDelete(t) {
  try {
    await showConfirmDialog({ title: '删除模板', message: `删除「${t.name}」?套用过的记录不受影响。` })
  } catch {
    return
  }
  week.deleteTemplate(t.id)
  showToast('已删除')
}
</script>

<style scoped>
.tpl-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding-top: 8px;
}
.tpl-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px 10px;
}
.tpl-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}
.tpl-close {
  font-size: 18px;
  color: #969799;
  padding: 4px;
  cursor: pointer;
}
.tpl-list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 20px;
}
.tpl-name {
  font-size: 14px;
  font-weight: 600;
  color: #323233;
  margin-right: 8px;
}
.tpl-meta {
  font-size: 11px;
  color: #969799;
}
.tpl-preview {
  font-size: 12px;
  color: #969799;
}
.tpl-del {
  font-size: 16px;
  color: #969799;
  padding: 4px;
}
.tpl-empty {
  padding: 28px 16px;
  text-align: center;
  font-size: 12px;
  color: #c8c9cc;
}
.name-field {
  margin: 8px 0;
}
</style>
