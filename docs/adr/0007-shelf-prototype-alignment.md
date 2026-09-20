# ADR 0007:书架对齐原型稿(A 紧凑研究书架 + B 分类导航工作台 + C 书目台账)

状态:Proposed(2026-09-20 grilling 会话产出;同日依 `reading-desk-bookshelf-prototype.md` 契约与 html-a/b/c 原型修订,用户裁决 B、C 均纳入本轮;待实施后改 Accepted)

## 背景

书架卡片视图被评价为"太素、没有感觉",希望向 PDF Flow(配套 PDF eBookshelf)靠拢。经 grilling 会话逐题裁决,并以 `docs/prototypes/` 的原型全集为形态权威:

- `reading-desk-bookshelf-gimg-v1.png`(+ `.prompt.md`):高保真目标图,确认整体观感与密度。
- `reading-desk-bookshelf-prototype.html`(+ `-a/-b/-c.png`,`prototype.md`):三结构变体与**前端样式契约**。
- 结构裁决(用户 2026-09-20 确认):**卡片视图=A;表格视图=C 结构目标;B 也纳入本轮**作为第三种书架布局(暴露方式见「未决问题」;prototype.md 原推荐"B 暂不默认",以用户现场裁决为准)。

靠拢对象是 PDF Flow 的**信息架构**(封面主导、作者可修补、页数+大小+底部细进度、分类筛选),不是它的视觉外壳(圆角、卡片投影、底部遮罩叠字)。形态语言维持研究仪器风:方正、1px 宿主边线、无装饰阴影。

## 决策

### 布局壳(A)
1. 外层 `24px` padding,内容最大宽度约 `1368px` 居中(现状无上限,新增)。
2. 页头:大标题「书架」(25px)+ 副文案「原文、摘录与进度在同一处」+ 右侧控件「扫描书库」(primary:accent 边+低比混色底)、「导入」(对接现有 portability)、icon 更多。
3. 工具栏:搜索框(约 440px,占位「搜索书名、作者或标签」)+「卡片/表格」分段切换(选中态 elevated 底)。
4. 继续阅读区:标题行(「继续阅读」20px + muted 副语)+ **三张横排紧凑卡**:左 88px 封面(min-height 118px)+ 右侧书名/作者/进度,不含分类编辑器;容器 `repeat(3, minmax(0,1fr))`,窄屏降两列。
5. 分类筛选区:单行可换行 chips(「全部 N」带数量);选中态 accent 边线+focus outline,不用高饱和填充。
6. 主区:标题行(「全部图书」20px + 「N 本 · 按 X 排序」)+ 五列封面墙(生产维持 `repeat(auto-fill, minmax(184px,1fr))`)。

### 卡片(A)
7. 「封面满宽 + 下方信息区」分区卡:方正(0–2px 圆角)、1px 宿主边线、raised 底、**卡面无投影**;**功能性阴影只给封面纸面**(约 `0 8px 22px` 26% 黑,与 PDF 页纸面同语言)。
8. 封面 `aspect-ratio: 0.7` 满宽;一律 PDF 第一页渲染(现状已然),EPUB 取 OPF 封面,极端无图排印纸面兜底。
9. 信息区固定槽(等高由槽保证,非拉伸):书名两行 line-clamp(16px,槽位 `min-height: 2.6em`)、作者单行 ellipsis、页数+大小一行 muted(12px,lucide 图标)、3px 进度条+右端常显百分比(12px tabular-nums)。完整书名走 title 提示、表格视图、阅读器标题。
10. 状态:**hover=边线加深**(line→line-strong);**focus=2px accent outline**;选中沿用现有 accent 边线+低比混色。
11. 分类角标:封面左上(约 10px 偏移)小 pill,11px 字,半透明深底白字、白 34% 边,只读。

### 交互
12. 作者行点击就地编辑(占位「点击添加作者信息」,accent 虚线下划线)。
13. 分类:筛选=chips 行;管理=chips 行尾「+」新建 + chip 右键(重排/改名/删除);卡内常驻 select 移除。
14. 「全部图书」副文案可点击切换排序:最近阅读(默认;有记录按时间倒序在前,未读按书名在后)/ 书名;记忆到 localStorage。
15. 「管理分类」「查看阅读记录」两个 section-link 的取舍见「未决问题」。

### 表格视图(C,已确认纳入本轮)
16. 目标结构:顶部统计摘要 4 格(全部 N 本 / 正在读 M 本 / 摘录 X 条 / 平均进度 Y%——数据源 LibraryIndex + AnnotationStore.listAll);台账表列:书名(42px 小封面+标题+路径 ellipsis)、作者、分类 pill、评分、进度(3px+百分比)、页数、大小;评分/标签就地编辑保留。

### 分类导航工作台(B,已确认纳入本轮)
17. 左侧常驻分类导航列(sticky,列表+数量,选中态 inset 2px accent)+ 搜索与扫描;主区「最近阅读」重点卡(约 172px 封面 + 书名/摘要语/「上次读到第 N 页」/进度)+ 四列紧凑网格。
18. B 复用同一书卡组件与数据路径,不另建第二套卡片语言。

### 与生产代码的边界(用户说明稿 2026-09-20)
19. 生产实现使用 Obsidian CSS 变量,不写死原型深色值;GIMG 仅取封面质感与完成度参照,不照抄不确定细节。
20. 不把 prototype HTML 复制进生产代码;依据现有 ShelfView/ShelfViewModel/styles.css 架构重实现;不动与书架无关的模块。
21. 「导入」按钮经设置直达(数据与迁移 tab,带上下文标签)接入现有 portability,避免向已达 648/650 行的 main.ts 加回调。
22. 分类角标 11px 字号走宿主 `--font-ui-smaller`(缩略图徽章先例),登记进 DESIGN.md。

## 后果

- DESIGN.md 改写:「卡片不是营销式的固定等高网格」→「固定信息槽的内容驱动等高卡」;Shelf Cards 组件段重写;Layout 书架段补 1368px 容器/chips 行/继续阅读横卡/排序切换;进度条说明补右端常显百分比。
- LibraryIndex 排序移到视图层(最近阅读/书名),数据层不存排序状态。
- 表格视图(C)与分类工作台(B)纳入本轮:ShelfView.ts 现 579 行、main.ts 已 648/650,重实现必须拆分为 `src/views/shelf/` 下的协作模块(卡片/继续阅读轨/chips 行/台账/分类导航/排序/分类管理面板),ShelfView 收敛为编排层;新增文件需同步登记 module docs(check:project-docs)。
- 「查看阅读记录」筛选态与三态布局切换是新的视图状态,与现有搜索/分类筛选的组合行为需在 ShelfViewModel 明确优先级并测试。
- 新交互面(chips 管理、作者就地编辑、三态切换、分类管理面板)需键盘可达与中文空态;宿主按钮穿透按既有清单处理(host 作用域清 background/border/box-shadow)。

### 暴露方式与 section 链接(2026-09-20 用户裁决)
23. 工具栏视图切换扩为三态「卡片 | 台账 | 导航」(A/C/B),记忆选择,默认卡片;与原「卡片|表格」同一控件位,不新增入口。
24. 原型 A 的两个 section 链接**保留在原型位置**:「管理分类」(全部图书标题行右侧)打开集中式分类管理面板(modal,列表式重排/改名/删除,与 chip 右键同能力、同一套 LibraryIndex 写路径);「查看阅读记录」(继续阅读标题行右侧)做成筛选态——主列表切换为「仅含阅读记录的书 + 最近阅读排序」,不新建阅读历史后端,历史事件流留作未来增量。

## 参考

- 原型:`docs/prototypes/reading-desk-bookshelf-prototype.html`、`reading-desk-bookshelf-prototype.md`(样式契约)、`reading-desk-bookshelf-html-a/-b/-c.png`、`reading-desk-bookshelf-gimg-v1.png`(+`.prompt.md`)、`reading-desk-bookshelf-contact-sheet.png`
- PDF Flow 书架观察:`docs/self-check/reference-a.md`、`reference-b.md`
- 过程稿(双变体对比,已被原型稿取代):`docs/prototypes/shelf-pdf-flow-alignment-mockup-v1.html`
