# PDF Flow 对标：Reading Desk Canvas 卡片生成原型说明

## 结论

PDF Flow 的关键不是“在右侧列出摘录”，而是把选中的 PDF 原文写入真实 Canvas，生成可继续整理的节点。Reading Desk 当前实现已经覆盖这条链路；本原型用于把这条链路从视觉上表达清楚。

## 功能对照

| PDF Flow 参考能力 | Reading Desk 当前实现 | 原型需要表达的开发语义 |
|---|---|---|
| 选中 PDF 文本后拖拽到右侧目标 | `ReaderView` 写入 `text/plain` 与归一化 `rects[]`，目标面板支持 drop | PDF 选区是拖拽源，Canvas 是真实落点 |
| 自动创建 Canvas 节点 | `TargetService.writeExcerpt()` → `writeCanvasExcerpt()` 写入 `.canvas` JSON node | 节点应呈现为 Canvas 原生文本卡片，而不是插件列表行 |
| 自动创建 PDF 高亮与评论入口 | `AnnotationStore` 保存高亮；Reader 重绘高亮并提供评论入口 | PDF 高亮、Canvas 卡片和评论入口共享同一 palette key |
| PDF 颜色与 Canvas 节点颜色一致 | `CanvasTargetAdapter` 使用共享 `READING_DESK_PALETTE` | 绿色/琥珀/梅色等颜色是锚点身份；不能只靠颜色表达状态 |
| 根据 PDF 大纲生成章节树 | `syncCanvasOutline()` 原子、幂等地创建 `readingDesk.kind=chapter` 节点和 chapter edges | Canvas 中章节节点位于卡片上游，摘录卡挂到所属章节 |
| 卡片高度随原文长度变化 | `excerptHeight()` 根据文本与宽度计算；折叠时压缩为紧凑高度 | 不做等高卡片；短摘录、长摘录和折叠态要同时可见 |
| 摘录卡片标题 | `createCardTitle()` 与 Canvas node text metadata 支持标题 | 标题只属于 Reading Desk 摘录节点，不扩散到普通 Canvas 节点 |
| 卡片折叠 / 展开 | `folded` metadata 与高度更新已支持 | 用原生 Canvas 节点的折叠语义表达，不伪造思维导图 |
| 卡片中回到 PDF 原文 | `createSourceLink()` 写入原文 URI；宿主负责定位 | 卡片底部显示“原文第 42 页”链接，点击可回到 PDF 高亮 |
| PDF 高亮反向聚焦 Canvas 节点 | `focusHighlight()` / `showTarget(path, objectId)` | PDF 双击高亮后，右侧 Canvas 聚焦对应 nodeId |
| 删除 Canvas 摘录后反向删除高亮 | `removeMissingTargetHighlights()` 对账并回写 `AnnotationStore` | 节点删除是持久化闭环，不只是视觉删除 |
| 裁剪图片拖入 Canvas | `CropDragTransport` 与 `commitPreparedCrop()` 已支持 | 本原型暂不展示裁剪态，避免抢占文本摘录主路径 |

## 本张原型的范围

- 主场景：左侧 PDF 目录 / 中间 PDF 原文 / 右侧真实 Canvas 目标。
- 保留 v2 已确认的“缩略图 / 目录”切换，以及“适合宽度 / 适合高度”。
- 右侧不再画“摘录目标列表”；改为点阵 Canvas 视口。
- Canvas 中展示：章节节点、三张不同高度的摘录卡、节点连线、卡片标题、页码原文链接、评论加号和一个折叠态节点。
- 用一个轻量的“已创建 Canvas 卡片”反馈表达拖拽落点，不画夸张动画或营销式提示。

## 实现边界

右侧 Canvas 是 Obsidian 的真实目标表面；Reading Desk 只负责写入带 `readingDesk` metadata 的节点、章节边和原文链接，不仿制 Canvas 的全部编辑器。普通 Canvas 节点仍由宿主处理，只有 Reading Desk 摘录节点拥有标题、折叠和 PDF 反向定位语义。
