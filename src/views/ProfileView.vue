<template>
  <div class="page">
    <van-cell-group inset title="身体数据">
      <van-field name="radio" label="性别">
        <template #input>
          <van-radio-group v-model="form.gender" direction="horizontal">
            <van-radio name="male">男</van-radio>
            <van-radio name="female">女</van-radio>
          </van-radio-group>
        </template>
      </van-field>
      <van-field v-model.number="form.age" type="digit" label="年龄" placeholder="岁" />
      <van-field v-model.number="form.height" type="digit" label="身高" placeholder="cm" />
      <van-field v-model.number="form.weight" type="number" label="体重" placeholder="kg" />
      <van-field
        v-model="activityLabel"
        is-link
        readonly
        label="活动量"
        placeholder="选择活动水平"
        @click="showActivity = true"
      />
      <van-popup v-model:show="showActivity" position="bottom" round>
        <van-picker
          :columns="activityColumns"
          @confirm="onActivityConfirm"
          @cancel="showActivity = false"
        />
      </van-popup>
    </van-cell-group>

    <van-cell-group inset title="目标">
      <van-field
        v-model="modeLabel"
        is-link
        readonly
        label="模式"
        placeholder="减脂 / 维持 / 增肌"
        @click="showMode = true"
      />
      <van-popup v-model:show="showMode" position="bottom" round>
        <van-picker
          :columns="modeColumns"
          @confirm="onModeConfirm"
          @cancel="showMode = false"
        />
      </van-popup>
      <div v-if="modeHint" class="hint">{{ modeHint }}</div>
    </van-cell-group>

    <van-cell-group inset title="营养细节">
      <van-field
        v-model="presetLabel"
        is-link
        readonly
        label="宏量比例预设"
        placeholder="选择推荐比例"
        @click="showPreset = true"
      />
      <van-popup v-model:show="showPreset" position="bottom" round>
        <van-picker
          :columns="presetColumns"
          @confirm="onPresetConfirm"
          @cancel="showPreset = false"
        />
      </van-popup>
      <div v-if="presetHint" class="hint">{{ presetHint }}</div>
      <div class="hint">
        当前等效供能比:{{ macroSplitText }}。蛋白按体重定量(而非供能占比)更贴合增肌减脂需求,切换目标模式会自动套用推荐预设。
      </div>
      <van-cell title="蛋白质" :value="`${form.proteinPerKg} g/kg 体重`" />
      <div class="slider-wrap">
        <van-slider
          v-model="form.proteinPerKg"
          :min="1.2"
          :max="2.5"
          :step="0.1"
          @change="onManualMacro"
        />
      </div>
      <van-cell title="脂肪占比" :value="`${Math.round(form.fatRatio * 100)}% 总热量`" />
      <div class="slider-wrap">
        <van-slider
          v-model="fatPct"
          :min="15"
          :max="35"
          :step="1"
          @change="onManualMacro"
        />
      </div>
      <van-field
        v-model="manualKcalInput"
        type="digit"
        label="手动热量"
        placeholder="留空则按公式计算"
      >
        <template #right-icon><span style="color: #969799">千卡</span></template>
      </van-field>
      <van-cell title="三餐比例" :value="`${form.mealSplit.map((v) => Math.round(v * 100)).join(' / ')}`" />
      <div class="split-row">
        <van-field
          v-for="(v, i) in splitInputs"
          :key="i"
          v-model.number="splitInputs[i]"
          type="digit"
          center
          :label="['早', '午', '晚'][i]"
          style="flex: 1"
        >
          <template #right-icon><span style="color: #969799">%</span></template>
        </van-field>
      </div>
    </van-cell-group>

    <van-cell-group inset title="偏好排除(勾选不想出现在食谱里的)">
      <div class="tags">
        <van-checkbox-group v-model="form.excludedTags" direction="horizontal">
          <van-checkbox
            v-for="t in EXCLUDE_TAGS"
            :key="t.value"
            :name="t.value"
            shape="square"
            style="margin: 4px"
          >
            {{ t.label }}
          </van-checkbox>
        </van-checkbox-group>
      </div>
    </van-cell-group>

    <!-- 目标结果预览 -->
    <van-cell-group v-if="previewTargets" inset title="你的每日目标">
      <van-cell title="基础代谢 BMR" :value="`${previewTargets.bmr} 千卡`" />
      <van-cell title="每日消耗 TDEE" :value="`${previewTargets.tdee} 千卡`" />
      <van-cell title="目标热量" :value="`${previewTargets.kcal} 千卡`" value-class="em" />
      <van-cell title="蛋白质" :value="`${previewTargets.protein} g`" value-class="em" />
      <van-cell title="碳水" :value="`${previewTargets.carbs} g`" />
      <van-cell title="脂肪" :value="`${previewTargets.fat} g`" />
      <van-cell
        v-for="m in previewTargets.meals"
        :key="m.key"
        :title="mealLabel(m.key)"
        :value="`${m.kcal} 千卡 · 蛋白 ${m.protein}g`"
      />
      <div class="hint">数值为公式估算,仅供参考;体重明显变化后请更新身体数据。</div>
    </van-cell-group>

    <div style="margin: 16px 0">
      <van-button round block type="primary" @click="save()">保存设置</van-button>
    </div>

    <van-cell-group inset title="体重记录">
      <van-cell
        v-for="(r, i) in weightDesc"
        :key="r.date"
        :title="r.date"
        :value="`${r.kg} kg`"
      >
        <template #label>
          <span v-if="i < weightDesc.length - 1 && weightDesc[i + 1]" :class="changeClass(r.kg - weightDesc[i + 1].kg)">
            较上次 {{ r.kg - weightDesc[i + 1].kg > 0 ? '+' : '' }}{{ (r.kg - weightDesc[i + 1].kg).toFixed(1) }} kg
          </span>
        </template>
        <template #right-icon>
          <van-icon name="delete-o" class="del-icon" @click="removeWeight(r.date)" />
        </template>
      </van-cell>
      <van-cell v-if="!weightDesc.length" title="暂无记录" label="在今日页快捷记录体重" />
    </van-cell-group>

    <van-cell-group inset title="营养小贴士">
      <van-collapse v-model="activeTips">
        <van-collapse-item v-for="t in TIPS" :key="t.id" :title="t.title" :name="t.id">
          <div class="tip-text">{{ t.body }}</div>
        </van-collapse-item>
      </van-collapse>
      <div class="hint">基于公开营养学共识的科普参考,非医疗建议;个体差异大,有基础疾病请咨询医生或注册营养师。</div>
    </van-cell-group>

    <van-cell-group inset title="数据管理">
      <van-cell title="恢复默认设置" is-link @click="doReset" />
    </van-cell-group>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import {
  ACTIVITY_LEVELS,
  GOAL_MODES,
  MACRO_PRESETS,
  MODE_PRESET,
  EXCLUDE_TAGS,
  MEALS,
  calcTargets,
} from '../core/nutrition'
import { useProfileStore } from '../stores/profile'
import { useWeekStore } from '../stores/week'
import { useWeightStore } from '../stores/weight'
import { useCheckinStore } from '../stores/checkin'
import { useCustomFoodsStore } from '../stores/customFoods'
import { removeState } from '../utils/storage'
import { TIPS } from '../data/tips'

const profile = useProfileStore()
const plan = useWeekStore()
const weight = useWeightStore()
const checkin = useCheckinStore()
const customFoods = useCustomFoodsStore()
const activeTips = ref([])

const weightDesc = computed(() => [...weight.records].reverse())
function changeClass(diff) {
  return diff <= 0 ? 'chg-down' : 'chg-up'
}
function removeWeight(date) {
  weight.remove(date)
  showToast('已删除')
}

// 表单本地副本,保存时才写入 store
const form = reactive({
  gender: profile.gender,
  age: profile.age,
  height: profile.height,
  weight: profile.weight,
  activity: profile.activity,
  mode: profile.mode,
  macroPreset: profile.macroPreset || 'custom',
  proteinPerKg: profile.proteinPerKg,
  fatRatio: profile.fatRatio,
  mealSplit: [...profile.mealSplit],
  excludedTags: [...profile.excludedTags],
})
const manualKcalInput = ref(profile.manualKcal != null ? String(profile.manualKcal) : '')
const splitInputs = ref(form.mealSplit.map((v) => Math.round(v * 100)))

const activityColumns = ACTIVITY_LEVELS.map((a) => ({ text: a.label, value: a.value }))
const modeColumns = GOAL_MODES.map((m) => ({ text: m.label, value: m.value }))
const presetColumns = MACRO_PRESETS.map((p) => ({ text: p.label, value: p.value }))
const showActivity = ref(false)
const showMode = ref(false)
const showPreset = ref(false)

const activityLabel = computed(
  () => ACTIVITY_LEVELS.find((a) => a.value === form.activity)?.label || ''
)
const modeLabel = computed(() => GOAL_MODES.find((m) => m.value === form.mode)?.label || '')
const modeHint = computed(
  () => GOAL_MODES.find((m) => m.value === form.mode)?.hint || ''
)

// 脂肪占比 slider 用百分比展示
const fatPct = computed({
  get: () => Math.round(form.fatRatio * 100),
  set: (v) => {
    form.fatRatio = v / 100
  },
})

// 预览目标(随表单实时变化)
const previewTargets = ref(calcTargets(form))
watch(
  () => [
    form.gender,
    form.age,
    form.height,
    form.weight,
    form.activity,
    form.mode,
    form.proteinPerKg,
    form.fatRatio,
    manualKcalInput.value,
    splitInputs.value.join(','),
  ],
  () => {
    previewTargets.value = calcTargets({
      ...form,
      manualKcal: manualKcalInput.value ? Number(manualKcalInput.value) : null,
      mealSplit: normalizeSplit(),
    })
  }
)

function normalizeSplit() {
  const nums = splitInputs.value.map((v) => Number(v) || 0)
  const sum = nums.reduce((a, b) => a + b, 0)
  if (sum <= 0) return [0.3, 0.4, 0.3]
  return nums.map((v) => v / sum) // 不强制=100,按比例归一
}

function onActivityConfirm({ selectedValues }) {
  form.activity = selectedValues[0]
  showActivity.value = false
}

// ---- 宏量预设与模式联动 ----
const presetLabel = computed(
  () => MACRO_PRESETS.find((p) => p.value === form.macroPreset)?.label || '自定义'
)
const presetHint = computed(
  () => MACRO_PRESETS.find((p) => p.value === form.macroPreset)?.hint || ''
)

function onPresetConfirm({ selectedValues }) {
  const preset = MACRO_PRESETS.find((p) => p.value === selectedValues[0])
  if (preset?.proteinPerKg != null) {
    form.proteinPerKg = preset.proteinPerKg
    form.fatRatio = preset.fatRatio
    form.macroPreset = preset.value
  }
  showPreset.value = false
}

// 手动调滑块后视为自定义
function onManualMacro() {
  form.macroPreset = 'custom'
}

function onModeConfirm({ selectedValues }) {
  form.mode = selectedValues[0]
  showMode.value = false
  // 模式联动:自动套用该模式的推荐宏量预设(仍可再微调)
  const preset = MACRO_PRESETS.find((p) => p.value === MODE_PRESET[form.mode])
  if (preset?.proteinPerKg != null) {
    form.proteinPerKg = preset.proteinPerKg
    form.fatRatio = preset.fatRatio
    form.macroPreset = preset.value
    showToast(`已套用"${preset.label}"预设,可在营养细节中微调`)
  }
}

// 等效供能比(帮助没有"三大营养素"概念的使用者建立直觉)
const macroSplitText = computed(() => {
  const t = previewTargets.value
  const kcal = t.kcal || 1
  const p = Math.round(((t.protein * 4) / kcal) * 100)
  const f = Math.round(((t.fat * 9) / kcal) * 100)
  const c = Math.max(0, 100 - p - f)
  return `蛋白 ${p}% · 碳水 ${c}% · 脂肪 ${f}%`
})

function mealLabel(key) {
  return MEALS.find((m) => m.key === key)?.label || key
}

function save(silent = false) {
  if (!form.age || !form.height || !form.weight) {
    if (!silent) showToast('请先填完年龄、身高、体重')
    return
  }
  profile.update({
    ...form,
    mealSplit: normalizeSplit(),
    manualKcal: manualKcalInput.value ? Number(manualKcalInput.value) : null,
  })
  if (!silent) showToast('已保存')
}

// 自动保存:任何调整(滑块/模式/排除项等)静默持久化,切页不再丢失;
// "保存设置"按钮保留,作为带反馈的显式确认入口
watch(
  () => [JSON.stringify({ ...form }), manualKcalInput.value, splitInputs.value.join(',')],
  () => {
    if (form.age && form.height && form.weight) save(true)
  }
)

// ---- 数据管理 ----
async function doReset() {
  try {
    await showConfirmDialog({ title: '恢复默认', message: '将清空全部设置、周计划、打卡、体重记录与自定义食物,确定?' })
  } catch {
    return
  }
  profile.reset()
  plan.clearAll()
  checkin.clear()
  weight.clear()
  customFoods.clear()
  removeState('plan') // v0.1 遗留的单日 plan key,防止日后经迁移逻辑"复活"
  window.location.reload()
}
</script>

<style scoped>
.hint {
  padding: 8px 16px 12px;
  font-size: 12px;
  color: #969799;
  line-height: 1.6;
}
.slider-wrap {
  padding: 0 16px 14px;
}
.split-row {
  display: flex;
  gap: 4px;
  padding: 0 4px;
}
.tags {
  padding: 10px 12px;
}
.tip-text {
  font-size: 13px;
  color: #646566;
  line-height: 1.7;
}
.chg-down {
  color: var(--cb-primary);
  font-size: 11px;
}
.chg-up {
  color: #ff976a;
  font-size: 11px;
}
.del-icon {
  font-size: 16px;
  color: #969799;
  padding: 4px 2px;
}
:deep(.em) {
  color: var(--cb-primary);
  font-weight: 600;
}
</style>
