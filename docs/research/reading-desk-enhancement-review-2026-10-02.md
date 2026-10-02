# Reading Desk 增强与优化调研 — 2026-10-02

> 最终调研报告：3 个子代理先并行研究同类开源项目，再分别审计前端、PDF 阅读器和书库；主代理复核源码、Mac 实机与独立复现。本轮只做分析，没有实现建议中的功能。

结论：当前基础能力已经较完整，下一步先保护标注与手写内容、处理保存和跨设备旧快照边界，同时核验摘录/裁剪坐标；随后改善搜索正确性、回链定位与首屏效率。新增功能优先考虑完整备份恢复、全库摘录检索和批量组织，文献来源适配与 PDF 内链预览分阶段推进。

优先级：P0 为数据保护或文字/坐标正确性，应先修复或用定向用例核验；P1 为现有功能的完整性与阅读效率；P2 为新增工作流和规模化优化。静态风险表示源码中存在待验证边界，不表示用户数据已经损坏。

## 范围与证据

- 基线：`main` / `ef3f9d9577cf9689fd677efbdd7627bbcaed0967`，插件版本 `0.3.0`。
- 方法：先并行调研同类开源项目的一手资料，再对照本项目源码与设计约束，最后按用户收益、数据风险和实现依赖排序。
- 实机：通过 SSH 与 CDP 检查 Mac `testvault` 中本次构建。书架和阅读器截图来自当前运行实例，窗口为 1452×950 CSS px，第三方浅色主题，左右宿主侧栏展开。
- 限制：当前截图只证明该布局/主题状态；不据此宣称所有主题、暗色、高DPI、键盘或大文件性能均已验收。`settings.png` 未捕获到设置内容，不能作为设置页面的视觉证据。
- 证据文件：`.obsidian-debug/review-20261002/runtime-surfaces.json`、`shelf-plugin.png`、`reader-plugin.png`、`markdown-adapter-repro.json`、`persistence-repro.json`。
- 独立复现仅使用合成字符串与内存 DataSink，没有修改用户笔记或标注数据。

## 已有能力，避免重复建设

当前已经实现连续滚动与单页模式、可见页窗口渲染、Retina 渲染、全文搜索、翻页/缩放/适配快捷键、跳转历史、夜间纸面反相、目录/缩略图导航、当前章节跟随、局部标注刷新、复制页面与高亮链接、上一条摘录撤销、裁剪、Canvas/Excalidraw/Markdown 原生目标、标签/评论、分类/评分、继续阅读、书架卡片/表格、旧 Bookshelf 非破坏导入与书库 Markdown/JSON 导出。

`LibraryIndex`、`AnnotationStore`、`TargetService` 的职责和归一化 PDF `rects[]` 坐标必须保留。建议中的备份、外部导入与全库检索围绕这些真源建立，不另建可编辑的第二套标注数据库。AI 与对象存储继续作为可选能力，不阻塞本地阅读。

## 外部开源对标

| 对标对象 | 一手证据确认的价值 | 对本项目的取舍 |
| --- | --- | --- |
| PDF++（RyotaUshio/obsidian-pdf-plus） | 选区/批注回链、内部链接预览、引用模板、目录/缩略图成为复制或拖拽入口、复用已打开的 PDF leaf | 借鉴缩短原文与笔记往返的流程；已实现的回链、当前页筛选、双向预览不重复建设。私有 viewer patch、修改 PDF 和任意 JS 模板不直接移植。 |
| Annotator（elias-sundqvist/obsidian-annotator） | 评论/标签的 Markdown 呈现、稳定批注块 ID、引用跳回、TextQuoteSelector 的 exact/prefix/suffix | 借鉴可读笔记与锚点诊断，保留 rects[] 真源；不移植整套 iframe/Hypothesis fork。旧文档中的重命名及跨平台问题不当成可用方案。 |
| Zotero reader + Zotero | 稳定 annotation key、宿主保存回调、按标签/颜色/类型/文本评论筛选、阅读位置恢复 | 借鉴保存与渲染分层、批注身份和筛选语义；Zotero 数据库格式与坐标需显式适配，不假设和本地 rects[] 可互换。 |
| Zotero Integration（community-archive） | 元数据/图片/输出路径模板、persist 用户内容区域、lastImportDate/isFirstImport 增量契约 | 优先借鉴重复导入和手写内容保留。日期追加不等于按批注 ID 更新/删除，需定义本项目的幂等导入协议。 |
| Bookshelf（weph/obsidian-bookshelf） | Markdown 属性、多 lists、Bases gallery/table、started/finished/abandoned/progress 阅读事件 | 借鉴多集合与明确阅读状态；将它的笔记索引模式整体替换 LibraryIndex 会改变当前架构，暂不这样做。 |
| Sioyek（ahrm/sioyek） | 命令驱动、本书/全库书签、位置历史、overview/portal 保留源位置与参考位置 | 借鉴正文空间优先及预览/正式跳转分离；不默认抢占 Obsidian 全局快捷键，不照搬独立 Qt 桌面 UI。 |
| Obsidian 官方插件与主题规范 | 宿主 CSS 变量、设置控件、低特异性样式、命令快捷键边界 | 沿用当前 host-first 策略；焦点、选中、激活状态和用户 snippet 覆盖要分别验收。 |

Book Search 作为元数据查询的补充参考：官方仓库 `anpigon/obsidian-book-search-plugin` 支持 Google Books/Naver 与书名、作者、出版社、ISBN 查询；其新建笔记流程不足以证明书籍实体级去重。

维护快照（研究日 2026-10-02）：PDF++ 最新 release 0.40.31（2025-08-30）、Annotator 0.2.11（2024-01-08）、community-archive Zotero Integration 3.2.1（2024-08-11）、weph Bookshelf 0.21.3（2026-06-30）。Zotero reader/core 在本次核查时分别有 2026-10-01/2026-10-02 开发提交；未核实客户端最新稳定 release。另有 grub-basket Integration fork 3.3.3（2026-09-07），不能和官方登记仓库版本混报。Sioyek 正式发布 v2.0.0（2022-12-16）、预发布 sioyek3-alpha0（2024-09-11），本次固定研究的 development 分支提交日期为 2026-09-24；开发分支能力不自动等同正式版本。旧 release、未归档或 README 的开发声明均不单独证明当前维护活跃。

许可只做来源核对：PDF++ 与 weph Bookshelf 根许可证为 MIT，Zotero 与 reader 为 AGPLv3，Zotero Integration 与 Sioyek 为 GPLv3。Annotator 根许可证/README 为 AGPLv3、package.json 却写 MIT；Book Search 根许可证/package.json 为 MIT、README 又写 AGPLv3，均有声明冲突。本报告借鉴交互原则，不复制上游代码、CSS、图标或资产。

## 已证实需要优先保护的边界

### 1. 元数据缺失不能直接等同于用户删除摘录

- `src/targets/MarkdownTargetAdapter.ts:84` 只将完整开始/结束标记且内部 `reading-desk` JSON 合法的块加入存活 ID 集合。
- `src/targets/TargetService.ts:64` 将没有出现在该集合中的 ID 视为缺失，再调用 `AnnotationStore.removeMissingTargetIds()`。
- `src/annotations/AnnotationStore.ts:84` 删除高亮、评论和摘录卡片状态。
- 合成样例已证实：删掉 JSON 代码块后，引用文字仍然存在，但检测到的 ID 集合变为空。结合调用链，会触发反向清理；本轮没有在真实用户笔记里实施删除。

建议区分“已确认删除”“标记不完整/解析失败”“文件暂时缺失”；后两种保留原文锚点并进入待修复状态。删除使用可恢复记录和恢复入口。保留有意删除目标卡片的反向同步，增加识别与恢复层。直接取消反向删除将与 ADR 0004 冲突，不能作为无说明的实现方式。

验收：仅删除/损坏 JSON、同步到中间内容、合法删除整个摘录、撤销删除四种场景有不同的确定结果；评论能随高亮恢复。

### 2. 更新摘录时保护用户在目标中的手写内容

- `src/targets/MarkdownTargetAdapter.ts:53` 使用新的整个块替换已有标记范围。
- `src/views/ReaderView.ts:639` 改色后重新调用 `writeExcerpt()`。
- 合成样例已证实：用户添加在摘录标记范围内的一行分析，在下一次 `writeMarkdownExcerpt()` 后消失。标记范围外内容不受这个样例影响。

建议将插件管理的引文/元数据与用户笔记划清可编辑边界；改色和回链刷新尽量只更新管理字段，保留人工笔记区域。模板导出增加固定占位符和预览，不引入任意脚本执行。新增模板以前先保证重复更新不会覆盖用户内容。

验收：用户修改引文标题、折叠状态、追加评论后，再改色/重命名 PDF/重新导出，人工内容保留；同一高亮重复更新不产生副本。

### 3. 持久化失败需要明确的未保存状态和恢复路径

- `src/data/ReadingDeskRepository.ts:29` 先执行 mutator，再保存快照；保存失败会拒绝当前 Promise，但内存状态已改变。
- `src/reader/ReaderExcerptWriter.ts:70` 先写目标文件，再保存 AnnotationStore；这两个存储之间没有跨文件事务。
- 内存样例证实：save 抛错后，调用方得到失败，高亮仍可从内存读到。它证明的是内存/落盘差异，不证明当前用户已经丢数据。

建议维护待保存状态、可重试队列、恢复摘要；目标写入与标注落盘间使用可核对的操作记录或补偿机制。UI 给出“未保存/重试/已恢复”，不能仅把 Notice 消失当保存成功。恢复设计仍由 Repository/TargetService 承担，`main.ts` 只负责宿主接线与呈现回调。

验收：目标写失败、data.json 写失败、两步之间退出、重启后重试均能恢复一致；后续正常提交不会让失败队列永久卡住（现有测试已覆盖队列可继续）。

### 4. 书库导出不能承担完整标注备份

- `src/portability/BookshelfPortabilityService.ts:46` 的导出结构只有 metadata、categories、books。
- `src/portability/BookshelfPortabilityService.ts:126` 未导出 highlights、comments、excerptCards，也没有对应的 Reading Desk 全量恢复入口。

建议保留现有“书架导出”，另增带 schemaVersion 的“完整备份/恢复”；包含图书稳定 ID、标注 rects[]、评论、摘录状态、目标引用与必要配置，默认不输出云存储凭据。恢复前给差异预览、路径映射、重复项规则与引用完整性检查，先备份当前数据。

同时为加载数据增加形状验证与版本迁移。当前 `ReadingDeskRepository.ts:51` 只判断非空 object；合成样例中 `books` 为字符串仍被接受。对损坏内容应保留原件并给诊断，不静默当成空库后覆盖。

### 5. 跨设备同步需要检测外部版本变化

当前 Repository 在 `initialize()` 时加载一次数据，`commit()` 串行化本实例的写入，再保存完整快照；它没有外部版本比较或跨实例合并契约。两个内存 Repository 共享合成 DataSink 的复现结果：A 更新书库目录，随后仍持有旧快照的 B 只更新 viewer 模式，B 的保存把 A 的书库目录变回空数组。

这证明本地 Repository 不提供多写者冲突保护；没有在真实 Windows/Mac 同步服务上实施冲突测试，也不宣称用户已出现覆盖。项目源码三端 Git 同步一致不能证明插件运行数据具有同等一致性。

建议先做外部文件版本/哈希变化检测、覆盖前备份、冲突摘要和重载入口；需要持续同步时再定义按稳定 ID 合并、删除记录和每设备阅读位置的规则。外部文件监听与宿主读写仍在 `main.ts` 接线，Repository 承担版本验证及合并。参考 Zotero 的对象 key 与版本增量思想，不直接接入或复制其云同步实现。

验收：两设备从同一快照分别新增高亮、改元数据、删除同一高亮；变化被识别，冲突有明确结果，恢复后目标引用与评论完整。

## 前端优化评估

前 3 项由当前 Mac 书架截图与源码共同支持，后 3 项为源码审计，尚未完成交互实机验收。当前已有宿主 CSS token、封面高度上限与响应式工具栏；建议沿用这些基础。ADR 0007 仍为 Proposed，只代表设计方向，不作为已实现证据。

| 优先级 | 具体建议与用户收益 | 当前证据与范围 | owner / 成本 / 验收 |
| --- | --- | --- | --- |
| P1 | **继续阅读改为横向紧凑卡。** 左侧小封面，右侧两行标题与进度，减少重复展示，为主书库留出首屏空间。 | `ShelfView.ts:176`、`assets/styles.css:423/:439`；已有封面 160px 上限和简化元信息，长书名竖卡仍占较多高度，当前截图中主书库首排的书名/进度尚未进入首屏。 | ShelfView 与样式；中。在同窗口、左右栏展开条件下，无滚动可看到首排书目，完整标题保留 accessible name/tooltip。 |
| P1 | **无封面时提供可区分的排印占位。** 书名简写、格式与稳定布局帮助辨认书籍。 | `ShelfView.ts:296`、CSS `:435`；当前重复的大块“无可用封面”辨识度低。使用宿主 token，不预设固定品牌色；封面提取后端不属于本项。 | shelf 组件与样式；小。图片加载失败不改变卡片高度，占位仍明确表示无封面。 |
| P1 | **分类管理按需展开。** 默认保留筛选与“管理分类”入口，将现有创建/上下重排移入面板。 | `ShelfView.ts:190/:213`、CSS `:447`；创建表单与重排控件常驻主书库前。此建议不额外承诺分类改名/删除。 | shelf 管理面板；中。键盘可操作，关闭回到入口，打开/关闭不改变筛选结果。 |
| P1 | **窄分栏的更多菜单补齐动作与禁用状态。** 隐藏的显示选项仍可访问。 | `ReaderToolbar.ts:92/:112`、CSS `:526`；小于 500px 时隐藏的整页适配、旋转、滚动模式、反相没有补入 more；历史按钮的 disabled 状态也未共享到菜单。 | ReaderToolbar 共用 action 定义与状态；小。在 480/640/900px 实际 leaf 宽度验收全部动作、键盘访问和历史禁用一致性。 |
| P1 | **修正嵌套键盘事件和浮层焦点归还。** 编辑卡片内下拉框不误开书，浮层关闭后焦点回到实际入口。 | `ShelfView.ts:284/:337` 的卡片 Enter/Space 未排除内嵌 select；`TargetPanelDisclosure.ts:19` 回到固定工具栏按钮，而窄 leaf 中该按钮可能已隐藏。 | shelf 键盘事件与 TargetPanelDisclosure；小到中。下拉框 Enter/Space 不意外开书，从 more 打开后 Escape 回到可见入口，阅读位置不变。 |
| P1 | **设置增加局部保存状态。** 明确显示保存中、成功、失败与重试，保留输入和焦点。 | `ReadingDeskSettingTab.ts:162/:176/:232/:274`；普通 onChange 等待更新，缺少局部反馈；连接测试已有可借鉴的状态呈现。未复现设置保存失败。 | ReadingDeskSettingTab 包装保存 Promise、live region；小。模拟失败可重试；“已保存”与“所有已打开 Reader 即时应用”分别验证。 |

外部原则来自 Obsidian 官方宿主变量/低特异性样式指导，以及 Sioyek 的正文空间优先。当前截图中的粉色文字和字体来自第三方主题，不能据此要求换成插件硬编码配色。样式验收另需覆盖浅色/深色、高 DPI、用户 snippet 与焦点/激活/禁用状态。

## 功能增强与新增能力

### 书库、元数据与互操作

本节来自书库子代理对限定目录的只读审计；缺口与复杂度有源码依据，实际性能和文件迁移场景未做实机验证。

| 优先级 / 类型 | 具体建议与用户收益 | 当前证据 | owner / 成本 / 验收 |
| --- | --- | --- | --- |
| P1 增强 | **保护人工标题/作者，记录字段来源。** 自动提取、外部导入和人工覆盖分别存储；支持主动清空作者与恢复自动值。避免 PDF 更新或封面重试覆盖已修正信息。 | `LibraryIndex.ts:54` 可手动更新；`:87` 重提取后在 `:107` 使用提取标题/作者，只保留旧标签、评分等。此覆盖场景为静态风险。 | LibraryIndex 合并、MetadataExtractor 只提取、contracts 定义来源；中。验收文件变化、提取失败、封面重试后人工值保留，主动恢复自动值可更新。 |
| P2 新增 | **全库摘录与评论检索。** 按文字、评论、标签、颜色、章节和书籍组合查询，结果一键回到稳定 highlightId。 | `AnnotationStore.ts:20` 已有全库高亮查询，`:73` 可读评论；`ShelfViewModel.ts:33` 当前书架搜索只匹配标题/作者/书籍标签。 | 独立只读检索服务＋shelf 结果页，真源仍是 AnnotationStore；中。评论独有关键词可命中，修改/删除后更新，检索不写目标。 |
| P2 增强/新增 | **筛选、排序与批量组织。** 先做格式/标签/评分筛选、明确排序、批量加标签/归类，再增加多阅读列表及未读/在读/读完/暂搁。 | `ShelfView.ts:37` 为单 selectedBookId；`:176` 和 `:408` 单条编辑；`contracts.ts:19` 只有 categoryId、progress、lastReadAt；现有分类和继续阅读不算缺失。 | ShelfViewModel 查询，独立 shelf 模块交互，LibraryIndex 写入；中、可分批。批量追加/替换有明确结果，多列表不复制书籍实体，状态不机械等同百分比。 |
| P2 增强 | **合并扫描事件、按变化文件处理并限制书架 DOM。** 保留全量扫描作为对账；大量导入时减少重复扫描与完整快照保存。 | `LibraryIndex.ts:33` 线性 getByPath；`:42` 全量逐文件 scan；`main.ts:390` 每个书籍 create/modify 触发 scan；书架列表逐项创建 DOM。实际卡顿未测。 | LibraryIndex 内维护可重建路径映射和批次，shelf 分页/窗口化，main 仅接线；中。万本库改单文件只重新提取该文件，事件合并，部分扫描不误删其他记录，键盘/编辑状态保持。 |
| P1/P2 增强 | **重新关联离线移动的源文件。** 让用户确认候选 PDF 后保留原 book ID、批注与进度。 | `main.ts:396` 已处理正常在线 TFile rename；扫描按路径识别，`LibraryIndex.ts:104` 新路径创建 ID，`:48` 旧路径消失会移除原书目。离线移动恢复是静态缺口。 | LibraryIndex 管身份与候选，portability 预览映射，main 协调引用；中。在线重命名不回退，离线重绑定保留数据，同名不同版本不自动合并。 |
| P2 新增 | **CSL JSON → BibTeX → Zotero 来源适配。** 导入前展示新增/更新/冲突/未匹配附件，并允许按稳定来源 ID 重复更新。 | `BookshelfPortabilityService.ts:62` 是旧 Bookshelf 一次性流程，`:86` 按路径/ID 去重；`contracts.ts:10` 书籍要求本地路径、作者为字符串，未定义结构化文献来源身份。 | portability 适配/合并计划，ImportExportPanel 预览，LibraryIndex 唯一书籍写入；大、分阶段。重复导入幂等，人工值保留，附件关联可确认，来源冲突有解释。 |

外部设计依据：Zotero 的稳定对象 key、批注文本/评论筛选与版本增量协议；Zotero Integration 的持久用户文本区域；weph Bookshelf 的显式属性、多 lists 与阅读事件。它们证明交互或数据契约的可参考性，不构成本项目性能收益或批量编辑可用性的实测。

EPUB 已确认有入库、OPF 元数据和 EPUB2/3 封面提取；完整 EPUB Reader/批注/位置恢复本轮未核验。文件夹整体移动是否为各子文件产生 rename 事件也需实机核验，不在本轮报告中断言必然失效。

### PDF 阅读与标注

以下 6 项均由阅读器子代理发现并经主代理定点复核，为静态风险或能力边界，没有在用户 PDF 上复现错误裁剪、错页高亮或内存增长。已有连续滚动、虚拟化、全文搜索、跳转历史不再作为新增功能提出。

| 优先级 / 类型 | 具体建议与用户收益 | 当前证据 | owner / 成本 / 验收 |
| --- | --- | --- | --- |
| P0 正确性 | **先保证单页原子摘录的文字与矩形一致。** 跨页选区应明确拒绝/提示；需要跨页摘录时再设计逐页分段与关联组。 | `ReaderExcerptWriter.ts:37` 使用 fallbackPage 选 host；`:48` 只按左右边界过滤，跨页告警同样缺少上下边界；`:64` 保存完整 input.text。同宽相邻页可能通过横向检查，文字与单页矩形存在错配边界。 | ReaderExcerptWriter/ReaderView；中。正反跨页选区、相邻同宽页、视口中心切页后摘录并重开，文字和页码/rects 一致。新跨页模型需单独定义迁移，继续保存归一化 rects[]。 |
| P0 正确性 | **裁剪显式绑定页码、矩形与旋转。** 冻结启动裁剪时的 viewport，避免渲染状态切换决定源页面。 | `ReaderView.ts:580/:583` 的 payload 有 page，调用却为 `pdf.renderCrop(payload.rect)`；`PdfRenderer.ts:201/:202` 使用共享 renderedPageNumber；`CropGeometry.ts:31` 的显示空间归一化与 PDF 空间反归一化还需旋转转换核验。 | CropLauncher/Overlay、ReaderView、PdfRenderer；中。相邻页延迟完成的情况下裁剪仍取选定页；0/90/180/270°同一图表位置和输出正确。 |
| P1 增强 | **完整命中索引、精确定位与当前命中标记。** 展示列表可以限量，实际命中数量不应随之截断。 | `ReaderSearchService.ts:12` 每页实际最多 3 个命中，测试 `ReaderSearchService.test.ts:14` 锁定该设计；SearchHit 只有 page/snippet，无偏移；`:75` 逐 span 判断完整 query；`ReaderToolsController.ts:38` 只跳页。 | ReaderSearchService 建偏移/span 映射，ReaderToolsController/Panel 定位；中。同页 20 次、跨 span/跨行词组的计数、标记与上下导航一致。 |
| P1 增强 | **搜索取消、关闭失效与失败恢复。** 只让最新请求更新结果，关闭/切书后旧请求不再跳页。 | `ReaderSearchService.ts:62` 全文扫描没有整请求失效检查，reset token 只保护 loadPage 缓存；`ReaderSearchPanel.ts:79` 使用 running.then 串行化，缺少 rejection 恢复；close 只隐藏面板。已有查询文本比较，但不足以覆盖关闭、切书和 Promise 拒绝。 | 搜索服务与面板共享请求 generation，生命周期取消；中。A→B、关闭/切书、提取失败后下一查询成功，旧任务不改变位置。 |
| P1 增强 | **迟到渲染淘汰与画布预算。** 优化已有可见窗口策略，限制快滚和高 DPI 的资源峰值。 | `ReaderPageDeck.ts:232/:286` 离开窗口时尚未完成的页直接返回；`:271` 完成后没有再检查距离/epoch，离屏 pending 仍可继续；renderEpoch 增加但未用于结果校验。`PdfRenderer.ts:91` 按 viewport×DPR 分配，没有像素预算。性能收益尚未实测。 | ReaderPageDeck 管任务代次与窗口，PdfRenderer 管像素/DPR预算；中。延迟渲染并快跳数百页后画布数量回到窗口上限；缩放/旋转不回写旧结果。 |
| P1 增强 / P2 探索 | **先保证未渲染页的高亮回链定位，再研究 PDF 内链/脚注预览。** 预览与正式跳转分离，返回时恢复源位置。 | `ReaderPageDeck.ts:69` goToPage 请求渲染但不等待；`ReaderView.ts:614/:616` 随后立即 scrollToHighlight，失败没有重试。`PdfRenderer.ts:71` 组合 canvas/text/自定义高亮，没有原生 PDF annotation/link layer。 | ReaderPageDeck 提供可取消 ensurePageRendered，ReaderView 协调；定位为中，PDF 内链层为大。冷页最终精确定位，两次跳转只保留最新；后续内链后退恢复页内位置。 |

外部依据：PDF++ 的内链预览与笔记往返、Sioyek 的 overview/portal 和位置历史。优先落实当前回链与渲染正确性，再引入预览，避免新导航功能放大已有异步边界。

## 实施顺序与成本

成本是相对量级，并非工期承诺：小表示单组件/局部交互，中表示多个模块及错误恢复/场景验证，大表示新数据契约、迁移或外部格式兼容。需要完整标注迁移、PDF 几何变更或外部格式兼容的建议应单独设计与验证。各批不是一个版本必须同时完成的承诺。

| 顺序 | 主题 | 类型 / 相对成本 | 前置条件与交付边界 |
| --- | --- | --- | --- |
| 第一批 P0 | 标记异常与合法删除区分、人工内容保留、未保存/恢复状态、加载形状校验、外部旧快照检测 | 可靠性增强；中 | 明确更新/删除契约，先保护当前数据；跨设备先检测/备份，再研究合并。 |
| 第一批 P0 | 单页摘录边界、裁剪 page/rotation 显式参数 | 正确性修复；中 | 先跑定向复现；跨页模型与高级裁剪分开设计。 |
| 第二批 P1 | 完整备份恢复、冷页回链定位、搜索完整命中与取消/失败恢复 | 现有工作流增强；中到大 | 备份有 schema、路径预览与引用检查；导航/搜索有请求失效机制。 |
| 第二批 P1 | 紧凑继续阅读、无封面占位、按需分类管理、more 动作完整、键盘焦点、设置状态 | 前端优化；小到中 | 可以拆成独立小改动；实机浅色/深色与 480/640/900px leaf 验收。 |
| 第二批 P1/P2 | 人工书目信息保护、重新关联源文件、渲染资源预算与扫描批次 | 数据与规模化优化；中 | 来源/稳定 ID 规则明确；大库与大 PDF 性能先建立基线，再宣称收益。 |
| 第三批 P2 | 全库摘录评论检索、筛选排序/批量标签，再增加多列表和阅读状态 | 新增研究工作流；中、可拆分 | 查询复用真源，多列表不复制书籍实体，编辑保留可恢复路径。 |
| 后续 P2 | CSL JSON→BibTeX→Zotero 来源适配、增量模板、PDF 内链/脚注预览 | 新增互操作与导航；大 | 重复导入幂等、用户内容保护与导航历史已稳定，每个来源单独验收。 |

## 边界与暂缓项

- 暂不因对标而引入 React/Vue/Svelte；当前 vanilla DOM 与中文 UI 约束仍有效。
- 暂不直接修改原 PDF、再造 Canvas 编辑器或把任意 Markdown 反链变成第二标注真源；它们会改变已有数据与 ownership 决策。
- 不把主题的粉色/字体样式当成插件自身固定配色；应优化插件语义 token 的继承、控件层次和密度。
- 前端问题优先通过信息层级、命中区、焦点与布局解决；视觉装修不替代保存、恢复和回链可靠性。

## 来源与追溯

所有外部来源仅使用项目官方 GitHub、固定 SHA 源码、官方发布页及官方文档。以下链接用于追溯能力，版本/提交维护快照另由 GitHub releases/latest、commits API 核对；不把社区评论当已实现能力。

1. [PDF++ 官方仓库与 README](https://github.com/RyotaUshio/obsidian-pdf-plus/tree/6a3218b9c506076b405438489e614bc9e22b833b)；[0.40.31 release](https://github.com/RyotaUshio/obsidian-pdf-plus/releases/tag/0.40.31)；[MIT](https://github.com/RyotaUshio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/LICENSE)。
2. [Annotator 官方固定快照](https://github.com/elias-sundqvist/obsidian-annotator/tree/3647dd92d0d803bae9a3f34a1aac19eacb2fd52d)；[文本锚点与序列化](https://github.com/elias-sundqvist/obsidian-annotator/blob/3647dd92d0d803bae9a3f34a1aac19eacb2fd52d/src/annotationUtils.tsx#L63-L103)；[根许可证](https://github.com/elias-sundqvist/obsidian-annotator/blob/3647dd92d0d803bae9a3f34a1aac19eacb2fd52d/LICENSE.TXT)。
3. [Zotero reader 批注管理](https://github.com/zotero/reader/blob/692c28989629acf920fadb683747e18e5506b214/src/common/annotation-manager.js)；[宿主持久化](https://github.com/zotero/zotero/blob/ae50d5258992b49d4eeac274e10996039b0bd909/chrome/content/zotero/xpcom/annotations.js#L214-L262)；[官方增量同步协议](https://www.zotero.org/support/dev/web_api/v3/syncing)。
4. [Zotero Integration 模板文档](https://github.com/community-archive/obsidian-zotero-integration/blob/2043211d87ff2ca5db31bf587b5024eac9f49171/docs/Templating.md)；[persist 实现](https://github.com/community-archive/obsidian-zotero-integration/blob/2043211d87ff2ca5db31bf587b5024eac9f49171/src/bbt/template.env.ts#L170-L201)；[导入 identity 与回链](https://github.com/community-archive/obsidian-zotero-integration/blob/2043211d87ff2ca5db31bf587b5024eac9f49171/src/bbt/export.ts#L88-L150)。
5. [weph Bookshelf 元数据文档](https://github.com/weph/obsidian-bookshelf/blob/fe54babd09ed73bcb89fe2c49aef10d17c583b58/docs/docs/book-notes.md)；[阅读事件及状态](https://github.com/weph/obsidian-bookshelf/blob/fe54babd09ed73bcb89fe2c49aef10d17c583b58/src/bookshelf/bookshelf-impl.ts#L25-L77)；[Bases 视图](https://github.com/weph/obsidian-bookshelf/blob/fe54babd09ed73bcb89fe2c49aef10d17c583b58/docs/docs/bases-views.md)。
6. [Book Search 元数据查询](https://github.com/anpigon/obsidian-book-search-plugin/blob/9bd8d0cad45196aed7fe5ab1dda62052718230eb/README.md)；[创建流程](https://github.com/anpigon/obsidian-book-search-plugin/blob/9bd8d0cad45196aed7fe5ab1dda62052718230eb/src/main.ts#L156-L173)。
7. [Sioyek 固定开发快照](https://github.com/ahrm/sioyek/tree/f4609bfbfd53aaa9bb0ca70744df54ebf768fddf)；[命令、位置历史与书签](https://github.com/ahrm/sioyek/blob/f4609bfbfd53aaa9bb0ca70744df54ebf768fddf/pdf_viewer/keys.config)；[GPLv3](https://github.com/ahrm/sioyek/blob/f4609bfbfd53aaa9bb0ca70744df54ebf768fddf/LICENSE)。
8. [Obsidian 官方主题变量原则](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling)；[官方 Vault.process 文件更新契约](https://docs.obsidian.md/Plugins/Vault)。本项目 `main.ts:568` 已使用 Vault.process，不将原子目标文件更新列为缺失。
