# cookbook 代码评审 v6 —— 全方面评估(架构/逻辑/数据/性能/工程/产品)

> 评审日期:2026-10-15;基线:HEAD = `8bbd82a`(v0.20.1,评审 v5 落地),`npm run verify` **全绿**(本轮实测)。
> 方法沿用评审约定:结论区分【代码事实】/【推断,需确认】/【产品决策,待定】;
> 已读 `docs/DECISIONS.md` 与 v1~v5 评审文档,**不重提已议决项**(周计划 UI、闸门阈值、抗炎分级、真 App 等)。
> 本轮视角:v1~v5 聚焦"逻辑正确性 + 数据准确性",本轮补**此前未系统评估的维度**——
> 部署形态、构建体积、运行时资源、备份健壮性、工程化配套。
> 本轮通读:src 全部 27 个源文件(含 4 个视图、4 个组件、5 个 store、core/utils/data)、
> index.html、vite.config.js、public/sw.js、dist 构建产物。

---

## 1. 总体评价

项目在"个人自用纯前端工具"这个定位下,工程质量明显超出同类随手项目的平均水平:

- **分层干净**:纯函数内核(core/ 无框架依赖)→ Pinia 薄 store → 视图;数据层(foods/recipes/tips)
  与逻辑层完全分离,verify 得以在 node 环境直测内核。
- **数据治理有体系**:锚点断言 + 自洽闸门 + 官方条目溯源 + DECISIONS 决策史,
  这套"防自己改错"的机制是项目最值钱的资产。
- **细节完成度高**:跨零点自愈(useToday)、localStorage 配额满节流提示、已吃锁定语义、
  克数单位吸附、食部/生干熟角标、PWA 离线壳——都是踩过坑才会有的设计。
- **v5 四条发现当天落地**(8bbd82a),评审→修复→断言固化的闭环运转正常。

评分(10 分制,与 v5 同口径;本轮新评维度单列):

| 维度 | 评分 | 说明 |
|---|---|---|
| 数据准确性 | 9.2 | 维持 v5;锚点+闸门+标签断言三层防护在位 |
| 逻辑正确性 | 9.3 | v5 修复落地后回升;本轮未发现新的逻辑错误 |
| 功能完善性 | 8.4 | 缺口均在 DECISIONS/路线表内,无新增 |
| 工程质量 | 8.8 | 本轮新评:扣分在部署形态(F-1)、构建体积(F-2)、无 lint 配套 |
| 性能与资源 | 8.0 | 本轮新评:首屏 545KB(F-2)、OCR worker 常驻(F-3) |
| 部署与备份健壮性 | 7.8 | 本轮新评:子路径部署即挂(F-1)、导入不清理残留 key(F-5) |

---

## 2. 新发现

### F-1【代码事实,中】构建产物用绝对路径 `/assets/...`,子路径部署即白屏

`vite.config.js` 无 `base` 配置(默认 `/`),dist/index.html 实测产物:

```html
<script type="module" crossorigin src="/assets/index-D13jgHtf.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-DRqWURQI.css">
```

而项目其它部分全是按"可部署到任意静态平台/子路径"设计的:hash 路由(router/index.js
注释明说"纯静态部署零配置")、sw.js 与 manifest 全部 `./` 相对路径。唯独构建产物本身
是绝对路径——部署到子路径(如 `xxx.github.io/cookbook/` 或任意二级目录)时 JS/CSS 404,
应用完全无法启动。

- **修复建议**:`vite.config.js` 加 `base: './'`。相对 base 与现有 hash 路由、
  相对 SW 注册路径、SW 内 `./` 缓存键完全同向,无副作用。
- **配套建议**:verify 可加一条构建产物断言(若 build 后校验 index.html 无 `/assets/` 绝对引用),
  或至少在 DECISIONS/部署文档注明"base 必须保持相对"。

### F-2【代码事实,中】Vant 全量引入,首屏 345KB JS + 200KB CSS

`main.js` `app.use(Vant)` 全量注册 + `import 'vant/lib/index.css'` 全量样式。
dist 实测:主 chunk `index-D13jgHtf.js` **345KB**、主 CSS **200KB**(未 gzip;
gzip 后约 110KB + 30KB)。实际用到的组件约 20 个(cell/field/popup/picker/stepper/
tabs/tag/empty/action-sheet/progress/slider/checkbox/collapse/icon/search/button/
toast/dialog),Vant 4 共 70+ 组件。

- **影响**:移动网络首屏加载与解析时间;PWA 已装到主屏后走缓存影响减弱,但首次访问
  与每次发版后的冷启动都要付这个成本。
- **修复建议**:`unplugin-vue-components` + `VantResolver` 按需引入(组件与样式均按需),
  预期主包降到 150KB 以内。改动只在 vite.config 与 main.js,组件标签写法不变。
  toast/dialog 等函数式组件需 `import { showToast } from 'vant'`(现状已是,天然兼容)。
- 收益与风险都清晰,属纯工程优化,不改任何行为。

### F-3【代码事实,低】OCR worker 创建后常驻,从不释放

`utils/ocr.js` `workerPromise` 单例化后无 `terminate()` 路径。Tesseract worker
(wasm 核心 + chi_sim 语言包)常驻内存约几十 MB,手机端长期挂后台有内存压力。

- **缓解现状**:语言包加载本就慢(10-25MB),常驻换来第二次拍照秒开,是有意义的取舍。
- **可选优化**:识别完成后启动空闲计时(如 3 分钟无新任务则 terminate 并置空
  workerPromise),下次使用重新懒加载。优先级低,登记即可。

### F-4【代码事实,低】`storage.js` 重复导出 `todayStr`,无人使用

`utils/storage.js:67-71` 定义并导出了 `todayStr`,与 `utils/date.js:8` 完全重复;
全仓 grep 确认所有调用方都 import 自 `date.js`,storage 版本为死代码。一行删除。

### F-5【代码事实,低】导入备份不清理"当前有而备份没有"的 key

`ProfileView.vue doImport()`:逐项 `localStorage.setItem(LS_PREFIX + k, ...)` 写入
备份内容,但**不删除**当前多出的 `cookbook:*` key。场景:备份后项目新增了 store key
(或旧版本遗留 key,如已迁移的 `cookbook:plan`),导入旧备份后这些 key 残留——
`week.js initState()` 恰好有"旧 `cookbook:plan` key 存在则迁移"的逻辑,若当前
localStorage 里残留一个旧 plan key,导入后会被当成待迁移数据处理一次。

- **影响**:低(需要"残留旧 key + 导入备份"叠加;且迁移内容是有据的旧数据)。
- **修复建议**:导入确认后,先遍历删除全部 `cookbook:` 前缀 key 再写入备份,
  与"覆盖当前全部数据"的确认文案语义一致。改动 3 行。

### F-6【代码事实,低】SW 缓存清理依赖手动 bump 版本号

`public/sw.js` `CACHE = 'cookbook-shell-v2'` 为手写常量,发版清旧缓存靠"记得改它"
(文件注释已写明流程,属纪律约束)。忘记 bump 时:network-first 的导航与哈希静态资源
仍工作正常(功能不坏),但旧哈希文件永驻缓存,占用无限增长。

- **可选优化**:构建后脚本把 `CACHE` 替换为构建哈希(如 `cookbook-shell-${Date.now()}`),
  发版零纪律成本;或在 verify 加"sw.js 的 CACHE 版本与 package.json version 关联"的弱检查。
  优先级低。

### F-7【推断,需确认,低】`customFoods.sync()` 依赖"视图先挂载"的隐式时序

`customFoods.sync()` 把自定义食物注册进运行时 `FOODS_MAP/RECIPES_MAP`,当前在
TodayView、RecordView 等视图的 setup 里手动调用(grep 见 TodayView:237、RecordView:247)。
正确性依赖"用户经过的每个需要查自定义食物的视图都调了 sync"。今日页是默认首页,
实际总能先注册,**当前无 bug**;但注册逻辑放视图层是隐式契约,将来新增入口
(如桌面快捷直达某弹层)容易漏。

- **建议**:挪到 `main.js` 启动时统一执行一次(store 已持久化自举,sync 幂等),
  视图层的调用可留可删。属防御性整理,非缺陷修复。

### F-8【代码事实,极低】TodayView 体重输入框跨零点残留

`TodayView.vue:470` `weightInput` 在 setup 时按当天已记体重初始化一次;跨零点后
`today` 刷新(useToday 生效),但输入框仍显示昨天填过的值。次日首次打开若直接点
"记录",写入的是新日期+旧值——值本身通常仍接近真实体重,危害可忽略。
可用 `watch(today, () => weightInput.value = ...)` 同步,或加 placeholder 区分。

---

## 3. 分维度评估(维持项)

### 架构与逻辑
- 纯函数内核(core/planner、core/nutrition、core/labelScan)零框架依赖,verify 直测,
  这是全项目最正确的结构决策。v5 把 store 组装层盲区(usedIds、标签一致性)补进断言后,
  "错了没红灯"的区域基本清零。
- 本轮未发现 v5 之外的逻辑错误。已登记残余(天内频次不累计、鸡肝死配置、薯类食部、
  src 条目号溯源)维持 DECISIONS 与 v4/v5 结论,不重复展开。

### 数据准确性
- 锚点 + 闸门 + 官方溯源三层机制本轮复核在位;红薯、燕麦、食部折算等高杠杆值无回退。
- fiber/钠未建模属已登记路线项。

### 性能
- 除 F-2/F-3 外:视图路由级 code-splitting 已做(4 个视图各自 chunk);tesseract
  动态 import(77KB chunk 独立);数据文件(foods/recipes ~60KB)在主包内合理。
- `computeNutrition` 在 TodayView 模板渲染路径中逐条调用,数据量小(单餐几条),
  无优化必要。

### 安全与隐私
- 无网络请求(OCR 语言包 CDN 除外)、无 v-html、无 eval;备份导出/导入有确认层。
  纯本地定位下无攻击面。

### 工程化配套(缺口)
- **无 ESLint/Prettier 配置**:个人项目非必需,但 .vue/.js 风格靠自觉,
  后续若回炉重读成本高时可补一份最小配置。
- **无组件层测试**:verify 只测纯函数与数据。F-7 这类"注册时序"问题组件测试能抓,
  但投入产出比对单人项目不划算,维持现状即可。

---

## 4. 优化优先级建议

| 优先级 | 项 | 改动量 | 说明 |
|---|---|---|---|
| 1 | F-1 `base: './'` | 1 行 | 不修则子路径部署直接不可用,性价比最高 |
| 2 | F-2 Vant 按需引入 | 构建配置 + main.js | 首屏体积减半以上,纯工程优化 |
| 3 | F-5 导入先清后写 | ~3 行 | 与确认文案语义对齐,堵旧 key 残留 |
| 4 | F-4 删死代码 | 1 行 | 顺手 |
| 5 | F-7 sync 启动时注册 | ~3 行 | 防御性整理 |
| 6 | F-3 / F-6 / F-8 | 小 | 登记即可,不急于做 |

F-1~F-5 均不涉及 DECISIONS 已议决的产品决策,可作为"评审 v6 落地"版本收掉
(修复/优化类,建议 v0.20.2)。**本轮未改动任何源码,以上均为待确认方案。**

---

## 5. 评审自身检查

- F-1 结论来自 dist/index.html 实测产物(`src="/assets/index-*.js"`),非推断。
- F-2 体积数字来自 dist/assets 目录实测文件大小。
- F-4 死代码判定经全仓 grep 所有 `todayStr` 引用点确认。
- F-5 的 doImport 行为逐行回读 ProfileView.vue:419-452。
- verify 本轮实测全绿;基线 commit `8bbd82a`。
- 未重提 DECISIONS 已议决项;未对"周计划 UI 恢复"等产品决策排序。

---

*评审人:WorkBuddy;方法:全量源码通读(src 27 文件)+ 构建产物实测 + verify 实测。*

---

## 6. 审阅附注与落地记录(zhangwei 侧核验,2026-10-15)

### 逐条核验结论

F-1/F-3/F-4/F-5/F-6/F-8 六条**全部成立**,事实、行号与影响评估核对无误;
F-7 成立(调用点实际 3 处:TodayView:237、RecordView:247、LibraryView:301)。

### 两处更正

**更正一(§3 性能小节)**:"tesseract 动态 import(77KB chunk 独立)"与
"数据文件 foods/recipes 在主包内"两条均与产物不符:77KB 的
`customFoods-Cjnjn7Y1.js` 不含任何 tesseract 代码,而是四个异步视图共享的
store+数据层 chunk(含全部食物数据);tesseract.js 实际是独立的 15.8KB chunk;
345KB 主包内食物数据 0 命中,几乎纯为 vue+router+pinia+vant 全量。结论不变,
且 F-2 的收益估计因此更可信。

**更正二(F-2"天然兼容")**:Vant 4 按需 resolver 只解析模板 `<van-*>` 标签;
showToast(34 处)、showConfirmDialog(10 处)、showLoadingToast(2 处)是直接
import 的函数式组件,若按原方案"删全量 CSS + 按需"而不补样式导入,toast/
对话框将样式丢失。落地时已补 `vant/es/toast/style`、`vant/es/dialog/style`
(main.js),并把 storage.js 的 `import('vant')` 收窄为 `import('vant/es/toast')`
(按需化后动态引全量 vant 会另打一个大 chunk)。

### 落地记录(v0.20.2)

- F-1:vite.config.js `base: './'`(DECISIONS 登记"base 必须保持相对")
- F-2:按需引入落地,含上述两项配套;新增 devDeps unplugin-vue-components、
  @vant/auto-import-resolver;安装时暴露既存的 vue-router 可选 peer 冲突,
  以项目 .npmrc legacy-peer-deps 固化(DECISIONS 有说明)
- F-5:doImport 先清后写(倒序遍历删全部 cookbook:* 再写入备份)
- F-4:storage.js 死代码 todayStr 已删(verify.mjs 用的是 date.js 版,不受影响)
- F-7:customFoods.sync() 移至 main.js 启动时,三处视图调用及 TodayView/
  RecordView 中已无他用的 store 引用一并清理
- F-3 / F-6 / F-8:原定登记不落地,后经确认于 v0.20.3 收掉——F-3 识别结束后
  空闲 3 分钟自动 terminate(wasm/语言包走 HTTP 缓存,重建秒级);F-6 build 命令
  追加 scripts/sw-cache.mjs,以主 chunk 哈希自动重写 dist/sw.js 的 CACHE,
  无需手动 bump;F-8 体重输入框 watch(today) 跨零点重置为新当天已记值
