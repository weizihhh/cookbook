# cookbook 代码评审 v7 —— 全方面评估(架构/逻辑/数据/性能/测试体系/产品)

> 评审日期:2026-10-16;基线:HEAD = `3a0a698`(v0.26.0,天内频次累计 + 多餐次),
> `node scripts/verify.mjs` **本轮实测全绿(163 项断言)**;Vitest/Playwright 本轮未重跑
> (最近一次全绿见 TEST_PLAN §11 P2 落地记录,v0.25.0)。
> 方法沿用评审约定:结论区分【代码事实】/【推断,需确认】/【产品决策,待定】;
> 已读 `docs/DECISIONS.md`、`docs/TEST_PLAN.md` 与 v1~v6 评审文档及 git log,
> **不重提已议决项**(周计划 UI、闸门阈值、抗炎分级、真 App、OCR 语言包离线等)。
> 本轮视角:v6 评的是 v0.20.1(部署/构建/资源);此后 v0.21~v0.26 落地了
> 记录反哺四件套、纤维建模、加餐槽、自动化测试体系、频次按次口径与多餐次。
> 本轮聚焦**这批新功能的结构一致性**(尤其 extraMeals 结构键引入后的消费方覆盖),
> 并首次把**测试体系本身**纳入评估。
> 本轮通读:src 全部 29 个源文件、scripts/verify.mjs 全文、测试配置与代表性测试、
> docs 全部 7 篇、dist 构建产物实测。

---

## 1. 总体评价

v0.20.1 → v0.26.0 这六个版本把项目从"功能完整"推进到"功能完整 + 测试巩固":
自动化测试体系(TEST_PLAN 立项 → P1/P2 落地)补齐了评审 v5 实证的 store 层盲区,
verify 从 134 项长到 163 项,单元测试 57 项、E2E 27 场景,`npm test` 四段聚合。
"评审发现 → 修复 → 断言固化 → DECISIONS 登记"的闭环在 v0.20.1~v0.26.0 继续正常运转
(评审 v5/v6 各 4~8 条发现均当天落地)。

本轮新发现 4 条,全部围绕同一主题:**v0.26.0 引入的 extraMeals 结构键,
并非所有"遍历一天内容"的消费方都走到了 `mealLists`**——这正是 planner.js
注释里自己立下的规矩("所有消费方统一走这里"),但有 2 处漏网,另有 1 处
文档承诺与实现脱节。没有高危项,无一影响数据安全。

评分(10 分制,与 v5/v6 同口径):

| 维度 | 评分 | 较 v6 | 说明 |
|---|---|---|---|
| 数据准确性 | 9.2 | 持平 | 锚点+闸门+标签断言三层防护在位,本轮复核红薯/燕麦/食部折算无回退 |
| 逻辑正确性 | 9.1 | -0.2 | 新发现 4 条低中危一致性缺口(F-1~F-4),均不危及数据 |
| 功能完善性 | 9.0 | +0.6 | 纤维/加餐/多餐次/推荐/模板/多样性周报均已落地,缺口均在 DECISIONS 内 |
| 工程质量 | 9.2 | +0.4 | 测试体系落地(v6 时还是缺口);仍无 lint 配置,个人项目可接受 |
| 性能与资源 | 8.8 | +0.8 | Vant 按需后主 chunk 185KB(v6 时 345KB),OCR 空闲释放已落地 |
| 部署与备份健壮性 | 9.0 | +1.2 | v6 的 F-1/F-5/F-6 全部落地并经本轮产物实测复核(详见 §3) |

---

## 2. 新发现

### F-1【代码事实,中】"最近吃过"不过滤打卡跳过的餐,注释承诺未兑现

`src/stores/week.js:97-118` `recentRecipeIds()`:

```js
/** 最近吃过的食谱 id:按天倒序、跨天去重;打卡"跳过"的餐不计(没吃过) */
recentRecipeIds(beforeDate = null) {
  const checkin = useCheckinStore()   // ← 声明后全函数未再使用(grep 确认仅 2 处引用)
  ...
  const lists = [...MEAL_KEYS.map((k) => meals[k]), ...(meals.extraMeals || []).map((e) => e.items)]
  for (const items of lists) { ... }   // ← 不过滤 skip 状态,所有餐一律计入
```

注释明确承诺"打卡'跳过'的餐不计(没吃过)",实现却没有任何 checkin 判定,
`checkin` 变量为死代码。**实际影响面**:该方法只被 AddRecipePopup 的"最近吃过"
chips 消费(生成端 recentIds 契约 v0.16.1 已停用),后果是"计划生成了但实际跳过
没吃"的菜也会出现在"最近"快捷区——语义偏差,无数据风险。严重度给"中"是因为
这是**注释/实现脱节**,比纯逻辑小错更值得警惕:后来者读注释会以为过滤已生效。

- **修复建议**:循环内按 `checkin.statusOf(d, mealKey) === 'skip'` 跳过该餐列表
  (extraMeals 无打卡概念,恒计入);顺手删死变量。改动约 5 行。
- **配套建议**:TEST_PLAN §4 的 store 单测清单未含 `recentRecipeIds`,修复时补
  一条"skip 餐不进最近吃过"单测,否则此类语义仍会只靠注释自保。

### F-2【代码事实,低】`pruneStaleEmptyDays` 不认 extraMeals,"有内容的天永不清理"有例外

`src/stores/week.js:36-49`:治理 180 天前空天时,`hasContent` 只查
`MEAL_KEYS`(breakfast/lunch/dinner/snack):

```js
const hasContent = MEAL_KEYS.some((k) => (meals?.[k] || []).some(Boolean))
```

v0.26.0 后,一天的全部记录可以只存在于动态加餐槽(extraMeals)——这种天会被
判为"空天"删除,直接违反 DECISIONS 登记的"有内容的天永不清理"原则。
触发需"仅加餐槽有内容 + 距今 180 天以上"叠加,短期内概率极低。

- **修复建议**:`hasContent` 改为走 planner 的 `mealLists(meals).some(...)` 或
  追加 `(meals.extraMeals || []).some((e) => e.items.some(Boolean))`,一行;
  week.spec.js 的 prune 用例补一个"远期仅加餐槽有内容 → 保留"断言。

### F-3【代码事实,低】记录页"饮食记录天数/日均"统计不含仅加餐槽的天,与日历点口径不一致

`RecordView.vue` 两处消费方用了两套口径:

- `recordDays`(:461-495)遍历含 extraMeals——仅加餐槽有内容的天**有**日历点、可点看详情;
- `dietStats`(:362)的 `hasItem` 只查 `MEALS`——同一天**不计入**"饮食记录 x/y 天",
  其热量/蛋白/纤维也不进日均。

用户在日历上看到那天有记录点,统计面板却把它漏掉,属于同页内口径自相矛盾。
`dayStatusMap`(日历三色)走的是 `recordDays`,不受影响。

- **修复建议**:`dietStats` 的 hasItem 判定与 `recordDays` 对齐(含 extraMeals);
  `summarizeIntake` 已正确计入动态槽(verify §31 固化),改动只在判定条件一行。
  该逻辑在视图层,E2E 场景可加"仅加餐天计入统计"或用例注释登记。

### F-4【代码事实,低】`assembleMeal` 主食槽频次过滤用入参原值而非餐内累计副本

`src/core/planner.js`:蔬菜/水果槽(:304)与蛋白槽(:326)的 `overLimit` 过滤
都用餐内局部计数 `localCounts`,唯独主食槽(:342)用入参 `foodDayCounts`:

```js
const stapleCand = filterCandidates(...).filter((r) => !overLimit(r, foods, foodDayCounts))
```

v0.26.0 的整天设计是"餐内由 localCounts 承担、三餐间由 generateDayPlan 回写",
主食槽这一行没有享受到餐内累计。**当前不可达**:带 weeklyLimit 的食材
(猪肝/鸡肝/金枪鱼)只出现在蛋白槽食谱,主食食谱不含它们,verify §31 的
天内累计断言走的也是蛋白路径。属潜伏不一致——将来若给主食/蔬菜类食材加
weeklyLimit(或含受限食材的食谱进主食槽),同一天蛋白+主食可双中。

- **修复建议**:`foodDayCounts` → `localCounts`,一字之改,行为在现库下零变化;
  配一条合成池断言(主食槽含受限食材时餐内不重复入选)固住。

---

## 3. 分维度评估

### 架构
- 纯函数内核(core/)→ Pinia 薄 store → 视图的三层结构在 v0.21~v0.26 六轮功能
  迭代中保持稳定,新功能(推荐一餐/模板/多餐次)都正确落在既有分层里:
  `recommendMeals` 复用 `assembleMeal`/`pickScored` 而非另起炉灶,是教科书式的
  内核复用。
- `mealLists` 把"遍历一天全部菜品"收口为唯一入口,方向正确;F-2/F-3 说明
  收口靠自觉、缺强制——建议在 verify 或单测层补消费方断言(见 §2 配套建议)。

### 逻辑正确性
- 复核了 v0.26.0 核心改动(频次按次口径 + 天内两层累计):`assembleMeal` 局部
  副本、`generateDayPlan` 餐间回写、`generateWeekPlan` 跨天回写三层同构,实现与
  DECISIONS 登记口径一致;verify §25/§31 的对照组断言(去掉限值必然复现)证明
  机制有牙,不是恒真摆设。
- 重新生成时被弃旧计划计入 7 天窗口(保守方向)与 DECISIONS 一致,非缺陷。
- 未发现 v5/v6 之外的算法错误;新缺口即 F-1~F-4。

### 数据准确性
- 锚点断言(燕麦 381、红薯 103/C24.7、鸡胸 19.4、牛腩脂肪 29.3、蒜薹 15.4…)
  本轮实测全部在位;153 食材纤维数据有覆盖率断言(谷物/蔬菜/水果 100%、
  动物性禁标),新增食材漏登记会立即红。
- 结构事实(grep 实测):食谱 162 个 = 主食 31 / 蛋白 65 / 蔬菜 44 / 水果 22;
  weeklyLimit 3 条(猪肝 1/鸡肝 1/金枪鱼 2)均有食谱引用(死配置断言在绿)。

### 性能与资源(产物实测)
- dist 主 chunk `index-B8YNntN0.js` **185KB**、主 CSS 72KB(未 gzip;v6 时
  345KB+200KB);4 视图各自独立 chunk(16-38KB),tesseract 独立按需加载。
  v6 F-2 的优化目标达成。
- `dist/index.html` 资源引用全部 `./assets/...` 相对路径(v6 F-1 落地确认),
  `dist/sw.js` 的 CACHE 已被构建脚本重写为 `cookbook-shell-B8YNntN0`,
  与主 chunk 哈希联动(v6 F-6 落地确认)。
- `computeNutrition` 在模板渲染路径逐条调用,数据量小,维持 v6"无优化必要"。

### 测试体系(本轮新评)
- **分层清楚且各司其职**:verify(163 项,纯函数+数据护栏)→ Vitest(57 项,
  store 迁移语义)→ Playwright(26 功能场景 + 1 PWA 冒烟,视图链路)。
  TEST_PLAN 的"只测不修""断言两档制""新功能必带测试"三条纪律是防体系腐烂的
  关键设计,附录用"被否方案+否决原因"的体例与 DECISIONS 一脉相承。
- 测试本身质量高:week.spec.js 用真实食谱构造条目("不硬编码食材 id,数据演进
  不破测试")、E2E 注入带幂等哨兵,都是踩过坑的写法。
- 已知边界均已登记(跨月首日场景 12、OCR 真识别排除出范围),不算隐瞒。
- 两处文档漂移【代码事实,极低】:TEST_PLAN 正文多处写"verify 160 项",
  实际已 163 项(v0.26.0 多餐次新增);verify.mjs 的章节编号缺 §14(13→15 跳号)。
  不影响运行,顺手修正即可。
- 覆盖盲区:F-1 的"skip 不计最近吃过"语义不在任何一层测试里——它正是
  TEST_PLAN §4 清单漏掉 `recentRecipeIds` 的直接后果。

### 安全与隐私
- 维持 v6 结论:无网络请求(OCR 语言包 CDN 除外)、无 v-html、无 eval;
  备份导入有"先清后写 + 确认层 + 类型校验"。纯本地定位下无攻击面。

### 产品层面观察(不排序、不判定,供决策参考)
- v0.21 的"记录路径反哺"(模板/推荐/多样性)与"记录型用户"定位自洽;
  多餐次(v0.26.0)用 extraMeals 零迁移方案落地,代价就是本轮 F-2/F-3 这类
  消费方覆盖问题——属结构性学费,修掉即可。
- 已登记残余维持不变:薯类食部未建模、src 条目号溯源、钠未建模、真 App 缓做
  (判据均在 DECISIONS)。

---

## 4. 优化优先级建议

| 优先级 | 项 | 改动量 | 说明 |
|---|---|---|---|
| 1 | F-1 recentRecipeIds 过滤 skip 餐 | ~5 行 + 1 条单测 | 注释/实现脱节,语义类问题优先 |
| 2 | F-2 prune 认 extraMeals | 1 行 + 1 条单测 | 与"有内容的天永不清理"原则对齐 |
| 3 | F-3 dietStats 对齐 recordDays 口径 | 1 行(+E2E 登记) | 同页口径自相矛盾 |
| 4 | F-4 主食槽过滤改 localCounts | 1 字 + 1 条断言 | 潜伏不一致,现库零行为变化 |
| 5 | TEST_PLAN "160→163" 与 verify §14 跳号 | 文档顺手 | 防文档漂移累积 |

F-1~F-4 均不涉及 DECISIONS 已议决项,可作为"评审 v7 落地"版本收掉
(修复类,建议 v0.26.1)。**本轮未改动任何源码,以上均为待确认方案。**

---

## 5. 评审自身检查

- F-1:`checkin` 在 week.js 中的引用经全文件 grep 确认仅 2 处(import + 声明),
  消费方经 grep 确认仅 AddRecipePopup:104;非凭印象。
- F-2/F-3/F-4 均当场回读源码定位到行(week.js:41、RecordView.vue:362 vs :467、
  planner.js:342),并与相邻代码对照确认非有意设计。
- F-4"当前不可达"的结构依据:weeklyLimit 食材清单(3 条)与其食谱引用槽位
  经 foods.js/recipes.js 回读确认均为蛋白槽。
- verify 本轮实测全绿(163 项);体积与路径结论来自 dist 产物实测,非推断。
- 未重提 DECISIONS 已议决项;未对产品决策排序。

---

*评审人:WorkBuddy;方法:全量源码通读(src 29 文件)+ verify 实测 + 构建产物实测 + 测试配置与代表性测试审读。*
