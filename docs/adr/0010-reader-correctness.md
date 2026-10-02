# ADR 0010：PDF 选区、异步渲染与精确定位

- 日期：2026-10-02
- 状态：已接受
- 关联：ADR 0002、ADR 0006、docs/research/reading-desk-enhancement-review-2026-10-02.md

## 决策

### 选区与裁剪

摘录以 Range 的起止节点实际所属 `.rd-pdf-page-host` 为唯一源页，起止页必须相同。四边越界会明确拒绝；不再把完整跨页文字与部分单页矩形配对。文本从同一 Range 冻结，拖放携带源路径、页码、旋转、文字与规范化 rects。目标变更之前完成验证。

ReaderCropController 冻结当前页 PageViewport，把裁剪 overlay 的显示空间比例转换为规范化 PDF 空间，形成 `{page, rect, rotation, viewport}`。PdfRenderer.renderCrop 显式加载该页，并使用冻结的旋转和缩放；0/90/180/270 均同一坐标管线。高亮、裁剪和持久化页码为零基；PageSurface、搜索结果、PdfLinkDestination 和导航历史为一基。

创建和改色统一使用 TargetService.writeAndSaveExcerpt；Reader 不单独执行目标写入后 AnnotationStore.save。待写入操作记录、失败恢复和重试由 TargetService/AnnotationStore 持有。改色保留原卡片 title/folded 等状态。

### 搜索与定位

PDF.js text items 和 TextLayer.textDivs 使用相同次序建立页文本索引。搜索保留所有非重叠命中，提供原文 UTF-16 的半开 start/end 和逐 span 字符 offset。大小写折叠及合并空白均携带原文映射；跨 span/换行短语依然定位到实际 Range。结果列表仅展示围绕当前命中的最多 60 行，不限制实际命中或导航。

ReaderSearchService 与 ReaderSearchPanel 分别检查文档代次和请求代次；AbortSignal 终止等待、更新与导航。新查询、重复同一查询、关闭、切书和重建面板均使旧请求失效；提取拒绝不污染缓存、不阻塞下一次查询。当前命中以 Range 矩形单独标记，导航等待目标页真正渲染后定位到该 offset。

ReaderPositionController 拥有每 leaf 的可取消跳转、冷页高亮定位、PDF 内链及跳转历史。PageSurface.ensurePageRendered(page, signal?) 完成之前不查找高亮；后来的跳转与生命周期取消旧请求。历史保存页面及显示空间中的规范化 x/y，跨页和同页跳转的前进/后退均恢复页内位置。

### 渲染与资源

PdfRenderer 持有 PDF.js 文档和渲染代次，捕获每次调用的 scale/rotation，并在异步边界校验。表面先渲染到脱离 DOM 的 staging host，ReaderPageDeck 再核对窗口和 epoch 后接管；缩放、旋转、切书、关闭或离屏的迟到结果不会发布。单页表面也拥有请求代次，旧页不能覆盖新页。

连续表面最多两个 raster 任务并行，每页 in-flight 去重，保留当前页上下各四页；窗口之外的 pending 取消、已渲染页显式释放。普通页面 backing store 上限为 150 万像素，每次分配绝对上限 400 万像素，整个 renderer 活跃 backing store 为 2400 万像素；DPR 在预算内降采样，CSS 尺寸与选区 viewport 保持一致。这个预算只约束画布 backing store，不宣称约束 PDF.js 文档、字体、文本缓存或浏览器总内存。

PdfCanvasBudget 区分渲染 complete、表面 adopt 和 everConnected。完成后仍脱离 DOM 等待接管的 staging 画布不能被其他任务扫成零；只扫曾连接且后来脱离 DOM 的完成画布。staging 失败、淘汰、预览关闭和表面销毁均由 releaseTarget 显式归还。

### PDF 链接与临时预览

仅从 PDF.js getAnnotations({intent:'display'}) 的 Link 注释创建语义按钮和链接。内部目的地通过 getDestination/getPageIndex 解析；XYZ、FitH/FitV/FitR 位置在 viewport 下转换。内部链接显式点击跳转，Shift 点击或独立“预览”按钮显示临时页面。预览有“打开此位置”和关闭按钮、Escape 关闭并恢复触发控件焦点；预览本身不改当前页、滚动位置或历史，且禁用嵌套链接层。PDF 自动 JS、JS/actions、remote GoTo、Launch 和自定义 URL scheme 不接入。外链只接受绝对 http/https/mailto，必须用户显式点击，并设置 noopener/noreferrer。

这是可用的首版安全内链/脚注预览，不提供 PDF 表单、媒体、附加文件、PDF 脚本、远程文档目的地或 PDF.js 完整 viewer 行为。目的地 zoom 参数不改用户缩放；Fit 类不自动切换 fit 模式。

## 所有权

- ReaderView 保留每 leaf 生命周期及协作者接线，本次由 649 行缩减到约 617 行；未增加 main.ts 渲染职责或 ReaderHost 回调。
- PdfRenderer 持有 PDF.js 文档、TextLayer、注释读取和光栅化；PdfCanvasBudget 持有画布预算，PdfTextIndex 持有 offset 索引，PdfLinks 持有安全目的地解析和语义层创建。
- PageSurface/ReaderPageDeck 持有表面窗口、并发、渲染代次、接管和释放；ReaderPositionController/ReaderLinkPreview 持有定位与临时预览生命周期。
- ReaderExcerptWriter/ReaderExcerptController 持有选区冻结和 Reader 摘录流程；src/crop/ReaderCropController 持有冻结裁剪几何和裁剪生命周期。
- ReaderSearchService/ReaderSearchMarks/ReaderToolsController/ReaderSearchPanel 持有检索、精确标记与最新请求界面状态。
- 所有 UI/CSS 继续由 UI owner 实现；Reader 只写 live geometry、类名、状态和语义动作。

本 ADR 替代 ADR 0006 中“ReaderView 约 740 行”的历史让步，以及仅 span 内匹配的旧搜索边界，保留其表面抽象与应用组合边界。

## 验证与限制

定向 Vitest 覆盖严格单页/四边拒绝、durable 创建与改色失败、四种旋转和显式裁剪源页、完整 20 次命中、跨 span/换行/Unicode offset、当前命中、取消与失败恢复、迟到 epoch/500 页快跳/并发去重、画布预算和 detached staging 接管竞态、冷页仅保留最新定位、链接安全过滤、临时预览点击/Escape/迟到清理、同页及跨页历史位置恢复。

使用确定性 DOM/PDF.js 双替身验证异步所有权；没有在本分工任务中部署。真实 Obsidian PDF 的内链可点区域、预览可视性、浏览器 Range 布局、混合页尺寸/旋转、高 DPI 和内存曲线仍由整合后的实机验收确认；不得把单元测试称为实机验收。
