# PDF++ 首批适配设计 brief

状态：已依据用户目标、`PRODUCT.md`、`DESIGN.md` 与 `pdf-plus-design-study.md` 定向确认；本轮不替换视觉世界。

## 任务与用户

这是桌面 Obsidian 的 **Operate** 表面。研究者正并置 PDF 与真实目标笔记，需要在不打断阅读姿态的前提下复制当前位置、收束当前页标记，并确认列表中的摘录对应正文哪一处。成功不是“功能更多”，而是少一次找页、找标记、找目标的往返，同时仍由 `AnnotationStore` 和稳定 `highlightId` 保证锚点真源。

## 范围与结果

- PDP-001：Reader 工具栏提供“复制本页链接”，命令面板提供同一动作；同 vault 点击后打开 Reading Desk 到该 PDF 的 1-based 可见页。
- PDP-002：高亮抽屉每行提供“复制原文链接”；沿用稳定 `highlightId` 并保持旧 `reading-desk-highlight` 链接兼容。
- PDP-003：高亮抽屉顶部提供“本书全部 / 当前页”二态筛选、可读计数和当前页空态；状态只属于当前 Reader leaf。
- PDP-004：PDF 标记与抽屉行按 `highlightId` 双向 hover/focus 预览；离开、翻页、重绘、关闭时清理。
- 不做文本搜索、outline 导航、任意模板、PDF 字节修改、Obsidian Backlinks patch、移动端或新持久化字段。

## 信息和交互结构

1. 工具栏把“复制本页链接”视为页导航的次要动作，位置靠近页码组，不挤入色盘。按钮沿用 `.rd-button`，中文动作名可直接扫描；成功显示短 Notice，失败说明剪贴板问题和重试动作。
2. 抽屉标题下方增加一行紧凑控制：二态 scope button（或同语义 segmented controls）+ `当前显示 x / y 条` 元信息。选中态用 `aria-pressed`、边界和文字共同表达。切换不滚走、不关闭抽屉、不改数据。
3. 当前页为内部 `PdfHighlight.page` 的 0-based 值；工具栏/协议显示与接受 1-based 页。转换只在一个可测试边界完成。
4. 当前页没有标记时显示“第 N 页没有高亮。查看本书全部”以及可操作的恢复入口；整本没有标记时保留原有教学空态。
5. 每条列表行的复制动作是次要紧凑按钮，不替换点击摘录文字的跳转行为，也不和删除确认混排成主 CTA。
6. hover/focus 预览只添加暂态结构类：PDF 的所有 rect 段与唯一列表行同时得到 accent 轮廓；不改变标记颜色、opacity 或持久状态。键盘聚焦列表行中的任一控件或 PDF mark 均得到同等联动。

## 状态和边界

- 默认：全书高亮，复制按钮可用，联动未激活。
- loading/error：沿用现有抽屉 live region；剪贴板失败必须进入可读反馈，不能只写 console。
- long content：长 PDF 路径、长摘录和多个 tags 不撑破 360px drawer；所有次要动作可换行但不形成第三列。
- narrow leaf：toolbar 可换行；不写死 drawer top。800px container 和 760px fallback 前后都不得遮挡 PDF、目标面板或页码。
- light/dark：全部颜色使用现有 `--rd-*` 语义 token；preview 使用 outline/边界，不能创建固定 hex 或第二套 palette。
- accessibility：控件具有中文名称、可见 focus、正确 `aria-pressed`；结果计数/失败反馈可被读出；hover 不是唯一通道。
- lifecycle：多个 Reader leaf 互不串状态；重渲染前解除旧 listener，不能全局查询另一 leaf 的 DOM。

## 实现约束

- `main.ts` 保持组合边界，拥有协议、命令、宿主剪贴板回调；不得放列表渲染或几何逻辑。
- `ReaderView.ts` 当前已接近 650 行，必须通过提取链接构造/联动控制器或其他单一职责模块保持在 650 行以内，不能用压缩格式规避门禁。
- `HighlightList` 负责列表 DOM、筛选控件和行数据标识；`AnnotationStore` API 与 schema 不变。
- 链接构造只有一个 owner；现有目标适配器必须复用它，避免 Canvas/Markdown/抽屉生成不同协议。
- 为链接/页码边界、scope 过滤、DOM 联动生命周期、复制成功/失败和旧协议兼容添加测试。
- `assets/styles.css` 是受 Git 跟踪的唯一样式源码；根目录 `styles.css` 是 ignored 的生成/部署产物，由 `npm run styles:sync` 及 dev/build 确定性生成，项目文档 gate 会逐字节校验二者一致。不得对根产物使用 `git add -f`；最终仍以源码/产物 SHA-256、detector、截图和部署文件证明它。

## 验收场景

1. 宽 split/light：复制第 2 页链接，粘贴进真实 Markdown，点击后回到相同 PDF 第 2 页。
2. 高亮链接：从抽屉复制，粘贴并点击，准确滚到相同 `highlightId`；源文件重命名后仍以存储真源解析；删除后给出明确错误。
3. 当前页过滤：同书至少两页各有高亮；切换 scope 和页码后计数、行、空态立即正确，切回全部恢复。
4. 双向预览：抽屉行 hover/focus 与 PDF mark hover/focus 均联动，多 rect 全部出现结构轮廓，mouseout/focusout/翻页后无残留。
5. 窄 split/dark（800px 和 760px 邻域）：toolbar wrap、drawer、按钮、长文本无裁切/横向滚动/重叠；测量 workspace padding、toolbar height、drawer bounds、列表列宽与 `scrollWidth/clientWidth`。
6. 鼠标、键盘、copy permission failure、empty/loading/error/disabled 相关状态均有可辨反馈，控制台无 Reading Desk 新错误。

视觉验证采用 Impeccable 的有界两轮：一次批量截图/测量与缺陷修复，至多一次确认；完成 UI 后只运行一次 manual detector。
