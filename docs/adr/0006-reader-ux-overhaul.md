# ADR 0006：阅读体验大修（Reader UX Overhaul）

- 日期：2026-09-20
- 状态：已接受（0.2.0）
- 关联：ADR 0002（PDF 渲染）、ADR 0005（Reading Desk 源链接）、docs/research/pdf-plus-design-study.md

## 背景

以 PDF++（本地 obsidian-pdf-plus 仓库）为对照的代码级审计确认：书架/标注/目标层完整，但阅读内核存在 22 项体感缺陷（无连续滚动、无翻页快捷键、Retina 发虚、暗色刺眼白纸、每翻页全量落盘、渲染竞态、无搜索、无撤销等）。用户指令为在独立 worktree 中全部清掉 P0–P2。

## 决策

1. **表面抽象**：新增 `PageSurface` 接口与两个实现——`ContinuousPageSurface`（`ReaderPageDeck.ts`，虚拟化连续滚动列，IntersectionObserver 驱动渲染窗口，pageTops 二分定位）与 `SinglePageSurface`（单页 + 页内滚动记忆）。默认连续滚动，经 viewer 设置切换。
2. **渲染正确性**：`PdfRenderer` 乘 devicePixelRatio；每次渲染持代际令牌并取消上一个 `RenderTask`，陈旧渲染不再写入 DOM；为文本层显式写入 `--scale-factor`（pdf.js 4.10 字号依赖）；返回 `textSelectable` 供扫描页反馈。
3. **持久化节奏变化**：阅读进度由每次渲染直写 `data.json` 改为 `ProgressFlusher`（1.2s 尾随去抖，卸载时 flush）。进度真源仍是 `LibraryIndex`，仅提交时机变化；书架刷新随 flush 而非每页。
4. **新增 viewer 设置**：`settings.viewer = { scrollMode, invertPdf }`（连续/单页；夜间反相 auto/on/off，auto 跟随宿主主题，CSS 滤镜只作用于纸面 canvas）。默认值在 `defaults.ts`，旧 data.json 合并时补全。
5. **导航与历史**：`ReaderHistory` 跳转历史（仅 jump 类跳转入栈）；工具栏加入返回/前进、全文搜索、缩放百分比控件、显示选项菜单（整页适配/旋转/滚动模式/夜间反相）；键盘映射集中在 `ReaderKeyboard`（←/→/PgUp/Space、+/-、w/h/p、r/R、Alt+方向、/）。
6. **全文搜索**：`ReaderSearchService` 惰性提取并缓存页文本，`ReaderSearchPanel` 停靠工具栏下方，命中以 accent 轮廓标记文本层 span。
7. **摘录体验**：改色/删除/创建摘录改走 `refreshAnnotations()` 局部重绘，不再整视图重建；颜色记忆上次选择；新增“撤销上一条摘录”与“复制选中文本”命令；点击高亮标记直接打开评论浮层。
8. **裁剪目标**：新增 Markdown 嵌入目标（存库图片或 OSS 外链 + 来源行，追加到所选 md 目标或新建笔记）；裁剪管线从 main.ts 抽到 `CropImageService`（main.ts 保留为组合边界）。
9. **智能打开**：同一路径的阅读链接复用已有 reader leaf，不再堆叠重复标签页。
10. **生命周期**：`onOpen` 空态渲染延迟一个宏任务，让重载后的 setState 恢复有机会先落地（针对已登记的 reload 空态 follow-up 的防御性修复，仍需运行时验收）。

## 所有权

`ReaderView` 仍是每 leaf 的交互编排边界；新模块各持单一职责：`ReaderPageDeck`/`PageSurface`（表面）、`ReaderFitController`（适配与缩放）、`ReaderToolsController`（搜索/复制/撤销）、`ReaderCommentBridge`（评论浮层与列表宿主）、`ReaderExcerptWriter`（选区→高亮写入）、`ReaderTargetPanelController`（目标面板）、`CropLauncher`/`CropImageService`（裁剪挂载与持久化）、`ProgressFlusher`（进度节流）、`ReaderKeyboard`（键位）、`ReaderHistory`（历史）、`ReaderThemeInvert`（反相）。

## 已知让步

- `ReaderView` 约 740 行，超出 650 行模块红线；已抽出 12 个协作者模块，剩余为生命周期接线，继续拆分只会做依赖对象倒置。文件内以 eslint-disable 注释显式记录，此处作为分解债务跟踪。
- `src/ui/targets/ReaderTargetPanelState.ts` 为重构中途被取代的空壳文件，待后续清理提交删除（删除守卫拦截了本次 worktree 内的移除）。

## 后果

- 翻页/改色不再闪整屏；夜间阅读可反相；搜索/键盘/历史补齐与成熟阅读器的差距。
- 进度写入次数从每页一次降到每 1.2s 至多一次；大书库翻页不再触发全量 JSON 写与书架重绘。
- 运行时验收（真实 Obsidian CDP）待本 ADR 之后的 self-check 证据补充。
