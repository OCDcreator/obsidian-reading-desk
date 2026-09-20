# PDF++ 设计研究与 Reading Desk 适配决策

> 研究快照：2026-09-20；上游 `ryotaushio/obsidian-pdf-plus` 的 `main`，commit [`6a3218b9c506076b405438489e614bc9e22b833b`](https://github.com/ryotaushio/obsidian-pdf-plus/tree/6a3218b9c506076b405438489e614bc9e22b833b)，tag `0.40.31`。本地只读参考检出：`/Volumes/SDD2T/obsidian-vault-write/custom-project/obsidian-pdf-plus`。以下行号固定在该 commit；不是对未来上游版本的承诺。

## 来源、许可与研究方法

上游 [`LICENSE`](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/LICENSE) 和 [`package.json`](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/package.json#L1-L17) 声明 MIT；仓库还带有 `THIRD_PARTY_LICENSES`。Reading Desk 也声明 MIT，但本研究只借鉴交互原则，不复制 PDF++ 的代码、CSS、图标、PDF 修改算法或第三方资产。如果将来逐字复用实质代码，必须复核许可证及第三方归属、保留许可和作者声明，并单独记录来源。

方法：先阅读上游 README 获得功能词汇，再以 `src/` 中的调用路径核实；同时比对 Reading Desk `PRODUCT.md`、`DESIGN.md`、ADR 0004 与当前实现。README 的演示、未启用代码、运行时行为不是同一等级证据。本文“可采用”是设计取舍，不声称这些功能已在 Reading Desk 实现或通过实机验证。

## 两个产品的边界

PDF++ 的核心路径是“在 Obsidian 原生 PDF viewer 中选中内容或页面 → 复制带位置的链接 → Markdown 反链成为可见标记 → 在原文与反链之间导航”。源码中，复制选区时先从 PDF 文本层确定页和范围，再写入剪贴板并提供短时状态；[选区解析](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/copy-link.ts#L21-L60)、[复制与反馈](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/copy-link.ts#L259-L311)。反链索引监听 metadata cache 的 changed/deleted 和 Vault rename，并按页、选区或 annotation 建立索引；[索引生命周期](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/pdf-backlink-index.ts#L23-L73)、[页索引](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/pdf-backlink-index.ts#L171-L219)。

Reading Desk 则拥有独立 Reader 和书架、归一化 PDF `rects[]`、`AnnotationStore` 唯一标注真源及 Canvas/Excalidraw/Markdown 原生目标；[本地契约](../../src/types/contracts.ts)、[ADR 0004](../adr/0004-annotation-storage.md)。它已能从目标反向定位稳定 `highlightId`，不是再建一个由任意 Markdown 反链驱动的标注数据库。此次适配保留这个根本差异，目标是减少研究过程中“当前页、标记、摘录目标”之间的往返成本。

## 候选设计和取舍

| 编号 | 上游源码证据和用户问题 | Reading Desk 取舍、owner 与验证 | 决定 |
| --- | --- | --- | --- |
| PDP-001 | [命令](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/commands.ts#L22-L50)含复制选区与当前页视图；[右键页链接](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/context-menu.ts#L757-L768)让当前阅读位置成为可粘贴入口。Reader 现有页码、切页和状态见 [`ReaderView`](../../src/views/ReaderView.ts)。 | 提供“复制当前页链接”按钮/命令，生成可在同一 vault 回到 Reading Desk 该页的保守格式。现有 `reading-desk-highlight` handler 强制要求 `highlight`，所以实现必须显式增加页级路由（或扩展为互斥的 `highlight`/`page` 参数），不能把当前协议当成已支持页链接；宿主协议路由归 `main.ts`，Reader 按 leaf 提供当前文件和 1-based 当前页，转换函数负责和 0-based `PdfHighlight.page` 划清边界。优先稳定书目 ID 或明确的路径失效反馈。复制成功、权限失败、文件重命名、旧页超界均需测试/实机检查。不要承诺 PDF++ 的精确 scroll/zoom 视图。 | **调整后采用，本轮** |
| PDP-002 | [注释复制链接](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/copy-link.ts#L314-L349)把选定 annotation 变成回链；[上下文菜单](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/context-menu.ts#L559-L568)提供明确入口。Reading Desk 已有 [`createSourceLink`](../../src/targets/TargetTypes.ts) 和 [`openReaderHighlight`](../../src/main.ts)。 | 在现有高亮列表增加“复制原文链接”，复用同一个稳定 `highlightId` 协议，而不是另造 annotation 索引。列表 UI 属 `HighlightList`，链接格式只有一个 owner；剪贴板失败必须有行内或 Notice 反馈。用真实 Markdown 粘贴与协议回跳验证，删除后的失效行为要明确。 | **调整后采用，本轮** |
| PDP-003 | [页过滤按钮](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/pdf-backlink.ts#L20-L36)、[切页跟随和页匹配](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/pdf-backlink.ts#L228-L288)帮助在长 PDF 中只看眼前证据。 | 把“本书全部 / 当前页”开关放在 Reading Desk 已有高亮抽屉，不去 patch Obsidian Backlinks。筛选基于 `AnnotationStore.list(path)` 的 `highlight.page`；`ReaderView` 维护每 leaf 的临时筛选状态，`HighlightList` 展示数量与空态。翻页、关闭/重开、同书不同 leaf、删除/重染均需验证。 | **调整后采用，本轮** |
| PDP-004 | [PDF→反链 hover](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/backlink-visualizer.ts#L146-L171)、[反链→PDF hover](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/pdf-backlink.ts#L38-L80)使同一证据位置可识别；上游按 cache 同步多段 DOM 的 [hover class](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/backlink-visualizer.ts#L179-L199)。 | 只在 Reading Desk 自己的 PDF 高亮层与抽屉行之间按稳定 ID 双向预览；不改全局 Backlinks。Reader 负责 per-leaf 事件/清理。PDF 层已经输出 `data-highlight-id`，但当前 `HighlightList` 的 `<li>` 尚未输出，所以实现必须为列表行补上同一 ID，并同时定义重渲染、抽屉关闭和 Reader close 时的清理；CSS 以不覆盖语义色的边界/轮廓表意，并给键盘 `focusin/focusout` 等价反馈。多 rect、跨页和重渲染不留悬挂类。 | **调整后采用，本轮** |
| PDP-005 | [颜色选择立即复制](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/color-palette.ts#L105-L163)把色与复制动作合并。 | Reading Desk 的色盘已用于“以此色创建真实摘录”，见 [`ReaderView`](../../src/views/ReaderView.ts)；改变其主要点击语义会制造误操作。可以考虑未来附加明确菜单，不合并现有动作。 | **暂缓** |
| PDP-006 | [选区索引](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/copy-link.ts#L21-L60)与 [copy selection](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/copy-link.ts#L259-L311)允许未保存标注的原文深链。 | 值得单独研究，但 PDF++ 使用文本层 span 索引；Reading Desk 持久化的是归一化 `rects[]`，目前协议按高亮 ID 定位。不能把脆弱的文本索引偷偷加入现有 schema。须先制定无标注选区的稳定性、PDF 更新与错误策略。 | **暂缓** |
| PDP-007 | [矩形选择](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/color-palette.ts#L459-L589)先换算 PDF 坐标，再复制矩形嵌入。 | Reading Desk 的 [`CropSelectionOverlay`](../../src/ui/crop/CropSelectionOverlay.ts) 和 `PdfRenderer.renderCrop` 已处理归一化区域与真实图像；不复制第二套几何。以后可另立“只复制裁剪引用”而不重做裁剪。 | **已有同类能力；本轮不改** |
| PDP-008 | [outline/缩略图命令](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/commands.ts#L52-L66)和 [outline drag](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/drag.ts#L15-L38)缩短长文档定位。 | 本地 PDF outline 已用于 Canvas chapter 同步，但 Reader 无页导航目录。可在独立设计评审后添加受容器宽度约束的 outline 导航，不引入 PDF++ 的私有 viewer/dragManager API，也不挤占现有 220px 目标列。 | **暂缓** |
| PDP-009 | [PDF page composer](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/composer.ts#L13-L82)能插入、移除、抽取页并更新 vault 链接。 | 与 Reading Desk 的原文锚点、页码、rects[]、多目标数据一致性发生大范围冲突。没有可回滚迁移与链接更新契约之前不修改原始 PDF 字节。 | **拒绝本轮** |
| PDP-010 | [直接写 PDF annotation](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/lib/highlights/write-file/index.ts#L61-L88)使结果在 Obsidian 外可见。 | `AnnotationStore` 是当前唯一真源，写进 PDF 会产生第二套可编辑状态及潜在损坏风险。不是本轮“借鉴小工作流”可暗中扩张的行为。 | **拒绝本轮** |
| PDP-011 | [模板执行](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/template.ts#L8-L25)用 `new Function` 评估复制格式。 | 不引入任意表达式执行、跨插件对象暴露或复杂设置。将来如需复制格式，只允许固定、可测试、转义明确的格式选项。 | **拒绝该实现方式** |
| PDP-012 | [PDF view patch](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/patchers/pdf-view.ts#L9-L80)保存页/位置/缩放，[启动时多点 patch](https://github.com/ryotaushio/obsidian-pdf-plus/blob/6a3218b9c506076b405438489e614bc9e22b833b/src/main.ts#L561-L589)扩展原生 viewer。 | 上游 README 也明确私有 API 兼容风险；Reading Desk 自有 `ReaderView`/`PdfRenderer`，不 monkey-patch 宿主。只借鉴“可恢复当前阅读上下文”的产品目标，使用本地公开边界。 | **拒绝该实现方式** |

## 首批实现契约（PDP-001–004）

1. **位置与原文链接**：当前页可在工具栏复制、已有高亮可在列表复制。复制只读、不隐式创建注释或目标。页链接显式扩展协议，接受 1-based 可见页，并在路由边界转换/裁定；高亮链接继续以稳定 ID 为准。两类链接经过同 vault 的真实点击回到正确 Reader、页或高亮；文件重命名/删除、无 Reader、权限拒绝均有确定反馈。`main.ts` 只负责命令/协议与宿主剪贴板回调，链接构造放在单一可测试模块，Reader/HighlightList 只负责各自 UI。避免使用上游 PDF 文本层索引或任意模板。
2. **当前页筛选**：抽屉既能看本书全部，也能只看当前页；按钮的文本、`aria-pressed` 和结果计数必须一致。当前页没有高亮时仍能一键回到全书；翻页实时更新。筛选是 per-leaf 视图状态，不修改 `AnnotationStore` 数据。
3. **双向定位预览**：悬停抽屉行 → 对应 PDF rects[] 轮廓；悬停 PDF mark → 对应列表行状态。`focusin/focusout` 提供键盘等价，离开/关闭/翻页/重绘后清理；预览不能抢走双击跳目标、单击评论、选区或原有色盘行为。
4. **视觉约束**：沿用 `DESIGN.md` 的 host-first tokens、25/20/16 与 14/12 字体层级、24/16/8 节奏和 4/8/12/16/20/24 间距刻度；窄 leaf 的 toolbar wrap、抽屉定位与 PDF 可用宽度必须实测。中英文长路径/长选区、空态、错误态、light/dark、键盘焦点都要验收。不从上游移植 CSS 或图标。

## 风险、阶段门与证据

- **架构**：PDF++ 使用 Obsidian 私有 PDF/Backlinks API 和 `monkey-around`；Reading Desk 坚持自己的 Reader、`AnnotationStore`、`TargetService` 边界。复制链接不等于建立一个新的反链索引；筛选只在本插件抽屉进行。
- **持久化/迁移**：首批不增加 highlight schema 字段、不写 PDF 原文件、不修改用户目标内容。若页深链使用书目 ID，需测试重命名后解析；若只能用路径，必须明确失效语义而非伪称稳定。旧协议 `reading-desk-highlight` 必须继续兼容。
- **性能/生命周期**：hover 同步只处理当前 leaf 中的可见节点，不全 vault 扫描；翻页和 `PdfRenderer` 重渲染后解除旧引用，关闭 Reader 清理监听。
- **可访问性**：复制/筛选有中文可访问名称、键盘动作与成功/失败反馈；预览状态不只依赖颜色，不能以 hover 作为唯一通道。
- **实机阶段门**：每个功能先有单元/集成测试；`npm run verify` 通过后部署到指定 Test Vault，按 AGENTS.md 顺序复制四件套并逐个比对 SHA-256，确认新的 Reading Desk build ID。截图前先验证正确 leaf/视图；保存浅/深主题、宽/窄 split、当前页/全书状态的截图，以及 computed style/DOM bounds/scrollWidth 的 JSON。截图目测与实测同时过关才可接受。详见另行生成的 `docs/self-check/pdf-plus-integration-visual-audit.md`。

首批能力是此次“从 PDF++ 吸取设计”的范围性判断，不代表照搬上游全部功能。后续 PDP-006/008 如果要进入实现，须分别先做锚点稳定性与窄 leaf 信息架构设计，不在首批实现中偷偷扩张。
