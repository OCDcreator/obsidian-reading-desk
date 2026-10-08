# Reading Desk 升级蓝图（豆瓣元数据与书库增强）

> 日期：2026-10-07 ｜ 状态：方案定稿，4 项待确认决策标注于 §5（由下一会话开局确认后实施）
> 背景：基于全库代码摸底（v0.5.1 工作树）+ 外部调研（市场报告在 `C:\Users\lt\ZCodeProject\.research-bookshelf\`，豆瓣取数事实与三项目组件规格拆解已完成）。
> 本报告取代"obsidian-bookshelf 升级"那条线（那是误做在另一仓库的产物，与本插件无关）。

---

## 1. 现状结论：哪些不用做

书架侧以下能力**已存在，勿重复立项**（摸底证据）：

| 能力 | 位置 |
|---|---|
| 批量选择+批量编辑（标签/列表/分类/状态，跨页保留，摘要+失败重试） | `ShelfView.ts:152,187-206`、`ShelfBatchEditor.ts`、`LibraryIndex.batchUpdate` |
| 浏览状态持久化（mode/page/9 维筛选，500ms 合并保存+消毒） | `ShelfStatePersistence.ts`（ADR 0012） |
| 继续阅读横轨（3 张卡+「查看阅读记录」筛选态） | `ContinueReadingRail.ts` ⚠️ ADR 0012 写"最多六张"而代码 limit=3，需对齐 |
| 筛选/排序/搜索（含 IME 保护、全库摘录检索） | `ShelfQuery.ts`、`ShelfFilters.ts`、`ShelfAnnotationSearch.ts` |
| 封面（PDF 首页渲染 + EPUB OPF + 占位兜底 + 重试） | `MetadataExtractor.ts`、`BookCard.ts:28-35` |
| 真实阅读进度（0 基页+视口偏移，400ms/1.2s 双层去抖） | `ReaderPersistenceController.ts`、`ProgressFlusher.ts` |
| 人工覆盖/自动值分离、缺源重关联、回收站、快照恢复 | ADR 0011、`LibraryIndex.relink`、`AnnotationStore` |

**真实缺口**（按价值排序）：

1. **豆瓣/在线元数据源：完全没有**——`MetadataExtractor` 仅读文件内嵌数据（PDF Info/EPUB OPF），无任何网络获取层。
2. **导入/入库自动丰富：没有**——`source.isbn/doi` 只存身份证据从不查询；且 ADR 0011:40 明确"不用 DOI、ISBN、标题或文件名自动合并实体"，**自动丰富与它有语义冲突，须新 ADR 裁决**（解法建议见 §3）。
3. **书卡/台账行右键菜单：没有**——打开、显示原文件、移出分类等只能走内联编辑或批量面板。
4. **丛书/系列（series）：没有**——`LibraryBook` 无 series 字段，分组仅 category/list 两轴。
5. **Bases/Dataview 桥：没有**——对外只有一次性导出 Markdown/JSON（`main.ts:152-153,559-566`）。
6. **i18n：没有**——UI 字符串全部硬编码中文。
7. 附带：EPUB 无阅读器（只入库/封面/元数据）；排序仅 5 种；书架无统计图表；`BibliographicSource.provider` 枚举需扩展（`contracts.ts:11`）。

## 2. 实施硬约束（本仓库既定文化，必须遵守）

- **新 ADR 从 0017 起**（0015 已跳号，勿回填）；书架形态权威 = ADR 0007 + `docs/prototypes/`；改视觉须过 DESIGN.md 登记 + `ShelfStyles.test.ts` 契约 + CDP 实机自检证据
- `src/main.ts` 648/650 行、`ReaderView.ts` 646/650——**任何加线必须拆新模块**（owner guard 硬门禁）
- 书库数据面改动只能进 `LibraryIndex`（唯一写入口、单队列、单 commit）
- `assets/styles.css` → 根 `styles.css` 字节同步是 verify 门禁；`npm run verify` 七步全绿是合入底线
- ⚠️ **Windows 工作树有未提交 WIP**（评论浮层重设计+TagCombobox、封面 hiDPI/写入路径修复、导航幽灵 reader 修复，附实机证据）——Mac 侧不可见；本报告不依赖它，但豆瓣阶段动 `MetadataExtractor.ts` 前需先在 Windows 收尾提交避免冲突

## 3. 豆瓣路线与 ADR 0011 冲突的解法建议

**技术事实**（2026-10-07 核实，可直接使用）：

- 搜索：`book.douban.com/j/subject_suggest?q=`（轻量 JSON：id/title/url/封面/作者/年份）**当日实测可用**；详情：`book.douban.com/subject/{id}/` HTML 解析（JSON-LD/og meta 双通道降低改版敏感度）。未登录可取全字段：书名/作者/译者/出版社/出版年/页数/ISBN/丛书/评分/简介/封面
- 封面下载注入 `Referer: 条目页 URL` 绕防盗链；Chrome UA 即可，无需 Cookie
- 频控：请求间隔随机 4-8s、串行队列；403 触发当日熔断（同业经验：wanxp 同步链路超 200 条降 10-15s；2025-26 失效报告集中在频控与封面 URL，未见改版性解析失效）
- **GPL 红线**：wanxp/obsidian-douban 为 GPL-3.0，**一行代码不抄**，只参考端点与思路；本仓库发布前建议定 MIT

**与 ADR 0011 的调和**（新 ADR 0017 的核心论点，待确认）：

ADR 0011 禁止的是**实体合并**（凭 DOI/ISBN/文件名把两条书目记录合成一条——破坏用户显式建立的身份数据）。而自动丰富是**对既有单本书的字段级补全**：只写空白（title/author 为空或明显是文件名启发值时）、绝不触碰 `metadataOverrides`（人工覆盖优先的现有三层模型天然支持）、绝不改写 `source` 身份字段、不合并记录。两者可共存：**"不自动合并实体，允许字段级补全+低置信待确认"**。

## 4. 借鉴清单（大瘦身版）

外部组件规格速查表（Kavita/Koodo/Grimmory 卡片解剖、进度条、批量交互参数）在 `C:\Users\lt\ZCodeProject\.research-bookshelf\` 报告中，Mac 侧同步后按需取用。本轮真正要借的：

| 借什么 | 从谁 | 落点 |
|---|---|---|
| series 字段与丛书分组展示 | Kavita 系列卡 / Grimmory 系列 nav | P2：`LibraryBook` 加 `series/seriesIndex`，B 导航侧栏分组 |
| 书卡右键菜单项构成 | Grimmory contextmenu / Koodo ActionDialog | P2：打开/在文件管理器显示/重刮削/移出分类/加入列表/标记状态 |
| 入库自动刮削队列思想 | CWA 自动 ingest | P1：扫描/导入后进刮削队列 |
| 置信度与待确认流 | —（自设计） | P1：ISBN 命中=高；标题+作者全等=高；仅标题模糊=中低→`needsReview` |
| 确定性彩色书脊兜底 | dsebastien Bookshelf Base | 远期（现有排印占位保留） |
| 格式色带无封面占位 | Koodo EmptyCover | 远期 |

## 5. 决策表

**已定**（沿用前一轮用户拍板，目标无关）：

| 决策 | 结论 |
|---|---|
| 豆瓣路线 | 非登录公开接口 Provider，无 cookie 依赖；熔断降级（降级后仅文件内元数据，不引 Google Books——本插件场景中文书为主，多源可后加） |
| 自动补全信任策略 | 只补空白不覆盖手填；低置信标 `needsReview` 徽标；"全部进审核"做成设置项 |
| 发布姿态 | 按可发布标准：i18n 抽层（zh-CN 源+en-US）、manifest author 补全、发布前定 MIT |
| 性能目标 | 2000 本：现有 40/页分页+lazy 已够，不引虚拟化 |
| 视觉 | 不动 A/B/C 形态（ADR 0007 为准），新元素沿用 `--rd-*` host-first 体系 |
| 排期 | 价值优先：P1 豆瓣（外部风险最高先验证）→ P2 右键+series → P3 Bases 桥 → P4 i18n |

**待确认 4 项**（下一会话开局问用户，推荐已给）：

| # | 问题 | 推荐 |
|---|---|---|
| D1 | ADR 0017 是否按 §3 调和方案落地（允许字段级补全，禁止实体合并） | 是 |
| D2 | 评分映射：豆瓣 10 分制直接存（现库 rating 0-10 恰好兼容）还是÷2 存 5 星 | 直接存 10 分制（零转换） |
| D3 | Bases 桥形态：单向"桥接笔记"生成器（默认关）vs 仅增强现有导出 | 桥接笔记（Bases 可查询，frontmatter 单向投影，正文不覆盖） |
| D4 | 豆瓣刮削的触发面：仅手动（卡片/右键/批量）+ 新书自动，还是含存量全库批量 | 手动+新书自动先行；存量批量作为批量面板里的一个动作 |

## 6. 实施路线图

- **P1 豆瓣 Provider + 自动丰富**（核心差异化）
  新建 `src/library/metadata/`（或按 owner-guard 习惯拆）：`DoubanClient`（suggest 搜索+条目页解析+封面下载带 Referer）、`MetadataEnricher`（置信度、只补空白、队列随机间隔 4-8s、403 当日熔断）、`LibraryIndex.enrichBook/enrichBatch` 扩展 + `needsReview` 状态字段；设置页新增刮削开关与审核模式；ADR 0017 落盘。
  验收：ISBN 命中/标题命中/降级三条路径单测（mock HTTP）+ 真实刮 10 本中文书 CDP 自检 + `npm run verify` 全绿。
- **P2 书卡右键菜单 + series**
  `BookCard`/`ShelfLedgerRow` contextmenu（Obsidian Menu API，含"重新刮削"入口）；`LibraryBook` 加 `series/seriesIndex`（豆瓣丛书映射）；B 导航按系列分组；顺手对齐 rail limit 3↔6 文档代码不一致；排序加"加入日期"。
- **P3 Bases/Dataview 桥**（按 D3 确认结果）
- **P4 i18n 抽层**（zh-CN 源 + en-US 全量，键表进 `src/i18n/`，新 ADR 登记）
- **远期池**：EPUB 阅读器、统计图表、彩色书脊兜底、Google Books 第二源、万本级虚拟化

## 7. Windows 工作树 WIP 备忘

未提交两批工作（详见摸底）：(a) 评论浮层重设计+TagCombobox（含 CDP 证据与测试）；(b) 桌面 QA 修复（封面 hiDPI 清晰度、封面写入 `adapter.exists()` 修复、导航幽灵 reader、书架 padding 契约）。**建议 Windows 下次会话先收尾提交这批，再开始 P1**（P1 会动 `MetadataExtractor.ts` 周边）。

## 8. 参考

- 市场调研：`C:\Users\lt\ZCodeProject\.research-bookshelf\`（README 总览 + 01/02/03 分报告，含组件规格速查表与豆瓣事实）
- 本仓库：`docs/research/reading-desk-enhancement-review-2026-10-02.md`（既有 P0/P1/P2 增强官方清单，实施前对照重叠）、ADR 0007/0011/0012、`enhancement-modules.md`

---

## 9. P1 交付状态（2026-10-08，Mac）

D1–D4 按推荐值确认（字段级补全调和 / 评分 10 分制直存 / 桥接笔记默认关 / 手动+新书自动）。P1 已完成并部署 testvault：

- 新模块：`src/library/metadata/DoubanClient.ts`（transport 注入，suggest + 条目页 JSON-LD/#info 双通道 + Referer 封面）、`MetadataEnricher.ts`（置信度、串行 4–8s、403 当日熔断持久化）、`src/host/DoubanRequestTransport.ts`（requestUrl 适配）、`src/host/VaultFiles.ts`（main.ts 瘦身抽取，644/650）。
- 数据面：`LibraryIndex.enrichBooks` 单次提交；`applyEnrichment` 只补空白；`needsReview`/`enrichment` 记录/豆瓣 `source` 证据；`metadataEnrichment` 设置（启用/自动/全审核/熔断）；**附带修复 `bookCheck` rating 0–5 → 0–10 的潜在生产 bug**（此前 >5 分评分会被 Repository 校验拒写）。
- UI：设置页书库 tab「豆瓣元数据」卡（三开关 + 手动批量刮削 + 熔断状态）；书卡封面右上「待确认」角标（DESIGN.md 已登记 `review-badge-bg`）。
- 文档：ADR 0017、`docs/enhancement-modules.md` 模块表、PRODUCT.md 能力条目。
- 验证：`npm run verify` 七步全绿（111 文件 625 测试，新增 21 条）；CDP 实机：10 本中文书真实刮削全部高置信命中（作者/评分/ISBN/封面落盘核对通过），review-all 重刮路径产出「待确认」角标 DOM+截图证据，插件重载启动标识新鲜无错误。证据：`.obsidian-debug/douban-enrichment-acceptance.json`、`douban-shelf-after-enrich.png`、`probe-douban-*.mjs`。
- 注意：P1 未动 `MetadataExtractor.ts`，Windows WIP（封面写入修复若在 `main.ts writeBinary`）与 VaultFiles 抽取可能有小冲突，合并时以 VaultFiles 版本为准平移修复逻辑。
