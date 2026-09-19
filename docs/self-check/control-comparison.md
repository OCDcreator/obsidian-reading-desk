# Reading Desk 控件逐项对照（0.1.1确认）

最终候选 `0.1.1+2026-09-18T17:18:51.094Z`。**已列视觉缺陷已闭合（ship）；功能外部验证边界继续保留。** 70张、418行对应control-map；本表升级确有落地的实现，未把每项都伪称为已运行验证。

证据层级：CODE=有生产实现；TEST=full verify对应单元/集成测试；RUNTIME=实际Obsidian产物；NATIVE=真实宿主视图和输入动作；VISUAL=截图与computed。LIMITED/PARTIAL/FAIL明确保留限制。`已实现`不等于所有质量门禁通过；`自研替代`仍保留差异理由及实施证据。截图与json相对docs/self-check，src/test/.obsidian-debug相对仓库。

首轮问题最终确认见visual-audit.md的V-01–V-10。整体功能原生证据见functional-native-acceptance.md；云服务账号凭据与Excal原生链接手势限制不隐去。

## 01-ebookshelf-card-view.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 书架内容区；标题下方；4 列 × 2 行可见封面卡片 | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 第一行第二张卡片；蓝色外轮廓、黄色标题、指针停留 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（静态图不能判定交互状态，采用可访问的独立状态）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 卡片文字；封面下半部；如《The PARA Method Simplify》 | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 自研替代（遵守新视觉方向，保留标题层级但不复制原版外观）；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 作者占位文字；第二行第 1、2、4 卡片；“点击添加作者信息” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 页数与大小；每卡片底部；“33 页 · 2.29 MB”等 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 阅读进度条与百分比；卡片底边 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 视频标题、水印及字幕；画面顶部与底部 | 范围排除；保留原理由，不删除P0–P3。 | 不做（视频品牌、水印与字幕不属于产品控件；自动入库另由 LibraryIndex 实现）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 02-ebookshelf-metadata.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 封面墙；4 列 × 2 行；无蓝色活动卡片边框 | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 标题与作者；第一行第 1 卡；“Murphy-lecture1-principles-3pp”“RobertMurphy” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 作者字段；第一行第 2／4 卡；“LaTeXwithBeamerclassversion3”“LaTeXwithhyperrefpackage” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 页数、大小；如 154 页／2.13 MB、11 页／458.14 KB | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 缺失作者提示；第二行第 1、2、4 卡片 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（采用原生表单或单元格编辑补齐缺失字段）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 视频字幕；底部；“通过PDF源文档，获取封面、作者、页数、大小等信息” | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 03-read-progress.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 每卡片底边；细横向进度条＋百分比 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 《认知觉醒》卡片；右下；“65%”“275 页” | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 作者空值提示；第二行多个卡片 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 底部视频字幕；“自动化阅读进度条” | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（原图没有进度算法，使用可验证且易修改的页码方案）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 04-open-pdf-from-shelf.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 《认知觉醒》封面卡片；右下；蓝色外轮廓 | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 书目卡片；封面、标题、作者缺省、275 页／2.95 MB／65% | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 视频字幕；“点击封面，即可进入到PDF源文档” | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 返回书架与记忆阅读页；本图无可见控件 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（静态图未呈现导航细节，使用已批准的单插件信息架构）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 05-target-doc-button.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 页区；中央；《认知觉醒》内容 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 工具栏；页区顶部；页码框“174 / 275” | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 工具栏图标；顶部左侧；目录、下拉箭头、缩小、放大等 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（保留需求明确的缩放、目录与适宽，使用清晰中文可访问名称）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 浮动方形按钮；PDF 右边中部；蓝色剪刀样式图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（采用批准的顶部目标选择器和裁剪按钮，后续图提供行为证据）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右侧宿主面板；上半导航快捷区、最近编辑文档，下半“Chat” | 范围排除；保留原理由，不删除P0–P3。 | 不做（宿主全局快捷导航与通用 AI 聊天外壳不属于本插件复刻范围；可选 AI 集成另实现）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| 左侧文件导航与 Obsidian 系统菜单 | 范围排除；保留原理由，不删除P0–P3。 | 不做（由 Obsidian 提供，不重复实现系统导航）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 06-drag-to-target.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 工具栏下拉菜单；页区上方中部；3 行 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 第一行 Canvas 菜单项；较亮背景、手形光标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（用原生文件选择器选已有或创建目标，明确显示目标类型与路径）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 工具栏；页码“174 / 275”、相邻图标与下拉箭头 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右侧页边蓝色浮动按钮；部分超出画面 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（采用独立、有名称的目标与裁剪入口，避免含义不明的浮动按钮）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 视频字幕；底部；支持拖拽文本到三种文档 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 07-toolbar-three-buttons.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左右分栏；左 PDF、右 Canvas；两栏均显示《认知觉醒》标签 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| PDF 顶部工具栏；174 / 275、缩放及下拉图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| Canvas 节点集合；右栏上半部；多个小卡片与连线 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 右侧竖向工具条；齿轮、＋、旋转箭头、适框、－、撤销、重做、帮助、链接等图标 | 范围排除；保留原理由，不删除P0–P3。 | 不做（复用 Obsidian Canvas 的导航编辑能力，不复制宿主工具条）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| Canvas 底部插入工具；3 个文件样式图标 | 范围排除；保留原理由，不删除P0–P3。 | 不做（画布插入工具由宿主提供，不能仅凭字幕认定为插件专有按钮）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| 页边蓝色图标与视频字幕“提供3个按钮” | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（按批准 brief 明确提供目标、高亮列表、裁剪入口）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 08-crop-button.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 文本层；左栏中段；连续约 4 行浅色选区 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 选区边界；跟随文字行的不同长度 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 页边蓝色按钮；PDF 右侧中部 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（裁剪模式另设明确状态、框选边界与取消操作）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右侧 Canvas；已有卡片集合未变化 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 09-drag-to-canvas.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 多行原文；左栏中段；浅黄背景 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| Canvas 摘录卡片；右栏中央；红色外框、暗底 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片标题；顶部；“Note20250718095424” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（保留自动标题和可编辑能力，不复制原版名称规则）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 原文来源链接；卡片正文末尾；“认知觉醒, p.174” | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 评论入口；来源链接下；铅笔图标、“评论：”、＋ | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 节点操作；卡片右上角对角箭头，外缘右上圆形－ | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（明确提供标题编辑与折叠操作，用中文名称和状态标识）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 拖动指针；卡片中下部；绿色＋徽标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 10-auto-highlight-comment-icon.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 页区；左侧；多段浅黄／浅绿色底色 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| Canvas 卡片；右上；沿用 Note 数字标题和链接／评论行 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 拖动预览；右侧中下部；文字预览与绿色＋ | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 高亮末尾评论图标；左侧高亮附近 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（本帧图标不可辨认，功能来自已批准需求而非本图推断）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 视频字幕；底部；“拖拽后，PDF原文将自动创建高亮颜色” | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 11-fold-unfold-nodes.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 多段高亮；左栏；浅黄背景、跨行 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| Canvas 节点群；右栏；3 张主要可见摘录卡片 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 连接线；从上方卡片到下方两卡；曲线箭头 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（原图没有连线生成时序，按批准章节模型实现自动归属）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片外缘右上圆形－；手形指针悬停 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 活动卡片上方浮动工具条；垃圾桶、色盘、定位框、编辑图标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片正文左侧细竖线与彩色标题 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（原版装饰性侧线与批准视觉禁令冲突，用间距及标题层级替代）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 视频字幕；“折叠/展开功能” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（先实现单个摘录节点正文折叠，保留标题与来源；递归行为无证据不假定）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 12-excalidraw-drag.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 右侧目标页面；路径末尾“认知觉醒.excalidraw”；白色画布 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 已实现；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| Excalidraw 顶部工具条；选择、矩形、菱形、圆、箭头、线、笔、文字、图片、橡皮 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（P2 目标集成调用已安装的 Excalidraw 原生绘图工具条；需验证实际打开及可继续手绘，不另造工具条）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 新摘录卡片；右侧靠左中部；文字、来源链接 p.176、评论＋ | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 左栏高亮；页码176附近段落；浅黄色多行 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 已实现；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 画布其他卡片；右缘；部分正常摘录，部分“在 认知觉醒 中未找到 …” | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（显示可恢复的失效目标状态，保留摘录文本和重新绑定入口）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 视频字幕；“执行选中、拖拽操作即可” | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（依据已批准数据约束自建 Excalidraw 引用映射）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |

## 13-excalidraw-handdraw.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF、右 Excalidraw；左右分栏 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 已实现；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 自由画笔按钮；右面板顶部；紫色活动底 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（P2 摘录落地后保留 Excalidraw 原生画笔能力；需在实际依赖插件中验证）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 右侧竖向笔工具组；多种笔尖与颜色，某一笔蓝紫底选中 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（依赖 Excalidraw 原生笔工具，桌面输入实际验收；Apple Pencil 未验证且不属于 isDesktopOnly 发布范围）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 摘录卡片来源与评论；多个白底细框卡片 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 画布底部缩放控件；“41%”、－、＋；旁有撤销／重做 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 已实现；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 视频字幕；“手绘、或添加手写批注或者注释等内容” | 范围排除；保留原理由，不删除P0–P3。 | 不做（不新增无直接证据的 PDF 原位墨迹写入；保留目标画布手绘集成）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 14-highlight-list-jump.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 高亮；左页多段浅黄；手形指针位于内容区 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 已实现；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| Excalidraw 摘录卡片；右侧中央大卡片；青色“认知觉醒, p.172” | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 已实现；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 画布缩放；底部“99%” | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（跳转时采用明确的居中与可见选中状态，缩放策略自研）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 错误引用卡片；右下及底部；“在 认知觉醒 中未找到 …” | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（给出目标失效提示并允许保留或重新绑定摘录）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 视频字幕；“这里显示为钢笔图标，说明点击高亮列表，将自动跳转到Excalidraw对应节点” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 15-recolor-highlight.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 高亮列表浮层；PDF 工具栏下方偏左；标题“高亮列表（42个）” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（批准 brief 要求右侧可收起抽屉，保留列表功能但不复制覆盖式布局）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 列表项页码；每条左上；“第178页”“第177页”圆角标签 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 目标类型图标；页码标签右侧；文档页图标／四格图标 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 摘录摘要；每条主体；多行原文，条目间分隔线 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 编号与颜色圆点；每条右上；“#42”等＋黄色圆点 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 条目左侧黄色细竖线 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（批准视觉禁令禁止 side-stripe border）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 高亮末尾；列表右侧仍可见的正文；灰色圆形气泡 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 视频字幕；“通过高亮列表，你还可以重新设定高亮颜色” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 16-comment-window.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 高亮；画面中部；两行紫色，周围段落黄色 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 评论气泡按钮；紫色高亮最后一行末尾；圆形、红色活动底、手形指针 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论浮层；源图标右侧；标题“评论（0条）”、右上× | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 空评论列表；浮层中部；“暂无评论，请在下方输入框中添加评论” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论输入框；浮层底部左侧；“输入新评论...”＋可见焦点轮廓 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（使用明确中文标签及键盘提交规则，并保留可见 focus ring）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 提交按钮；输入框右侧；深色方形＋ | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（空白内容禁用提交并以状态文本说明，避免创建空评论）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 视频字幕；点击高亮末尾图标原位打开评论窗口 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 17-comment-list.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 评论浮层；右侧；标题“评论（2条）” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论列表行；浮层中部；第一条“添加新的评论” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 日期标记；两条评论末尾；图钉样式图标＋“20250718” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（按已批准自动时间戳需求实现，原图只可见日期粒度）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 单条删除按钮；第一条左上侧；红圆白× | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 持续输入区域；列表下方；“输入新评论...”与＋ | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 源高亮与活动评论图标；浮层左侧；紫色高亮、红色气泡 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 删除交互的后续状态 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（删除反馈与恢复策略为自研交互空间）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 18-canvas-comment-plus.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 评论浮层；右侧；“评论（0条）” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论图标；紫色高亮末尾；灰色圆形气泡 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（以 aria-expanded、焦点与形状等明确表达打开状态，不只靠颜色）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 空态文案与输入框；浮层内；输入框聚焦、右侧＋ | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| Canvas 内评论＋控件 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 视频字幕；“还可以在canvas、Excalidraw，以及Markdown文档中进行评论” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 目标端评论的具体呈现 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |

## 19-comment-no-timestamp.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 工具栏；左上；页码 `177 / 275`、搜索、缩放等图标；常态 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 多行高亮及末尾小评论图标；PDF 正文；黄色与紫色；常态 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 摘录节点；右侧中央；青色标题 `Note20250718005311`、正文与 `认知觉醒, p.177` 链接；红色外框选中 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 评论行；节点正文下方；铅笔样式图标、`评论：`、`添加评论`、`1121212`、`+`；常态 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 选中节点浮动工具条；节点上方；垃圾桶、调色板、聚焦样式、编辑样式图标；可见 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 视口工具条；最右侧；设置、加减、适应视图、撤销／重做等；常态 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（复用 Obsidian 原生 Canvas 视口能力，插件只维护摘录映射与跳转）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 20-context-menu.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 原文选区；PDF 中部三行；灰绿色底色；已选中 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 选区上下文菜单；选区右下；三行菜单；展开 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 菜单项；第一行；`添加到Canvas文档` 与网格图标；未显示禁用文案 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 菜单项；第二行；`添加到Excalidraw文档（暂不支持）` 与笔形图标 | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（按用户 P2 要求实现 Excalidraw；缺少依赖时显示明确禁用原因，不沿用永久不支持）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 菜单项；第三行；`添加到Markdown文档` 与文档图标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 已有高亮评论入口；下方黄色正文末尾；小气泡样式图标 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 21-crop-mode.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 双栏阅读布局；左 PDF、右画布；两侧都显示文档名；常态 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| PDF 工具栏；左上；`178 / 275`、列表、搜索与缩放图标；常态 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| 裁剪入口；PDF 页面右缘中部；蓝色方形内剪刀样式图标；可见 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 自研替代（把裁剪入口放入用户指定的顶部工具栏；保留同等能力，不继承悬浮外观）；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| 黄色多行高亮；插图下方两段；部分段末带评论图标 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| Canvas 缩放及视图按钮；最右侧纵向；常态 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 自研替代（委托原生 Canvas 导航，目标面板自身由 Reading Desk 管理）；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |

## 22-drag-cropped-image.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 裁剪模式退出入口；PDF 插图右侧；橙色 `×`；显示 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| 拖拽反馈；Canvas 下部；鼠标旁绿色 `+` 与小矩形预览；拖拽中 | 真实trusted pointer框选准备PNG与手柄拖放到既有Canvas通过，PNG/node/normalized rect/章节保留；不扩张为云端上传。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；functional-gate.md |
| 新对象／临时卡片；右下；青色边框、`rect-selection-…` 文本与“裁剪模式”小标签；被选中或正在拖入 | 真实trusted pointer框选准备PNG与手柄拖放到既有Canvas通过，PNG/node/normalized rect/章节保留；不扩张为云端上传。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；functional-gate.md |
| 既有摘录节点；右上；标题、来源链接、`评论：`、评论文本、日期样式文本和 `+` | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 对象浮动工具条；新对象上方；删除、调色、聚焦和编辑图标 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |

## 23-object-storage-settings.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 设置对话框；居中大面板；顶部产品设置标题，右上 `×`；已打开 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（使用 Reading Desk 原生设置页或 Modal，不复制原产品名称与绿色标题）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 开关；上部；`启用对象存储`；开启 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 开关；第二行；`启用Markdown粘贴自动上传`；关闭 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 提供商下拉；中上右侧；`阿里云 OSS`；选中 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 配置说明块；下拉下方；OSS 控制台、AccessKey 管理链接及跨域／端点说明 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（重写最小权限配置说明和连接检查，避免无条件推广来源图中的公开桶／通配跨域建议）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 文本框；面板下半；`服务端点`；已填 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 文本框；端点下方；`区域`；已填 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 文本框；区域下方；`存储桶`；已填 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 凭据输入；更下方；`Access Key ID` 与 `Access Key Secret`；均有输入区，底部被字幕遮挡 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（提供 AK／SK 配置、默认遮掩、明确保存与测试反馈；错误文案及凭据保护方式自行设计）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |

## 23b-settings-entry.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| Obsidian 设置侧栏项；中间偏下；`PDF Flow`；未选中 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（注册 Reading Desk 单插件设置页，品牌与顺序不复用）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| 其他插件列表项；设置左栏；QuickAdd 行紫色悬停／选中背景 | 范围排除；保留原理由，不删除P0–P3。 | 不做（其他插件设置属于宿主，不在 Reading Desk 范围）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| 宿主设置正文；右侧；当前版本、自动更新、语言、获取帮助、账户等 | 范围排除；保留原理由，不删除P0–P3。 | 不做（不复制宿主通用设置；对象存储实际控件见图 23）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| 插件列表滚动条；设置侧栏右缘；细条；可见 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（沿用宿主可滚动设置导航）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |

## 24-image-host-external-link.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| Markdown 编辑区图片语法；页面中上；`![paste-…png](https://…aliyuncs.com/…png)`；整段显示选区底色 | MarkdownImagePasteService已接入真实editor paste入口，存储协议与host测试支持实现；无凭据时未声称真实云端外链可读。 | 已实现；CODE+TEST | test/storage/MarkdownImagePasteService.test.ts；test/storage/ObjectStorageService.test.ts；functional-gate.md |
| 图片预览；外链下方；一张 Obsidian 界面图片；紫色外框 | MarkdownImagePasteService已接入真实editor paste入口，存储协议与host测试支持实现；无凭据时未声称真实云端外链可读。 | 已实现；CODE+TEST | test/storage/MarkdownImagePasteService.test.ts；test/storage/ObjectStorageService.test.ts；functional-gate.md |
| 图片右下斜向双箭头指针；预览边缘；悬停 | MarkdownImagePasteService已接入真实editor paste入口，存储协议与host测试支持实现；无凭据时未声称真实云端外链可读。 | 自研替代（依赖宿主 Markdown 图片渲染与尺寸能力；上传后不额外叠加图片编辑器）；CODE+TEST | test/storage/MarkdownImagePasteService.test.ts；test/storage/ObjectStorageService.test.ts；functional-gate.md |
| 笔记标题／属性条；顶部；`未命名 1`、折叠箭头、部分标签；显示 | MarkdownImagePasteService已接入真实editor paste入口，存储协议与host测试支持实现；无凭据时未声称真实云端外链可读。 | 已实现；CODE+TEST | test/storage/MarkdownImagePasteService.test.ts；test/storage/ObjectStorageService.test.ts；functional-gate.md |
| 预览图片内部的文件夹、搜索、书签与彩色文件夹条目 | 范围排除；保留原理由，不删除P0–P3。 | 不做（不能把示例图片里的 UI 当作插件需求）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| 上方细横条；笔记属性下方；少量青色段 | MarkdownImagePasteService已接入真实editor paste入口，存储协议与host测试支持实现；无凭据时未声称真实云端外链可读。 | 自研替代（自行提供有文案的上传中／成功／失败反馈，不假定该细条就是上传进度）；CODE+TEST | test/storage/MarkdownImagePasteService.test.ts；test/storage/ObjectStorageService.test.ts；functional-gate.md |

## 25-split-screen-drag.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 阅读分栏；PDF 在左，点阵 Canvas 在右；浅色主题 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| PDF 缩略图导航；最左；页缩略图 `193` 至 `197`；可见 | 真实PDF页码/翻页实现；截图缩略图导航未复刻，明确采用当前单页导航而非伪称可见。 | 自研替代（当前采用具名页码、上一页/下一页导航；未复制截图缩略图侧栏，差异需在决策中保留）；CODE+VISUAL | src/views/ReaderView.ts::goTo；visual-confirm-light-reader-wide-focus.png |
| 原文多行选区；正文中部；灰绿色底色，手形指针停在末尾；已选中 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 既有高亮；选区上方；粉紫色多行高亮与末尾气泡 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 页面侧边裁剪入口；PDF 右侧边；蓝色剪刀图标 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 自研替代（我方将裁剪放在顶部工具栏并适配浅／深主题）；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| 目标 Canvas 既有卡片；右下；正文、来源链接、评论行；部分超出截图 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |

## 26-tag-add-window.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 原文高亮；放大的 PDF 正文；浅黄色跨四行；已存在 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 评论气泡按钮；最后一段高亮右上附近；粉红圆形内白色气泡；手形指针悬停 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 标签添加窗口／输入控件；预期为浮层；本图没有可见窗口 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（按用户要求在评论浮层内设计标签输入与补全；可见浮层证据见图 27）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 27-tag-autocomplete.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 评论浮层；高亮末尾右侧；浅色圆角面板；已打开 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 色点按钮；浮层左上；黄色圆点；当前高亮为黄色 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 擦除／删除样式图标；色点右侧；交叉笔／橡皮形图标 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（使用有明确可访问名称与确认语义的“删除高亮”入口；删除单条评论另设行内按钮）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 标签按钮；浮层顶行第三项；标签轮廓图标；指针在附近 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 标签 chip；浮层顶行；`#测试标签`；已存在 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论空态；面板中央；`暂无评论，请在下方输入框中添加评论` | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论输入与提交；浮层底部；`输入新评论...` 与独立 `+` 按钮；空值 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 标签自动补全；本帧仅字幕说明，无可见候选列表 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（实现基于已有标签的可键盘选择补全；候选列表样式、匹配与空结果按原生习惯设计）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 28-highlight-list-tags.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 单栏阅读区；整窗；浅色主题；右侧目标面板未显示 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 页码工具栏；顶部；`193 / 275`，列表按钮高亮；常态 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 页缩略图栏；左侧；193–198 等页；展开 | 真实PDF页码/翻页实现；截图缩略图导航未复刻，明确采用当前单页导航而非伪称可见。 | 自研替代（当前采用具名页码、上一页/下一页导航；未复制截图缩略图侧栏，差异需在决策中保留）；CODE+VISUAL | src/views/ReaderView.ts::goTo；visual-confirm-light-reader-wide-focus.png |
| 多行黄色高亮及灰色气泡；正文下半；高亮末端附近小图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 裁剪入口；PDF 右缘；蓝色剪刀样式图标 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| 高亮列表与其中标签；本帧未显示 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（按用户明确要求实现抽屉列表和标签行；具体可见证据需由其他参考图补足）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 宿主状态栏；右下；反向链接计数、主题及其他插件状态 | 范围排除；保留原理由，不删除P0–P3。 | 不做（不复制 Obsidian 或其他插件的状态栏功能）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 29-comment-window-color.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 评论浮层；高亮末尾右下；浅色面板、右上 `×`；展开 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 颜色入口；浮层左上；紫色圆点；当前可见 PDF 高亮仍浅黄色 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 删除样式图标；色点右侧；交叉笔／橡皮形；无 tooltip | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（明确标注“删除高亮”，不只靠图形传达后果）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 标签入口与两个标签；顶行；标签轮廓、`#测试标签`、`#认知` | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论空态；面板中央；“暂无评论，请在下方输入框中添加评论” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论输入及新增按钮；底部；`输入新评论...`、`+`；空输入 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（提供明确提交语义、空值禁用与键盘可达交互；细节按自研决策记录）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 30-crop-mode.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 双栏阅读；左 PDF、右 Canvas；浅色主题；均展开 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 页码工具栏与连续页；左上 `194 / 275`；上页末尾与下页开头同屏 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 蓝紫底色文本片段及末尾气泡；PDF 上半末段；可见 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 裁剪入口；上下页交界右缘；蓝色剪刀样式图标；无矩形选框 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| 摘录节点正文；右侧中央；粉色浅底、红框、文本及右上展开图标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 标签与来源链接；节点正文下；`#测试标签`、`#认知`、链形图标和 `p.193` | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论入口；标签下；铅笔图标、`评论：` 与方形 `+`；空评论 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 节点边缘 `−` 与 Canvas 视口工具条；右侧；可见 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（实现用户要求的摘录卡片折叠；宿主视口操作委托 Canvas，不假定该减号的内部实现）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 31-custom-category.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 书架视图切换；内容上方；`卡片视图` 蓝色选中、`表格视图` 未选中 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分类筛选 chips；视图切换下；`全部分类`、`默认分类`、`认知类`、`小说类`、`学习方法类` | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分组标题与汇总；封面墙上方；`默认分类（全部7本，阅读进度15%）` | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 自研替代（分类数量可直接计算；汇总进度公式由我方明确约定，避免把来源数值当作算法证据）；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 分类顺序控件；分组标题左侧；上下小箭头；常态 | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 书籍卡片；中部；封面、标题、作者、页数、大小与进度百分比 | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 书籍分类入口；卡片左上；标签轮廓小图标；常态 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 阅读进度；卡片底部；细条与 `3%`、`1%`、`0%`、`76%` 等；不同进度 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 下一分类分组；画面下方；`认知类（全部3本，阅读进度50%）` 与部分卡片 | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 书籍照片横幅；顶部大图；装饰性 | 范围排除；保留原理由，不删除P0–P3。 | 不做（用户明确要求独立视觉方向；不复制参考照片与装饰性横幅）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| 内容右上 `</>` 样式小图标；常态 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（图标用途未观察到；不猜测原行为，以已批准的具名导出入口承接我方书架操作）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 32-card-tag-icon.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 分类设置 Modal；书架中央；`设置PDF分类`；展开且背景模糊 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分类输入框；标题下方左侧；`请输入分类名称（留空为…`；焦点框 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（明确完整提示“留空使用默认分类”，保持可键盘编辑，不复制截断提示）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 现有分类选择区；输入下方；`现有分类：` 与四枚边框 chips | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 保存按钮；弹窗右下；`保存`；可见 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 取消与关闭；保存右侧 `取消`、右上 `×`；可见 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 当前书架背景；后方卡片与分类 chips；不可清晰交互 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 33-category-saved.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 视图切换；顶部；`卡片视图` 选中、`表格视图` 未选中 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分类 chips；切换按钮下；新增 `学术研究类`，另有全部／默认／认知／小说／学习方法 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 新分类标题；第一分组；`学术研究类（全部1本，阅读进度2%）` | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 已分类书籍；新分组唯一卡片；`PPT_01_Machine learning Basics`、作者、51 页、1.36 MB、2%；青色边框 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 默认分类汇总；第二分组；`全部6本，阅读进度17%` | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 分类上下移动图标；两处分组标题左；上／下箭头；可见 | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 卡片标签入口；卡片左上；标签轮廓；可见 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 34-category-reorder.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 分组排序控件；`默认分类` 标题左侧；上下箭头，指针在下箭头附近 | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 分组标题；当前最上可见组；`默认分类（全部5本，阅读进度21%）` | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 分类 chips；页面顶部；学术研究仍排在默认之前 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（我方使用单一持久化分类顺序，让导航与分组一致；这一规则须写入自主决策记录）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 书籍封面卡片；中部；5 本以 4+1 展示；元数据与百分比保留 | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |
| 视图切换；顶部；`卡片视图` 选中，`表格视图` 可用 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（两个书架表面共享分类顺序与同一排序能力）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 卡片分类图标；封面左上；红色标签轮廓 | 提取/缓存与vault资源URL均已修；真实封面 naturalWidth209–210、截图可见，V-02 resolved。 | 已实现；CODE+TEST+RUNTIME+VISUAL | visual-confirm-light-shelf-card.png；measurements-confirmation.json；test/library/MetadataExtractor.test.ts |

## 35-table-view.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 视图切换；顶部；`表格视图` 青色选中、`卡片视图` 未选中 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分类导航与分组标题；顶部和各表格上方；六枚 chips、`学术研究类（全部2本，阅读进度3%）`、默认分类 | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 表头；第一表格；图标 + `书名`、`作者`、`评价`、`进度`、`页数`、`大小`、`标签` | 当前表格七列（标题/作者/标签/评分/页数/大小/进度）真实可见，与新简洁表格顺序相符。 | 已实现；CODE+TEST+VISUAL | visual-confirm-light-shelf-table.png；src/views/ShelfView.ts::createTable |
| 书名链接；每行第一列；青色可换行标题 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 作者单元格；第二列；作者文本 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 评价单元格；第三列；十个星形位置分两行，每行五个；第二行书显示六个实心星 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 星级选择弹层；评价列下方；`选择评价星级：` 与 `(1星)` 至 `(9星)` 可见，`(6星)` 高亮 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（采用与十个星位一致的 0–10 评分，并明确清空入口；键盘交互与末项布局自行设计）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 阅读进度、页数、大小单元格；中间三列；`3%`、`33页`、`2.29 MB` 等 | 当前表格七列（标题/作者/标签/评分/页数/大小/进度）真实可见，与新简洁表格顺序相符。 | 已实现；CODE+TEST+VISUAL | visual-confirm-light-shelf-table.png；src/views/ShelfView.ts::createTable |
| 标签单元格空态；前两本书右列；斜体 `未设定` | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 标签单元格；默认分类书籍右列；多枚不同颜色 chips，如人生意义／心灵寓言／生活转向 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 表格行状态；第一表第二行；整行底色较亮，指针在评价单元格 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（明确 hover、focus 与正在编辑三个状态，不以颜色作为唯一标识）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 36-rating-cell.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 双按钮，顶部左侧；“卡片视图”“表格视图”；后者有实心背景 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分类 chips，切换按钮下；“全部分类”“学术研究类”“默认分类”“认知类”“小说类”“学习方法类” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（用有数量的分类筛选，并提供选中标记；静态图无法确定定位规则，且不复制配色）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分组标题及上下小箭头，表格前；“学术研究类（全部2本，阅读进度3%）”“默认分类（全部5本，阅读进度21%）” | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 七列表格；表头“书名／作者／评价／进度／页数／大小／标签” | 当前表格七列（标题/作者/标签/评分/页数/大小/进度）真实可见，与新简洁表格顺序相符。 | 已实现；CODE+TEST+VISUAL | visual-confirm-light-shelf-table.png；src/views/ShelfView.ts::createTable |
| 星级单元格，第三列；每格两行，每行五颗星；黄色实星与灰色空星并存 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（保留可编辑星级，提供明确数字标签与键盘操作；十星如何映射分值不可由截图确定）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 标签单元格，最右；空值“未设定”；多标签为换行彩色 pill | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 行交互状态；“心商”一行有横向较亮底色 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（分别定义 hover、键盘 focus 与 selected，不能只用颜色）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 右上角 `</>` 图标，无可读标签 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（未知功能不猜测；使用具名的书架导出入口承接已批准 P3）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 37-author-cell.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 顶部“卡片视图／表格视图”按钮；表格选中 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 分类 chips 与分类分组标题 | 分类chips/计数/单书分类/排序真实运行；连续分组/聚合进度是明确自研差异，记录为体验替代而非删除。 | 自研替代（用分类chips+数量、单书分类与持久化排序；不复制参考连续分组聚合进度，逐书阅读进度保持）；CODE+TEST+VISUAL | src/views/ShelfView.ts::createCategoryPanel；visual-confirm-light-shelf-card.png |
| 作者单元格，表格第二列；“RobertMurphy”“LaTeXwithBeamer”“约翰·史崔勒基”“阿尔贝·加缪”“pdftk-java3.3.2” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（使用可取消／保存的作者编辑器，保留自动提取与用户覆盖值；编辑器形态由我方定义）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 星级、进度、页数、大小等只读显示状态 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 标签空值与标签 pill | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 作者编辑控件的输入、校验、保存、取消状态 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（定义空值、焦点、保存、取消与错误反馈，不声称还原原版未出现的编辑器）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 38-tag-cell.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 居中模态框；标题“设置自定义标签”；背景书架被遮罩及模糊 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 单行输入框，模态中央；占位“请输入标签，用逗号分隔（如：技术,编程,JavaScript）”；带明显紫色边框 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（保留批量标签输入，采用新文案与主题 focus ring；可采用 chips 输入，避免模仿原视觉）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 输入下帮助文本；“提示：多个标签用逗号分隔，留空表示无标签” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 模态右下“保存”“取消”按钮；右上关闭 X | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（保留显式保存与取消；我方补 Escape 关闭、focus trap 与关闭后焦点返回）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 背景表格最右侧标签列 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 标签自动补全、重复标签处理、错误提示 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（书架标签做 trim／去空／去重；高亮标签自动补全由明确 P1 需求另行实现）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |

## 39-share-plan.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| “表格视图”选中按钮、分类 chips、两组书籍表格 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 学术组第二本最右标签单元格；黄色 pill“学术” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 第二本评价单元格；手形光标；整行背景变亮 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（评价控件保留清晰 hover／focus；整行 hover 与单元格操作需要分层反馈）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 右上 `</>` 图标 | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 自研替代（未知功能不猜测；使用具名的书架导出入口承接已批准 P3）；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 底部视频字幕提到“后续我们将提供分享功能” | 范围排除；保留原理由，不删除P0–P3。 | 不做（原版未来分享计划非可观察功能；我方仍按 P3 实现 Markdown／JSON 导出）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 40-open-from-cover.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 顶部 Obsidian 文档 tab“认知觉醒”；路径“Books / pdf书籍 / 认知觉醒” | ShelfView/LibraryIndex已落地并经full verify；真实书架卡/表格、分类计数/编辑入口、评分1–10、阅读进度可见；动作持久化以测试层标注，不冒称每单元格均手动复测。 | 已实现；CODE+TEST+VISUAL | test/views/shelf/ShelfViewModel.test.ts；test/library/LibraryIndex.test.ts；visual-confirm-light-shelf-table.png |
| 页码输入，顶部工具栏；当前约“271 / 275”，输入框聚焦／光标覆盖部分数字 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 工具栏左侧目录／下拉、缩小、放大、下拉按钮 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（提供有中文可访问名称的目录、缩放、适宽控件；不复制未知菜单项）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 页码后笔形工具、双页形工具及下拉 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（按已确认需求提供高亮与布局功能，不据图标臆测额外工具）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 大幅 PDF 页区，白页黑字，中文参考文献跨行显示；右侧细滚动条 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 页右中悬浮蓝色小方块图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（未知功能不猜测；使用已批准的具名工具栏入口）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| Obsidian 全局 ribbon、窗口按钮、底部状态栏、系统菜单栏 | 范围排除；保留原理由，不删除P0–P3。 | 不做（由 Obsidian／操作系统提供，插件只接入宿主）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 41-drag-to-canvas.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF、右 Canvas 的双栏；两侧 tab 都是“认知觉醒” | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| PDF 页码工具栏“20 / 275”、缩放与下拉图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 正文与插图，左栏；无可见拖拽影像或选区 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 右侧空白 Canvas 工作区；手形指针位于中央 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（空目标提供简洁拖放引导与键盘摘录入口，画布平移交由宿主）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 右侧竖排按钮；齿轮、加、环形箭头、框选、减、撤销、重做、问号、链条等 | 范围排除；保留原理由，不删除P0–P3。 | 不做（宿主 Canvas 原生工具无需重造；插件只实现摘录与关联所需接入）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| Canvas 底部中央三个图标；空白页、文本页、图片 | 范围排除；保留原理由，不删除P0–P3。 | 不做（宿主工具；我方摘录卡片走明确的 TargetService 创建流程）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| Canvas 上方属性条；“无反向链接”“笔记类型”“未检测到任何已有属性值” | 范围排除；保留原理由，不删除P0–P3。 | 不做（宿主或其他扩展的属性栏，不构成 Reading Desk 的可观察要求）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 42-right-click-add.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF、右 Canvas；页码“21 / 275” | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 上页末尾“第四”段落底部淡黄色区域 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 两页交界附近蓝色圆形省略号小控件 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（选区与高亮操作使用有名称的控件，不依赖未知省略号语义）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右 Canvas 远景；多张淡红色矩形节点散布，内容不可读 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| “右键添加到白板”流程（本图没有展开菜单） | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（按已确认需求提供右键摘录入口和确定的默认落点；菜单文本及坐标规则由我方定义）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 竖向工具栏与底部创建图标 | 范围排除；保留原理由，不删除P0–P3。 | 不做（沿用宿主 Canvas 能力）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 43-card-link-jump.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF 页码“268 / 275”；标题“后记 共同改变，一起前行” | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右 Canvas 上部摘录卡片内的青色“p.268”链接；手形指针指向该链接 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 右侧中部摘录卡片；另含“p.20”来源链接 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 中部卡片上沿独立彩色标题入口“点击添加标题” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（保留摘录标题能力，使用我方文案与可访问编辑入口）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片内“评论：”与加号按钮 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 卡片上方浮动工具条；垃圾桶、调色板、取景框、铅笔 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（只接入已明确的删除、换色、聚焦、编辑能力，并提供可访问名称）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片右边小圆形减号；正文框彩色边框与浅色填充 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 44-chapter-tree.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 浅色 Canvas 网格背景；章节节点从左向右用曲线箭头连接 | 真实PDF outline生成全目录nodes/edges且最深章节归属通过；空Canvas重复生成幂等，证据来自最终functional gate。 | 已实现；CODE+TEST+NATIVE | functional-outline-nodes.json；functional-native-acceptance.md |
| 章级小矩形节点；可读“第一章 大脑——一切问题的起源”，下方第二章节点部分可读 | 真实PDF outline生成全目录nodes/edges且最深章节归属通过；空Canvas重复生成幂等，证据来自最终functional gate。 | 已实现；CODE+TEST+NATIVE | functional-outline-nodes.json；functional-native-acceptance.md |
| 节级小矩形节点；可读“第一节 大脑：重新认识你自己”等；顶部节点青色描边较强 | 真实PDF outline生成全目录nodes/edges且最深章节归属通过；空Canvas重复生成幂等，证据来自最终functional gate。 | 已实现；CODE+TEST+NATIVE | functional-outline-nodes.json；functional-native-acceptance.md |
| 节点侧面圆形绿色加号和灰色减号 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（按树节点展开／折叠实现，使用可访问状态及稳定布局，不只以颜色表示）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 选中章节节点上方工具条；垃圾桶、调色板、取景框、铅笔 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 右下摘录正文卡片，顶部“点击添加标题”，末尾来源链接“p.51” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 画面底部黑色快捷键叠层（修饰键符号 + D） | 范围排除；保留原理由，不删除P0–P3。 | 不做（不得据按键叠层杜撰原版快捷键；我方快捷键作为自研决策另定）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 45-chapter-tree-left.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 Canvas／右 PDF 分栏，浅色主题；双侧文档 tab | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（已确认 brief 的 split 默认 PDF 左、目标右；允许宿主重排或提供交换布局选项）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 内从根、章、节到右边摘录卡片的连线树 | 真实PDF outline生成全目录nodes/edges且最深章节归属通过；空Canvas重复生成幂等，证据来自最终functional gate。 | 已实现；CODE+TEST+NATIVE | functional-outline-nodes.json；functional-native-acceptance.md |
| PDF 顶部缩放数字“93%”、页码“21 / 275”、左右缩放图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 顶部五个圆形色块，黄、红、蓝、绿、紫横排 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 色盘后列表形图标及下拉、双页形及下拉、树／对齐形、剪切形图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（将已确认的高亮列表、布局、章节树和裁剪功能用带名称按钮表达，不复制未知菜单）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 正文区，无明显选中文字状态 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（采用 outline 的最近先行章节及稳定节点引用，作为我方明确决策）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 节点上的加／减按钮、浮动节点工具条与宿主画布工具 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 46-highlight-palette-drag.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 Canvas 章节树、右 PDF；PDF 工具栏“93%”“16 / 275” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| PDF 工具栏五色圆点；手形光标正指向红色圆点 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 上页中段黄色跨行高亮 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 下页正文一组灰绿色文本选中／高亮块；末尾橙色圆形省略号 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（将选区、持久高亮、评论入口明确分层；末端评论按钮用可访问名称，避免状态混淆）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 左侧章节节点分支、画布右缘仅部分露出的摘录卡片 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| PDF／Canvas 边缘彩色小圆点 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（已批准高亮抽屉承担检索与跳转；额外边缘标记不推断原语义）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 47-highlight-color-match.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 右 PDF 页码“17 / 275”；正文内粉红、青蓝、淡紫三组高亮 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 左 Canvas 对应粉红、青蓝、淡紫正文卡片；边框、浅底、标题条同色系 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片标题入口“点击添加标题”；来源链接“p.17”；评论小图标和加号 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 章节节点到摘录卡片的箭头连线 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片正文左侧竖直绿色细线 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（已确认设计禁用 side-stripe border；以留白、文本层级、来源行表现摘录，不复制该侧线）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 右 PDF 淡紫高亮末尾橙色三点圆形图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 工具栏五色圆点，紫色圆点外圈较明显 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（颜色选择提供单选语义、选中标记与中文颜色名称）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 48-focus-node.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF／右 Canvas 双栏，PDF“22 / 275”，缩放“93%” | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 左 PDF 中部绿色跨行高亮；末尾细小圆形评论样图标 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 右 Canvas 中部绿色卡片；内容与高亮吻合，来源“p.22” | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（聚焦采用宿主支持的节点定位或稳定滚动，动画曲线不构成还原要求）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 绿色卡片标题入口“点击添加标题” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片正文来源页码链接、铅笔样评论图标、加号按钮 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 卡片右上斜向扩张箭头、右缘圆形减号 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（保留明确的聚焦和折叠动作；未知斜箭头不单独复刻）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 49-node-title.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF 第 22 页绿色高亮；右 Canvas 同一绿色摘录卡片 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 绿色卡片上沿单行标题输入框，约与卡片同宽；内容为临时拉丁字母，插入光标可见 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 输入框下面中文输入法候选栏 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（正确处理 compositionstart／compositionend，系统候选栏由 OS 提供）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 相邻紫色和红色卡片仍显示“点击添加标题” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 绿色卡片正文、p.22 来源链接、评论加号保持可见 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 标题提交／取消控件、最大长度、空值恢复、保存时机 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（定义 Enter 保存、Escape 取消、IME 组合保护和可见操作提示，空标题恢复默认入口）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 50-fold-nodes.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 右 Canvas 展示一个节节点“第一节 大脑：重新认识你自己”与五张右侧摘录卡片 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 节节点右侧小圆形减号；卡片右侧也有小圆形减号 | 真实PDF outline生成全目录nodes/edges且最深章节归属通过；空Canvas重复生成幂等，证据来自最终functional gate。 | 已实现；CODE+TEST+NATIVE | functional-outline-nodes.json；functional-native-acceptance.md |
| 五张摘录卡片，黄、红、青、紫、绿各一；具有来源页码与评论加号 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 最下绿色卡片标题为自定义拉丁字母串；其余为“点击添加标题” | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 左侧 PDF 绿色高亮与末端评论样图标，仅局部可见 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 折叠后的紧凑形态、标题是否保留、折叠范围和恢复坐标 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（折叠保留标题／来源摘要、稳定节点 id 与连线；展开恢复正文，不破坏摘录关系）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 51-pdf-canvas-link.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 工具栏；“93%”“51 / 275”、五色圆点、列表及其他图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 正文跨多行黄色高亮，末尾白色细边评论气泡图标 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 高亮附近浮动评论卡，覆盖部分正文；无全屏遮罩 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 浮层顶部左侧黄色圆点、红叉覆盖的图标、标签样图标；右侧关闭 X | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（按已确认功能提供具名的颜色、删除、标签与关闭按钮，不仅靠图标猜测）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 浮层列表区文本“暂无评论” | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 浮层下方输入框，有焦点边框；正在输入拼音；系统 IME 候选栏遮挡下沿 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（使用带显式发送按钮的评论输入，支持 IME、键盘提交与错误反馈，时间戳按已确认 P0 实现）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右侧仅部分可见 Canvas 节点树；底部字幕称快速跳转聚焦对应节点位置 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 底部黑色退格键图示叠层 | 范围排除；保留原理由，不删除P0–P3。 | 不做（系统／视频叠层不复制）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 52-cards-on-canvas.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF／右 Canvas 分栏；两侧文档为“打造第二大脑” | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| PDF 左侧缩略图导航栏；显示 194、195、196、197、198、199 等页缩略图 | 真实PDF页码/翻页实现；截图缩略图导航未复刻，明确采用当前单页导航而非伪称可见。 | 自研替代（当前采用具名页码、上一页/下一页导航；未复制截图缩略图侧栏，差异需在决策中保留）；CODE+VISUAL | src/views/ReaderView.ts::goTo；visual-confirm-light-reader-wide-focus.png |
| PDF 页码输入“194 / 209”、缩放加减与下拉、笔形图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（按已确认 brief 统一工具栏结构，响应宽度变化但不按历史截图复制多个互斥工具条）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 正文末段黄色高亮，下一页开头也有黄色段落 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右 Canvas 全局远景，数十张粉红色卡片分散排列 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 右侧竖排缩放／撤销等工具；底部空白页、文字页、图片图标 | 范围排除；保留原理由，不删除P0–P3。 | 不做（Canvas 原生工具由宿主提供）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| Canvas 顶部属性条“笔记类型”“未检测到任何已有属性值” | 范围排除；保留原理由，不删除P0–P3。 | 不做（不复制其他扩展／宿主的属性编辑器）；EXCLUDED | reference-a/b/c/d.md；用户brief |
| PDF 正文右侧蓝色小方块悬浮图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（采用已批准具名入口，不将未知图标猜作新功能）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 53-card-auto-height.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 页码输入与总页数，左上 `194 / 209`；缩放和菜单图标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 缩略图栏，左侧有 194–199 页及部分下一页 | 真实PDF页码/翻页实现；截图缩略图导航未复刻，明确采用当前单页导航而非伪称可见。 | 自研替代（当前采用具名页码、上一页/下一页导航；未复制截图缩略图侧栏，差异需在决策中保留）；CODE+VISUAL | src/views/ReaderView.ts::goTo；visual-confirm-light-reader-wide-focus.png |
| PDF 多行淡色高亮，左侧正文下部 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| Canvas 文本摘录卡片，右侧；顶部 `点击添加标题`，内部原文、页码链接、`评论：` 及加号 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| Canvas 点状背景、右侧工具列、底部文档/图片样式按钮 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（复用 Obsidian Canvas 目标表面，不另造整套画布编辑器）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 顶部 `笔记类型` 与 `未检测到任何已有属性值` | 范围排除；保留原理由，不删除P0–P3。 | 不做（参考生态通用属性栏，不在 Reading Desk 功能清单）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 54-split-layout.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF / 右 Canvas 两栏，中间竖向分界 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| PDF 正文淡色高亮，多段跨行 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 新摘录卡片，右栏中左下，顶部 `点击添加标题`，页码链接、评论加号 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 左上页码 `194 / 209`、PDF 缩略图栏；右侧 Canvas 缩放工具 | 真实PDF页码/翻页实现；截图缩略图导航未复刻，明确采用当前单页导航而非伪称可见。 | 自研替代（当前采用具名页码、上一页/下一页导航；未复制截图缩略图侧栏，差异需在决策中保留）；CODE+VISUAL | src/views/ReaderView.ts::goTo；visual-confirm-light-reader-wide-focus.png |

## 55-right-click-menu.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 单栏 PDF 主区，无右侧目标面板 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| PDF 文本选区，正文首段浅绿色多行矩形 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 选区右键菜单，正文中部，`添加到Canvas文档` | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 同菜单 `添加到Excalidraw文档（暂不支持）` | 官方Excalidraw2.27.3能打开新正式scene，highlightId反查live元素并精确focus通过，sourceURI经系统→Reader通过；特定原生点击手势未证明，保留限制。 | 自研替代（用户 P2 明确要求可运行 Excalidraw，实施 highlightId 映射，不继承参考版本限制）；CODE+TEST+NATIVE | functional-excal-011-fresh-scene.json；functional-excal-final-focus-pass.json；functional-native-url-action-result.json |
| 同菜单 `添加到Markdown文档` | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 选区附近蓝色省略号圆标、页面右缘蓝色小方标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（使用有可访问名称的明确入口；未知图标行为不照搬）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 56-double-click-focus.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF 淡黄色原文高亮，首段；文末小圆标 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 右 Canvas 被放大的摘录节点，顶部超出可视区 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 摘录卡片底部链形图标 + `p.193`，`评论：` + `+` | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| 右下图片摘录卡片，菱形图示、`p.153`、评论加号 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |
| PDF 工具栏 `194 / 209`，正文同时露出相邻页 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（自研统一一基页码与明确当前页判定，截图不足以还原内部算法）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 57-reverse-jump-link.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 左 PDF 高亮原文，右 Canvas 缩小的多张卡片 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 右栏卡片正文末尾链形图标 + `p.193` / `p.194` / `p.147` / `p.153` | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 卡片顶部标题条，多数 `点击添加标题`，另有已填数学表达式样式标题 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 多个卡片 `评论：` 后 `+`；Canvas 手形光标 | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |

## 58-comment-window.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 跨行黄色高亮与靠末尾的评论触发区域 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论浮层，跨 PDF / Canvas 分界附近；顶部黄色色点、删除样式叉图标、标签图标，右上关闭 `×` | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论列表空态，浮层中部 `暂无评论，请在下方输入框中添加评论` | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 评论输入框，底部 `输入新评论...`，旁边 `+` 按钮 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 右侧 Canvas 摘录卡 `评论：` + `+` | 目标卡片已有“评论 +”入口并写入共享 AnnotationStore；参考原生Canvas评论外观不复制，差异留作自研替代。 | 自研替代（目标侧使用 ExcerptTargetPanel + AnnotationStore 评论入口；不复制参考 Canvas 原生评论外观）；CODE+TEST+NATIVE | src/ui/targets/ExcerptTargetPanel.ts；src/targets/CanvasTargetAdapter.ts::excerptText |

## 59-tag-add.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 同段原文淡紫色多行高亮 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 小型标签浮层，PDF 与 Canvas 分界附近；聚焦输入框 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 自研替代（多标签输入采用明确逗号分隔提示与已有标签建议，原图截断部分不猜测）；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 标签浮层右侧 `添加` 按钮 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 标签建议 / 自动补全状态 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |

## 60-delete-highlight.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 中部淡紫色高亮，顶部页码 `153 / 209` | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 评论浮层删除按钮 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| Canvas 已选图片卡片，右下较深边框；上方悬浮工具条有垃圾桶、调色盘、聚焦样式、编辑样式图标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（保留宿主 Canvas 的节点工具条，不复刻其按钮外观）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 左缩略图栏与右侧目标多卡片 | 真实PDF页码/翻页实现；截图缩略图导航未复刻，明确采用当前单页导航而非伪称可见。 | 自研替代（当前采用具名页码、上一页/下一页导航；未复制截图缩略图侧栏，差异需在决策中保留）；CODE+VISUAL | src/views/ReaderView.ts::goTo；visual-confirm-light-reader-wide-focus.png |

## 61-reverse-delete.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| Canvas 已选摘录文本卡，右中部；顶部悬浮垃圾桶 / 调色盘 / 聚焦 / 编辑样式工具条 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 左侧 PDF 正文页处于大面积空白，缩略图正常、页码 `193 / 209` | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 自研替代（提供明确 PDF 加载状态，反向删除用标注记录及重绘结果验证）；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 被选卡的链形页码链接，手形光标在附近 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| Canvas 删除后的 PDF 反向清理结果 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 62-crop-mode.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| PDF 正文右缘小方形按钮，橙色活动外观，鼠标指向 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| PDF 图示区域，左上菱形图与文字 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 自研替代（使用归一化 PDF 坐标框选层，明确取消 / 完成操作）；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| 分栏 Canvas 目标，右下已有文本和图片卡片 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |
| PDF 页码 `153 / 209`、缩略图与翻页工具 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |

## 63-object-storage.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 宿主设置模态，左侧插件导航，右侧参考插件设置页 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（Reading Desk 使用自己的中文设置页与品牌，不继承参考插件名称）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `启用对象存储` 开关，右侧开启 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `启用Markdown粘贴自动上传` 开关，关闭态 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `对象存储提供商` 下拉，当前 `腾讯云 COS` | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| COS 配置帮助段，多步文字与控制台链接 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（提供最小必要权限与连接诊断说明，避免照搬参考环境权限策略）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `服务端点`、`存储桶` 文本字段，值打码 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `Access Key ID`、`Secret Access Key` 文本字段，值打码 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（凭据输入隐藏显示，保存及日志脱敏由自研安全策略明确）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `Region` 字段 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 自研替代（为 OSS / COS 增设明确 Region 字段，满足任务要求）；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `配置诊断` / `预期访问地址`，URL 部分打码，以 `/example.png` 结尾 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `对象存储路径` 输入框，值 `clipper/` | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |
| `测试连接` 按钮，位于设置页底部可视区 | ReadingDeskSettingTab字段/开关/禁用原因/连接入口真实独立窗可见；ObjectStorageService OSS/COS签名oracle通过。真实账号上传受凭据限制，设置层级V-08已确认通过。 | 已实现；CODE+TEST+VISUAL | visual-confirm-settings-probe.json；visual-confirm-dark-settings.png；functional-repro-second-fix-result.json |

## 64-right-click-to-canvas.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 单栏 PDF，页码 `142 / 209`，左缩略图 141–146 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 正文右缘蓝色剪裁图标按钮 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |
| 底部字幕 `现在它已经来了` | 范围排除；保留原理由，不删除P0–P3。 | 不做（说明字幕并非产品控件，不转化成独立需求）；EXCLUDED | reference-a/b/c/d.md；用户brief |

## 65-title-bar.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 右中摘录卡片顶部外置标题条，`点击添加标题` | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 摘录卡正文、链形图标 `p.142`、`评论：` 与加号 | CommentPopover/HighlightList/AnnotationStore已实现评论/标签/颜色/删除与状态，组件host测试覆盖，真实评论时间戳和抽屉已见；V-05/V-06/V-09已由分轮独立视觉确认关闭，datalist物理选择未单独证明。 | 已实现；CODE+TEST+RUNTIME+VISUAL-LIMITED | test/ui/comments/CommentComponents.test.ts；test/annotations/AnnotationStore.test.ts；visual-confirm-dark-reader-750-drawer.png |
| 摘录卡右上边缘小圆形减号 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| PDF 页码 `142 / 209`，正文跨行高亮；左右分栏 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |

## 66-edit-title.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| Canvas 多张文本卡片，右侧主体，截图整体运动模糊 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 顶部某卡悬浮工具条，四个图标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（复用宿主 Canvas 工具条；不实现模糊图像中无法确认的额外按钮）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 标题编辑输入框 / 提交 / 取消 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（标题使用可键盘操作的内联输入，Enter 保存 / Escape 取消，需运行验收）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 左 PDF 高亮与右侧 Canvas 工具列 | 真实Reader canvas/text层/normalized高亮、focus/split、页码缩放已落地；窄pane适宽V-03已独立确认client=scroll，加载/异常不夸大为所有设备验证。 | 已实现；CODE+TEST+VISUAL | test/reader/PdfSelectionGeometry.test.ts；test/reader/ReaderSessionState.test.ts；visual-confirm-light-reader-wide-focus.png |

## 67-blank-card-no-title.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 右侧 Canvas 空白视口，点状背景与鼠标箭头 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| “空白卡片无标题”所需卡片本体 | ExcerptTargetPanel、CanvasTargetAdapter已落地；标题保存、fold72/unfold240、既有普通节点不扩展、摘录最深章节归属有原生/适配器证据；完整目录树单列未闭。 | 自研替代（只给拥有 Reading Desk 摘录元数据的节点提供标题入口，遵守用户已确认范围）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 左 PDF 被截断的正文、高亮和蓝色裁剪按钮 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |

## 68-right-click-card-no-title.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 两个空文本节点，右侧 Canvas 中部，以箭头连接；左节点青色选中边框、右节点橙色 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 已实现；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 已选节点右键菜单，`聚焦当前卡片`、`创建子节点`（选中高亮，部分被光标挡住）、`编辑`、`转换为笔记……`、`移除` | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（依托宿主 Canvas 通用操作，Reading Desk 仅提供摘录映射相关行为）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 节点上方四按钮工具条：垃圾桶、调色盘、聚焦样式、编辑样式图标 | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（通用工具条及折叠交互复用 Canvas，摘录标题保持独立元数据能力）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 左 PDF 局部正文、高亮与裁剪按钮仍显示 | CropSelectionOverlay+PdfRenderer真实pointer框选、PNG生成、Canvas目标产物通过；裁剪专门drag手势单列计划，云上传凭据受限。 | 已实现；CODE+TEST+RUNTIME | .obsidian-debug/reader-runtime-smoke-20260918-1500.md；test/ui/crop/CropGeometry.test.ts；functional-gate.md |

## 69-canvas-node-ai-edit.png

| 控件 / 参考状态 | 我方落地、差异与范围 | 状态 / 证据层级 | 证据 |
|---|---|---|---|
| 全宽 Canvas，顶部路径含 `Canvas / Mermaid 使用示例` | AiIntegrationService与main bridge接入、可用/禁用理由及真实设置入口存在，AI host接线测试通过；不冒称模型会话效果或69参考图存在对话。 | 已实现；CODE+TEST+RUNTIME | test/ai/AiIntegrationService.test.ts；functional-host-integration-second-result.json；visual-confirm-dark-settings-bottom.png |
| 左上已选文本节点，绿色边框，标题 `1. 流程图 flowchart`；旁边有相同内容节点 | AiIntegrationService与main bridge接入、可用/禁用理由及真实设置入口存在，AI host接线测试通过；不冒称模型会话效果或69参考图存在对话。 | 已实现；CODE+TEST+RUNTIME | test/ai/AiIntegrationService.test.ts；functional-host-integration-second-result.json；visual-confirm-dark-settings-bottom.png |
| 多张知识节点：`3. 甘特图 gantt`、`2. 时序图 sequenceDiagram`、`4. 饼图 pie` | Canvas/Markdown/Excalidraw目标实现存在；trusted跨行拖放、真实右键、精确Canvasfocus、原生回链、反删重绘、源rename/delete已证；不把插件摘要面板当原生画布。 | 自研替代（使用宿主 Canvas / Markdown 渲染能力，不实现专用 Mermaid 编辑器）；CODE+TEST+NATIVE | functional-native-acceptance.md；functional-final-fold-72.json；functional-final-reverse-delete.json；test/targets/TargetService.test.ts |
| 字幕 `您可以选中节点卡片，在工具栏直接点击按钮` | AiIntegrationService与main bridge接入、可用/禁用理由及真实设置入口存在，AI host接线测试通过；不冒称模型会话效果或69参考图存在对话。 | 自研替代（根据 P3 明确需求实现可选 AI 插件检测及明确的“发送到 AI”入口，不猜测参考生态私有接口）；CODE+TEST+RUNTIME | test/ai/AiIntegrationService.test.ts；functional-host-integration-second-result.json；visual-confirm-dark-settings-bottom.png |
| AI 对话窗 / 提示词输入 / 应用编辑结果 | AiIntegrationService与main bridge接入、可用/禁用理由及真实设置入口存在，AI host接线测试通过；不冒称模型会话效果或69参考图存在对话。 | 自研替代（上层 AI 插件存在且提供受支持接口时启用；无依赖时禁用并说明原因，避免假集成）；CODE+TEST+RUNTIME | test/ai/AiIntegrationService.test.ts；functional-host-integration-second-result.json；visual-confirm-dark-settings-bottom.png |

## 当前仍计划中的控件

以下不是泛化待办，而是对照时确认缺少全部落点或仍有具体失败的行：


覆盖核验：70图 / 418行；状态计数：{'已实现': 247, '自研替代': 148, '不做': 23}。原23项范围排除保持不变；没有把失败范围用“自研决策”静默删除。
