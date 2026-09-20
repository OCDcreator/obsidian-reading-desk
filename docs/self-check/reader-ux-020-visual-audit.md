# Reader UX 0.2.0 实机视觉验收

日期：2026-09-20。构建：`0.2.0+2026-09-20T11:0x` 系列（多次部署，最终四件套 SHA 与 Test Vault 一致）。宿主：macOS Obsidian 1.13.7 `testvault`,真实 Electron surface,CDP 采集。

## 验收方法

- 每张截图前先证明表面就绪:可见 reader 根、当前页 host 非占位且文本层 span 数 > 0;连续滚动帧另断言 ≥2 个已绘制页;暗色帧断言 `data-rd-pdf-invert='on'`;窄幅帧断言 `canvasW ≤ stageW + 4` 且工具栏 `scrollWidth ≤ clientWidth`。
- 两个独立视觉评审代理逐张目测(第一轮发现缺陷→修复→第二轮复核),另有两张关键帧由主代理用图像工具定向复核。
- 机械检测:`impeccable detect --json assets/styles.css src/ui/search/ReaderSearchPanel.ts src/reader/ReaderToolbar.ts src/reader/ReaderPageControl.ts` → `[]`。

## 第一轮发现与修复

| 缺陷 | 根因 | 修复 |
|---|---|---|
| 连续 deck 恰好只画一页(截图空白) | `PdfRenderer.activeRenderTask` 单槽:第 2 页渲染取消第 1 页任务 | 改为按页 Map 跟踪;generation 只随文档开关失效,不再每次渲染自增 |
| 缩放后页宽不更新(窄幅 64% 仍溢出 1160px) | deck `pageWidth` 缓存了首次(当时缩放)宽度;`requestRender` 跳过已渲染页 | 以 scale=1 测自然宽;`relayoutPending` 纪元失效 + 显式重请求可见窗口;`render()` 等当前页绘制完成 |
| 窄幅工具栏裁切(缩放组无溢出收纳) | 新缩放组未挂 `data-rd-overflow` | 整组 `secondary` 溢出 + 更多菜单补 缩小/放大 |
| 梅紫渲成青色 | plum/indigo 与 canvas-color-5/6 对调 | plum→color-6(purple)、indigo→color-5(teal),实机色值 rgb(120,82,238)/rgb(0,191,188) 证实 |
| 搜索结果行高 0(状态有计数但无行) | 搜索面板挂在 root grid,抢占 `minmax(0,1fr)` 行 | root 三行模板 `auto auto 1fr` + 常驻 `.rd-reader-aux` 行承载面板 |

## 第二轮(最终)结果

| 场景 | 证据 | 结论 |
|---|---|---|
| 01 浅色宽幅 | `01-light-wide.png`,文字清晰、色盘五色正确 | PASS |
| 02 连续滚动分界 | `02-light-deck-scrolled.png`(化学书第 12/13 页连排,分界清晰,无灰带) | PASS |
| 03 全文搜索 | `03-light-search.png`(6 行结果、第 N 页前缀、首行选中态;DOM list 高度 200px) | PASS |
| 04 高亮抽屉 | `04-light-drawer.png`(梅紫=purple 修正,锚定工具栏下方) | PASS |
| 05 暗色反相 | `05-dark-invert.png`(纸面反相、外壳不反相、高亮可读;原生窗框浅色系 CDP 强制主题的采集伪影,非插件缺陷) | PASS |
| 06 窄幅 414px | `06-light-narrow.png`(canvas 382==stage 382 适宽、工具栏收纳无裁切) | PASS |

## 遗留(非阻断)

- 窄幅下评论气泡图标 24px 固定,相对小页面对文字遮挡比例偏大(P2,后续可随缩放缩放)。
- 页间距灰带为设计文档允许的纸面投影(`0 8px 22px`),保留。
- `app.setTheme` 在该宿主上不更新 body 类;暗色采集用 body 类注入,只影响验收方式。

## 设置直达与分标签（追加验收）

- 阅读器工具栏新增「设置」按钮（齿轮图标，secondary 溢出，窄幅收入更多工具）；书架操作区同步新增。命令面板新增「打开 Reading Desk 设置」。
- 设置页重构为五个标签：书库 / 阅读 / 存储与图床 / AI 集成 / 数据与迁移；活动标签持久化于 localStorage，支持左右方向键切换（aria tablist/tab/tabpanel 语义完整）。
- 新增「阅读」标签承载滚动模式与夜间纸面反相设置（复用 viewer 设置持久化）。
- 实机验收：点击工具栏按钮打开 Obsidian 1.13.7 独立设置窗口并直达 Reading Desk 页（目标 "设置 - testvault"）；五标签结构断言通过，书库/阅读/存储与图床/数据与迁移四张截图存于 .obsidian-debug/reader-ux-020/07-*.png，工具栏带设置按钮见 08-toolbar-settings.png，图像核验通过。

## 设置页 shadcn 风格重构(追加验收)

- 布局改为左侧竖向分类导航(粘性,176px)+ 右侧内容区;窄于 640px 折叠为顶部横向标签栏。
- 设置组卡片化:1px 边线、8px 圆角,卡片头部为标题 + muted 描述,行为细分隔线布局(标签/描述居左,控件居右)。
- 输入/下拉统一 30px 高、6px 圆角、细边线;焦点 accent 轮廓。存储标签拆为「Markdown 图床」「对象存储凭据」两张卡。
- 实机验收:.obsidian-debug/reader-ux-020/07-settings-{library,reader,storage,data}.png;存储与书库两帧经图像工具核验:导航高亮、卡片结构、行布局、控件一致性均通过,整体评价为 shadcn 风格成立。

## 设置页 impeccable 评审与修复(追加)

- 机械检测首轮 6 条 advisory(6/8px 圆角、13px 字号偏离刻度):字号统一回到 14px 主档;6/8px 圆角作为 shadcn 变体登记进 DESIGN.md(card/control-lg),复检 0 发现。
- 设计评审子代理(评估 A)要点落地:数据标签重复标题移除(ImportExportPanel 不再自带 h3);Region 行按提供商条件渲染 + Endpoint/Bucket/路径占位符;测试连接结果着色(success/error);设置入口带上下文标签(阅读器→阅读,书架→书库,命令→上次标签);导语精简;文件夹输入全宽。
- 陈旧 DOM 教训:重载后设置窗口若未关闭会保留旧渲染;本轮采集先关闭残留设置窗口再重开,探针断言 nav 竖排、卡片存在、上下文标签生效、重复标题为 0 后才截图;640px 折叠断点因设置窗口内容区仅 611px 误触发,降到 480px。
- 最终五张截图(含 AI 标签)经中性提示词图像核验:竖向导航、卡片+发丝行、占位符、Region 条件行全部符合,无重复/重叠/裁切。

## 设置导航回横排（用户裁定，追加）

- 竖向导航按用户要求回退为横排标签；导航栏自身置于一张独立 rd-card（8px 圆角、1px 边线）中，与内容卡片分离。
- 键盘导航简化为左右方向键；移除 settings 容器查询断点（横排不再需要折叠）。
- 探针断言：navCard 存在且包含 nav、flexDirection=row、五标签、上下文标签（阅读）生效、重复标题 0；五张截图重拍，中性提示词核验通过。
- impeccable detect 复检 0 发现。

## 「页边锚点」原创入口图标(追加验收)

- src/ui/icons/ReadingDeskIcons.ts:日间版描边 8、夜间版 7(光学补偿),几何一致;页轮廓/折角/摘录线 currentColor,页边线 var(--interactive-accent),锚点 var(--canvas-color-1),宿主变量全局作用于 ribbon,深浅主题自动取值。
- main.ts:addIcon 注册两个 id,ribbon 从 book-open 换为 reading-desk-margin-day;css-change + body 类 MutationObserver 双通道同步日/夜版本。
- 实机探针:浅色 anchorFill rgb(233,49,71)/描边 8,深色 rgb(251,70,76)/描边 7,主题翻转即时切换;4 倍放大截图 09-ribbon-icon-{light,dark}.png 经中性核验:页/边线/锚点/摘录线四语义齐全、三色分明、笔画清晰。
- 单测 4 项(语义片段、8/7 补偿、id 映射、主题探测)随套件通过(46 文件/151 用例)。

## 用户反馈修复:侧栏重复导航与设置页图标(追加)

- 根因:反复 reload 期间 openPdfNavigation 找不到既有 leaf 时新建,旧 leaf 残留,左侧栏堆积多个「PDF 导航」空态面板(用户截图证实约 6 个)。修复:每次打开导航时 detach 除保留 leaf 外的全部同型 leaf(detachDuplicateNavigationLeaves);重载后实测 nav leaves=1,存量已清。
- 「页边锚点」图标补进设置界面:标题行左置 22px 彩色图标(与 ribbon 同源,宿主主题双通道同步),10-settings-heading-icon.png 经中性核验:图标语义齐全、颜色正确、比例协调,无布局缺陷。
- 命令直达与设置窗口陈旧 DOM 的注意事项已在本文件先前小节记录,本轮验证沿用了先关旧窗再开新的流程。

## 标题行垂直对齐修复(追加)

- 用户指出标题与图标垂直错位(图标偏上约 20%):根因是宿主给 h2 的默认 margin 不参与 flex 垂直居中。修复为 h2 margin 置零、由标题行接管下方间距,图标 svg 改块级显示。
- 实测几何:图标中心 90.5px == 文字中心 90.5px,偏移 0px;截图 11-heading-aligned.png 中性核验确认对齐、比例协调。
