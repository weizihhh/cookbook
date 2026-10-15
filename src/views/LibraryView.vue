<template>
  <div class="page">
    <van-search
      v-model="searchKw"
      class="library-search"
      placeholder="搜索食谱或食材,如:鸡胸、豆腐"
    />
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
              <van-tag v-if="r.custom" plain type="primary" size="medium" style="margin-left: 4px">{{ r.source || '自定义' }}</van-tag>
              <van-tag v-if="searchKw.trim() && s.value !== 'all' && r.slot !== s.value" color="#c8c9cc" size="medium" style="margin-left: 4px">{{ SLOT_LABELS[r.slot] || r.slot }}</van-tag>
              <van-tag v-if="r.antiInfl" color="var(--cb-primary)" size="medium" style="margin-left: 4px">抗炎</van-tag>
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
        <div class="pcf-legend">P=蛋白质 · C=碳水 · F=脂肪 · 纤=膳食纤维,每 100g 含量(g)</div>
        <van-cell-group
          v-for="g in foodGroups"
          :key="g.value"
          inset
          :title="g.label"
          style="margin-top: 10px"
        >
          <van-cell
            v-for="f in g.foods"
            :key="f.id"
            :title="f.name"
          >
            <template #label>
              每 100g
              <span v-if="f.unit" class="unit-hint">· 1{{ f.unit }}≈{{ f.unitGrams }}g</span>
              <span v-if="f.weeklyLimit" class="unit-hint">· 建议 ≤{{ f.weeklyLimit }} 次/周</span>
              <van-tag v-if="f.antiInfl" color="var(--cb-primary)" size="medium" style="margin-left: 2px">抗炎</van-tag>
            </template>
            <template #value>
              <div>{{ f.kcal }} 千卡</div>
              <div class="sub">P{{ f.protein }} · C{{ f.carbs }} · F{{ f.fat }} · 纤{{ f.fiber ?? 0 }}</div>
            </template>
          </van-cell>
        </van-cell-group>
        <van-empty v-if="!foodGroups.length" image-size="60" description="没有匹配的食材" />
      </van-tab>
      <van-tab :title="`自定义${customFoods.foods.length ? '(' + customFoods.foods.length + ')' : ''}`">
        <div class="pcf-legend">P=蛋白质 · C=碳水 · F=脂肪 · 纤=膳食纤维,每 100g 含量(g)</div>
        <div class="custom-actions">
          <van-button size="small" type="primary" @click="openImport">📷 拍照导入</van-button>
          <van-button size="small" type="primary" plain @click="openImport">手动添加</van-button>
        </div>
        <div class="source-filter">
          <van-tag
            v-for="s in ['全部', ...customFoods.allSources]"
            :key="s"
            :plain="filterSource !== s"
            :type="filterSource === s ? 'primary' : 'default'"
            class="source-tag"
            @click="filterSource = s"
          >
            {{ s }}
          </van-tag>
        </div>
        <van-cell-group inset style="margin-top: 10px">
          <van-cell
            v-for="f in customFoodsFiltered"
            :key="f.id"
            is-link
            @click="openEdit(f)"
          >
            <template #title>
              {{ f.name }}
              <van-tag v-if="f.source" plain type="primary" size="medium" style="margin-left: 4px">{{ f.source }}</van-tag>
            </template>
            <template #label>
              每 100g
              <span v-if="f.unit" class="unit-hint">· 1{{ f.unit }}≈{{ f.unitGrams }}g</span>
            </template>
            <template #value>
              <div>{{ f.kcal }} 千卡</div>
              <div class="sub">P{{ f.protein }} · C{{ f.carbs }} · F{{ f.fat }} · 纤{{ f.fiber ?? 0 }}</div>
            </template>
          </van-cell>
          <van-empty
            v-if="!customFoodsFiltered.length"
            image-size="60"
            :description="searchKw.trim() ? '没有匹配的自定义食物' : '还没有自定义食物,拍照识别包装上的营养成分表试试'"
          />
        </van-cell-group>
      </van-tab>
    </van-tabs>

    <!-- 食谱详情 -->
    <van-popup v-model:show="recipeShow" position="bottom" round :style="{ maxHeight: '75%' }">
      <div v-if="current" class="detail">
        <div class="detail-title">
          {{ current.name }}
          <van-tag v-if="current.antiInfl" color="var(--cb-primary)" size="large" style="vertical-align: 2px">抗炎</van-tag>
        </div>
        <div class="nutri-grid" style="margin-bottom: 12px">
          <div><div class="num">{{ baseNutrition(current).kcal }}</div><div class="label">千卡/基准份</div></div>
          <div><div class="num">{{ baseNutrition(current).protein }}g</div><div class="label">蛋白质</div></div>
          <div><div class="num">{{ baseNutrition(current).carbs }}g</div><div class="label">碳水</div></div>
          <div><div class="num">{{ baseNutrition(current).fat }}g</div><div class="label">脂肪</div></div>
          <div><div class="num">{{ baseNutrition(current).fiber }}g</div><div class="label">膳食纤维</div></div>
        </div>
        <van-cell title="食材用量(基准份)" />
        <van-cell
          v-for="ing in current.ingredients"
          :key="ing.foodId"
          :title="FOODS_MAP[ing.foodId]?.name + (ing.scalable ? '(可缩放)' : '')"
          :value="formatFoodAmount(FOODS_MAP[ing.foodId], ing.grams)"
        />
        <template v-if="current.steps?.length">
          <van-cell title="做法" />
          <div class="steps">
            <ol>
              <li v-for="(s, i) in current.steps" :key="i">{{ s }}</li>
            </ol>
          </div>
        </template>
        <div class="hint">
          抗炎标注参照抗炎饮食研究共识(如膳食炎症指数 DII)近似归类,属生活方式参考,不作医疗建议。
          加入今日计划时会按你的目标热量自动调整可缩放食材的克数。
        </div>
      </div>
    </van-popup>

    <!-- 自定义食物:拍照导入 / 手动录入 / 编辑 -->
    <van-popup v-model:show="importShow" position="bottom" round :style="{ maxHeight: '88%' }">
      <div class="import-panel">
        <div class="detail-title">{{ form.id ? '编辑自定义食物' : '拍照导入 / 手动录入' }}</div>

        <div v-if="!form.id" class="photo-row">
          <van-button size="small" type="primary" plain @click="imgInput?.click()">📷 选择/拍摄图片</van-button>
          <span class="ocr-hint">{{ ocrHint }}</span>
        </div>
        <img v-if="photoUrl" :src="photoUrl" class="photo-preview" alt="成分表照片" />
        <input
          ref="imgInput"
          type="file"
          accept="image/*"
          capture="environment"
          style="display: none"
          @change="onImage"
        />

        <van-field v-model="form.name" label="名称" placeholder="如:山姆全麦贝果" />
        <van-field
          v-model="form.source"
          is-link
          readonly
          label="来源渠道"
          placeholder="山姆 / 盒马 / 麦当劳…"
          @click="showSourcePicker = true"
        />
        <van-field v-model.number="form.kcal" type="number" label="能量">
          <template #right-icon><span class="field-unit">千卡/100g</span></template>
        </van-field>
        <van-field v-model.number="form.protein" type="number" label="蛋白质">
          <template #right-icon><span class="field-unit">g/100g</span></template>
        </van-field>
        <van-field v-model.number="form.fat" type="number" label="脂肪">
          <template #right-icon><span class="field-unit">g/100g</span></template>
        </van-field>
        <van-field v-model.number="form.carbs" type="number" label="碳水">
          <template #right-icon><span class="field-unit">g/100g</span></template>
        </van-field>
        <van-field v-model.number="form.fiber" type="number" label="膳食纤维" placeholder="可选">
          <template #right-icon><span class="field-unit">g/100g</span></template>
        </van-field>
        <div class="unit-row">
          <van-field v-model="form.unit" label="生活单位" placeholder="可选,如:片/袋" style="flex: 1" />
          <van-field v-model.number="form.unitGrams" type="number" placeholder="单位克数" style="flex: 1">
            <template #right-icon><span class="field-unit">g</span></template>
          </van-field>
        </div>
        <div class="hint">
          数值按每 100g 填写;包装标"每份"时先换算(数值 ÷ 每份克数 × 100),
          标"每 100mL"时按 1:1 近似。识别结果只是预填,请对照包装核对。
        </div>
        <div style="display: flex; gap: 10px; margin: 12px 0">
          <van-button block @click="importShow = false">取消</van-button>
          <van-button block type="primary" @click="saveCustom">保存</van-button>
        </div>
        <van-button v-if="form.id" block type="danger" plain @click="removeCustom">删除此食物</van-button>
      </div>
    </van-popup>

    <!-- 渠道选择 -->
    <van-popup v-model:show="showSourcePicker" position="bottom" round>
      <van-picker
        :columns="sourceColumns"
        @confirm="onSourceConfirm"
        @cancel="showSourcePicker = false"
      />
    </van-popup>

    <!-- 新增渠道 -->
    <van-popup v-model:show="showSourceAdd" position="bottom" round>
      <div class="source-add">
        <div class="detail-title">新增渠道</div>
        <van-field v-model="newSource" placeholder="如:瑞幸、便利店、网购" />
        <div style="display: flex; gap: 10px; margin: 12px 0">
          <van-button block @click="showSourceAdd = false">取消</van-button>
          <van-button block type="primary" @click="confirmNewSource">添加</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { showToast, showConfirmDialog, showLoadingToast, closeToast } from 'vant'
import { RECIPES } from '../data/recipes'
import { FOODS, FOODS_MAP, FOOD_CATEGORIES, formatFoodAmount } from '../data/foods'
import { SLOT_LABELS, computeNutrition, recipeMatchesKw } from '../core/planner'
import { EXCLUDE_TAGS } from '../core/nutrition'
import { parseNutritionLabel, normalizeTo100g } from '../core/labelScan'
import { scanImageText } from '../utils/ocr'
import { useCustomFoodsStore } from '../stores/customFoods'
import { useWeekStore } from '../stores/week'

const slots = [
  { value: 'all', label: '全部' },
  { value: 'staple', label: '主食' },
  { value: 'protein', label: '蛋白' },
  { value: 'vegetable', label: '蔬菜' },
  { value: 'fruit', label: '水果' },
  { value: 'anti', label: '抗炎' },
]
const activeTab = ref(0)
const searchKw = ref('')

// 搜索时放开槽位筛选,全库(含自定义食物)按名称或所含食材名匹配
function recipesOf(slot) {
  const kw = searchKw.value.trim()
  if (kw) return allLibraryRecipes.value.filter((r) => recipeMatchesKw(r, kw, FOODS_MAP))
  if (slot === 'all') return RECIPES
  if (slot === 'anti') return RECIPES.filter((r) => r.antiInfl)
  return RECIPES.filter((r) => r.slot === slot)
}

// 食材分组:无关键词按类目分组,有关键词时跨类目合并为一组
const foodGroups = computed(() => {
  const kw = searchKw.value.trim()
  if (kw) {
    const matched = FOODS.filter((f) => f.name.includes(kw))
    return matched.length
      ? [{ value: '__search__', label: `"${kw}" · ${matched.length} 个食材`, foods: matched }]
      : []
  }
  return FOOD_CATEGORIES.map((c) => ({
    ...c,
    foods: FOODS.filter((f) => f.category === c.value),
  }))
})
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

// ---- 自定义食物:拍照导入 / 手动录入 / 编辑 ----
const customFoods = useCustomFoodsStore()
const week = useWeekStore()

const filterSource = ref('全部')
const customFoodsFiltered = computed(() => {
  const kw = searchKw.value.trim()
  const base =
    filterSource.value === '全部'
      ? customFoods.foods
      : customFoods.foods.filter((f) => f.source === filterSource.value)
  return kw ? base.filter((f) => f.name.includes(kw)) : base
})
const allLibraryRecipes = computed(() => RECIPES.concat(customFoods.recipes))

const importShow = ref(false)
const imgInput = ref(null)
const photoUrl = ref('')
const ocrHint = ref('')
const showSourcePicker = ref(false)
const showSourceAdd = ref(false)
const newSource = ref('')

// 表单数值统一按"每 100g"口径;OCR 预填时即完成每份/每100mL 换算
const form = reactive({
  id: null,
  name: '',
  source: '',
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  fiber: null,
  unit: '',
  unitGrams: null,
})

const sourceColumns = computed(() => [
  ...customFoods.allSources.map((s) => ({ text: s, value: s })),
  { text: '➕ 新增渠道', value: '__add__' },
])

function resetForm() {
  Object.assign(form, {
    id: null, name: '', source: '', kcal: null, protein: null, carbs: null, fat: null, fiber: null, unit: '', unitGrams: null,
  })
  if (photoUrl.value) {
    URL.revokeObjectURL(photoUrl.value)
    photoUrl.value = ''
  }
  ocrHint.value = ''
}

function openImport() {
  resetForm()
  importShow.value = true
}

function openEdit(f) {
  resetForm()
  Object.assign(form, {
    id: f.id,
    name: f.name,
    source: f.source || '',
    kcal: f.kcal,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    fiber: f.fiber ?? null,
    unit: f.unit || '',
    unitGrams: f.unitGrams ?? null,
  })
  importShow.value = true
}

async function onImage(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photoUrl.value = URL.createObjectURL(file)
  ocrHint.value = ''
  const toast = showLoadingToast({ message: '准备识别…', forbidClick: true, duration: 0 })
  let msg = ''
  try {
    const text = await scanImageText(file, (s) => {
      toast.message = s
    })
    const parsed = parseNutritionLabel(text)
    const norm = parsed && normalizeTo100g(parsed)
    if (norm) {
      if (norm.kcal != null) form.kcal = norm.kcal
      if (norm.protein != null) form.protein = norm.protein
      if (norm.carbs != null) form.carbs = norm.carbs
      if (norm.fat != null) form.fat = norm.fat
      if (norm.fiber != null) form.fiber = norm.fiber
      ocrHint.value =
        parsed.basis === 'perServe'
          ? `已按每份 ${parsed.perServeGrams}g 换算为每 100g 数值`
          : parsed.basis === '100ml'
            ? '按每 100mL ≈ 100g 近似'
            : '按每 100g 口径识别'
      msg = '识别完成,请核对数值'
    } else if (parsed) {
      msg = '该表按"每份"标注且未识别到克数,请手动换算填写'
    } else {
      msg = '未识别出营养成分表,请对照照片手填'
    }
  } catch {
    msg = '识别失败(首次需联网下载识别包),请手填'
  } finally {
    closeToast()
  }
  if (msg) showToast(msg)
}

function onSourceConfirm({ selectedValues }) {
  showSourcePicker.value = false
  if (selectedValues[0] === '__add__') {
    newSource.value = ''
    showSourceAdd.value = true
    return
  }
  form.source = selectedValues[0]
}

function confirmNewSource() {
  const s = newSource.value.trim()
  if (!s) {
    showToast('请输入渠道名')
    return
  }
  if (!customFoods.sources.includes(s)) customFoods.sources.push(s)
  customFoods.persist()
  form.source = s
  showSourceAdd.value = false
}

const r1 = (v) => Math.round(v * 10) / 10

function saveCustom() {
  if (!form.name.trim()) {
    showToast('请填写名称')
    return
  }
  const kcal = Number(form.kcal)
  const protein = Number(form.protein)
  const carbs = Number(form.carbs)
  const fat = Number(form.fat)
  const fiber = form.fiber == null || form.fiber === '' ? null : Number(form.fiber)
  if (!(kcal >= 0 && kcal <= 1000)) {
    showToast('能量请填 0-1000(每 100g 千卡)')
    return
  }
  if ([protein, carbs, fat].some((v) => !(v >= 0 && v <= 100))) {
    showToast('蛋白/碳水/脂肪请填 0-100(每 100g 克数)')
    return
  }
  if (fiber != null && !(fiber >= 0 && fiber <= 80)) {
    showToast('膳食纤维请填 0-80(每 100g 克数)')
    return
  }
  if (!!form.unit !== !!form.unitGrams) {
    showToast('生活单位与克数需成对填写')
    return
  }
  if (form.unit && !(form.unitGrams >= 1 && form.unitGrams <= 1000)) {
    showToast('单位克数请填 1-1000')
    return
  }
  const exist = form.id ? customFoods.foods.find((f) => f.id === form.id) : null
  customFoods.upsert({
    id: form.id || 'cf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: form.name.trim(),
    source: form.source || '',
    kcal: Math.round(kcal),
    protein: r1(protein),
    carbs: r1(carbs),
    fat: r1(fat),
    ...(fiber != null ? { fiber: r1(fiber) } : {}),
    ...(form.unit ? { unit: form.unit.trim(), unitGrams: r1(form.unitGrams) } : {}),
    ...(exist?.createdAt != null ? { createdAt: exist.createdAt } : { createdAt: Date.now() }),
  })
  showToast(form.id ? '已更新' : '已添加')
  importShow.value = false
}

async function removeCustom() {
  try {
    await showConfirmDialog({
      title: '删除自定义食物',
      message: `确定删除"${form.name}"?各天餐单中的同名条目会一并移除。`,
    })
  } catch {
    return
  }
  customFoods.remove(form.id)
  const removed = week.removeRecipeEverywhere('cr_' + form.id)
  importShow.value = false
  showToast(removed > 0 ? `已删除(并移除餐单中的 ${removed} 条)` : '已删除')
}
</script>

<style scoped>
.library-search {
  padding: 8px 12px;
  background: transparent;
}
.library-search :deep(.van-search__content) {
  border-radius: 999px;
}
.pcf-legend {
  padding: 8px 16px 0;
  font-size: 11px;
  color: #969799;
}
.fit {
  font-size: 11px;
  color: #969799;
  margin-left: 6px;
}
.sub {
  font-size: 11px;
  color: #969799;
}
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
.hint {
  padding: 10px 16px 16px;
  font-size: 12px;
  color: #969799;
}
.custom-actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px 4px;
}
.source-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 16px 0;
}
.source-tag {
  cursor: pointer;
}
.import-panel {
  padding: 16px;
  max-height: 86vh;
  overflow-y: auto;
}
.photo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 8px;
}
.ocr-hint {
  font-size: 12px;
  color: var(--cb-primary);
}
.photo-preview {
  max-width: 100%;
  max-height: 160px;
  border-radius: 12px;
  margin-bottom: 8px;
}
.field-unit {
  font-size: 12px;
  color: #969799;
}
.unit-row {
  display: flex;
  gap: 4px;
}
.source-add {
  padding: 16px;
}
</style>
