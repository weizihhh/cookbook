# 自动化测试立项(TEST_PLAN)

> 2026-10-15 立项,两轮澄清共识(11 项决策全部用户拍板)。基线:v0.23.1(commit 932ffb0)。
> 本文档是测试体系的宪法:范围、纪律、维护规则以此处为准;P2 启动时在此追加。

## 1. 定位

项目功能设计已完成,进入测试巩固期。立项目标:**把历史上一事一议的人工测试(IAB 会话)固化为可重复执行的自动化体系**,补齐 store 层与视图层两个已实证的盲区。

### 分层覆盖矩阵

| 层 | 现状(立项前) | 立项后 |
|---|---|---|
| core 纯函数(nutrition/planner/labelScan) | `npm run verify` 160 项 | **保持不动**(数据一致性护栏) |
| data(foods/recipes/tips) | verify 数据一致性断言 | 保持不动 |
| stores(week/checkin/weight/profile/customFoods) | **零自动化**(评审 v5 F-1 即此盲区实证) | Vitest 单测(P1:week;P2:其余 4 个) |
| 视图(4 视图 + 6 弹层组件) | 仅人工 IAB 会话,不可重复 | Playwright E2E |
| PWA(sw/manifest) | verify §26 静态检查 + 人工冒烟 | E2E preview 冒烟(SW 仅 PROD 注册,dev 测不了) |
| OCR 真识别质量 | 人工(语言包 CDN + 识别随机性) | **排除出范围**(labelScan 解析纯函数已在 verify §16) |

## 2. 技术栈与目录

```
test/unit/    Vitest + @pinia/testing + jsdom(store 单测)
test/e2e/     @playwright/test,仅 Chromium,移动视口 375×667(Vant 移动优先)
scripts/verify.mjs  原样保留,不动
```

- `npm test` 聚合:verify → vitest run → playwright test。
- E2E 用 Playwright `webServer` 自动拉起 dev server(5173,跑完自动关,天然规避常驻 dev server 的 transform 旧缓存坑);PWA 专项用 preview(先 build)。
- 数据隔离:Playwright 每测试独立浏览器上下文,与日常浏览器 localStorage 物理隔离;测试数据一律 `addInitScript` 注入,**全程不碰用户真实数据**(废弃历史上的"备份→注入→还原"模式)。
- 失败诊断:保留 trace 与截图。

## 3. P1 场景清单(15 场景,断言档位见 §5)

| # | 场景 | 档位 | 覆盖的历史缺陷出处 |
|---|---|---|---|
| 1 | 首次进入引导态(未配置档案) | 状态 | onboarding |
| 2 | 设置画像 → 目标卡数值(Mifflin-St Jeor 全链) | 精确 | 公式链手算(v0.7.0 验证过) |
| 3 | 生成三餐:槽位填充 + 加餐块渲染 | 状态+数值 | v0.13/v0.23 |
| 4 | 换菜定向:index 指定条目换、其余保留 | 状态 | v0.15.4 换菜错位 |
| 5 | 添加菜品:搜索 → 确认层克数 → 入餐;同食谱累加合并 | 精确 | v0.6.1 累加 |
| 6 | 打卡 done:顶部实际/目标汇总更新 | 精确 | v0.7.0 P2 口径 |
| 7 | 打卡 skip:不计入已吃汇总 | 精确 | 同上 |
| 8 | 清空保护:done 餐确认弹层两分支 | 状态 | v0.14.4 |
| 9 | 重生成保护:保留已吃分支 | 状态+数值 | v0.15.1 |
| 10 | 加餐槽:全库可选、计入全天合计、重生成保留 | 精确 | v0.23.0 |
| 11 | 复制昨日三分支(空餐直拷/追加/覆盖清打卡) | 状态+精确 | v0.15.3 |
| 12 | 记录页:月历渲染、点历史天、统计数值 | 精确 | v0.14/v0.15.0 |
| 13 | 备份导出 → 导入往返(cookbook:* 全 key) | 精确 | v0.15.0/v0.20.2 F-5 |
| 14 | 恢复默认:全清(含 customFoods/模板) | 状态 | v0.8.0 |
| 15 | PWA preview:SW 注册、缓存接管、二次加载命中缓存 | 状态 | v0.20.0 |

留 P2:模板 CRUD、推荐一餐、体重趋势与半动态、纤维行、排除过滤组合、频次约束提示、食谱库/自定义食物管理、营养贴士、宏量预设联动。

## 4. week store 单测清单(P1,13 个迁移类 action)

| action | 断言要点 |
|---|---|
| initState | 旧 plan key 迁移;180 天前空天清理 |
| generateDay | 无保留/keepMealKeys 回填;被生成餐清打卡 |
| clearDayExcept | 保留餐与加餐;清被清餐打卡(skip 防悬挂) |
| swap | index 定向;槽位不符回退;池空回退;snack 拒绝 |
| copyMeal | 追加/覆盖双模式(覆盖清打卡) |
| pushMealItems | 追加/覆盖双模式 |
| saveTemplate | 同餐同名覆盖更新 |
| applyTemplate | 追加/覆盖双模式 |
| deleteTemplate | 删除 |
| removeRecipeEverywhere | 各天餐单+模板联动清;空模板删除;不动种子库 |
| pruneStaleEmptyDays | 写回时 templates 不丢(v0.21.0 修过的隐患) |
| persist | 序列化往返(含 templates) |
| syncWeekOf / mealsOf | 惰性建天边界 |

纯 CRUD(addItem/removeItem/updateGrams 等)由 E2E 场景 5 顺带覆盖,不重复单测。

## 5. 断言深度两档制

- **精确档**:数值链场景(目标卡、汇总、统计、加餐合计、累加克数)注入固定数据,期望值**手算写死**——保留人工测试"手算对照"的价值,防止 E2E 退化为点击器。
- **状态档**:流程场景(弹层开合、导航、确认分支)断言 DOM 存在性/文本/类名/可见性。

## 6. 执行纪律

1. **只测不修**:发现存量 bug 即登记(P1 阻断该场景后续 / P2 不阻断),攒清单一次性交用户拍板;修复属另一轮任务,修完本体系自动成为回归护栏。
2. 测试数据一律注入独立上下文;任何测试不得写用户日常浏览器的 localStorage。
3. 断言档位不得因场景难写而降级(精确档写不了说明测试设计有问题,不是断言太严)。

## 7. P1 验收标准

- `npm test` 一条命令全绿:verify(160)+ vitest + playwright 全部通过。
- PWA preview 冒烟通过(场景 15)。
- bug 清单(如有)已分级交付用户。

## 8. 维护规则(防体系腐烂)

- **新功能合并前必须带测试**:纯函数/数据 → 入 verify 或 unit;用户可见行为 → 入 E2E。无测试的功能视为未完成。
- 后续路线表功能(多餐次、频次天内累计等)落地时同步扩本体系,场景归 P2 目录结构。
- 选择器漂移修复时,同档位断言不得降级。
- 测试体系自身的调整(增删框架、改断言档位)需回本文档登记,与 DECISIONS.md 联动。

## 9. P2/P3(未承诺,P1 验收后另拍)

- P2:全量功能场景(见 §3 留 P2 清单)+ 其余 4 个 store 单测。
- P3 可选:视觉基线截图对比(evaluate 通过 ≠ 视觉正确,v0.15.2 教训)、OCR UI 链路 mock、多浏览器。

## 附:被否方案(含否决原因)

| 被否方案 | 否决原因 |
|---|---|
| 延续 IAB 人工会话测试 | 不可重复执行,每次都是一次性劳动,严格说不算自动化;click 不可靠等属环境缺陷 |
| 续扩 verify.mjs 测 store | 无框架:无隔离、无失败定位、无 watch;160 项已 883 行,再膨胀难维护 |
| Vitest 组件测试替代 E2E | 测不了路由/Pinia/整体链路,历史缺陷多在跨层交互 |
| 边测边修 | 混淆立项执行与修复,违背项目"只测不修→拍板→修"惯例 |
| CI | 单人本地项目,无远端托管诉求,纯成本 |
| OCR 真识别纳入自动化 | 语言包 CDN + 识别质量随机,无法可靠断言;解析纯函数已有覆盖 |
| 全场景精确断言 | 成本翻倍,流程场景精确断言无增量价值 |

## 10. P1 落地记录(2026-10-15,v0.24.0)

**交付:** `npm test` 四段聚合全绿——verify 160 + vitest 31(week store)+ Playwright 功能 E2E 16(场景 8 拆 8a/8b 两分支、13+14 合为一条备份链路)+ PWA 1。

**环境事实(换机重装必读):**
- jsdom 锁 **26**(27 的依赖 @asamuzakjp/css-color CJS 构建 require 纯 ESM 的 @csstools/css-calc,Node 20 不支持 require(esm),上游打包 bug)
- Chromium 下载:官方 CDN 国内不可达(ECONNRESET/超时),需 `PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/ npx playwright install chromium`
- 残留的 vite preview 可能占用 4173(测试前 `netstat -ano | grep 4173` 探查,杀 PID)

**E2E 实现要点(复用时直接套):**
- Vant `#title` 插槽渲染为 cell-group 的**兄弟节点**:餐次卡 body 用"标题节点之后第一个 inset 兄弟"定位(helpers.mealCard),头部/打卡 tag 用标题节点本身(helpers.mealHeader)
- `addInitScript` 每次导航(含应用自行 reload)重跑:注入必须带按调用序号的幂等哨兵(`__e2e_inj_N`,非 cookbook: 前缀不进备份),否则"恢复默认/导入"类 reload 场景被重注入污染
- 应用自行 reload 会把 URL 重载回当前路由、盖掉外部 hash 导航:reload 前在 window 设标记,`waitForFunction` 等标记消失再 goto
- `locator({ hasText })` 无 exact 语义(子串匹配),"添加"会撞"+ 添加菜品"——精确按钮用 `getByRole('button', { name, exact: true })`
- 弹层关闭有 ~300ms 过渡,关闭后立刻做 DOM 计数(toHaveCount)会命中残留节点——可见性断言用 toBeVisible/toBeHidden 自动过滤

**已知测试边界:**
- 场景 12"点昨天"假设昨天在当前显示月,跨月首日(每月 1 号)跑会失败——届时先修该步或跳过

**P1 期发现 bug 清单(只测不修,待用户拍板):**
- ~~**B-1(体验级)**:恢复默认后页面 reload 回 /#/profile,ProfileView 自动保存 watch 立即触发 `profile.update()`,configured 被写回 true → 引导态不再出现(数据确已全清,无数据风险)。backup.spec 相应断言已移到 localStorage 层;修复后应恢复引导态 UI 断言。~~
  **已修复(v0.24.1,2026-10-15)**:自动保存 watch 加 `profile.isConfigured` guard——未配置档案时不自动保存,`configured: true` 的唯一入口是显式点"保存设置"(新用户首次需点一次保存,换取"恢复默认→引导态"语义正确)。backup.spec 已恢复引导态 UI 断言,另增场景 2b(已配置用户改体重不点保存切页仍生效,75kg→1939 千卡)守护 v0.16.3 自动保存语义不回归。

## 11. P2 落地记录(2026-10-15,v0.25.0)

**交付:** `npm test` 全绿——verify 160 + unit 57(+26:checkin/weight/profile/customFoods 四个 store 全量)+ 功能 E2E 26(+9:场景 16-24)+ PWA 1。P2 期未发现新的应用缺陷。

**场景 16-24:** 模板 UI 全链路(存/套/删)、推荐一餐(入口区间→候选→采纳写入晚餐→入口消失)、体重趋势+半动态(74kg 均值→1927 千卡+设置页说明)、纤维行(全麦面包片 4.2g/还差 21g)、排除过滤(勾麸质生成无麸质)、频次提示(猪肝达上限红字不阻断)、食谱库+自定义食物全链路(增改删→加餐引用联动清理)、贴士折叠(v0.7.0 P1 bug 回归护栏)+每日一读、模式→预设→目标三层联动(增肌 1.8g/kg + 预览 126g)。

**P2 期 E2E 新增经验:**
- Vant4 tab 标题 class 是 `.van-tab`(无 `.van-tabs__tab`),role 定位 `getByRole('tab')` 最稳
- picker 选项 class 是 `.van-picker-column__item`(双下划线);picker 有默认确认栏
- readonly van-field(模式/预设/活动量)点击 `.van-field__label` 冒泡触发比点 field 根稳
- 设置页同名 cell(营养细节"蛋白质"vs 预览区"蛋白质")用 `.first()` 消歧,页面区块顺序:身体数据→目标→营养细节→偏好→预览
