# ADR 0002：PDF 渲染、worker 与输入

## 决定

使用 `pdfjs-dist` 4.10.38 本地 bundle，优先从插件安装目录的 `pdf.worker.mjs` asset 加载；渲染层是 canvas，文本层使用 pdfjs `TextLayer` API，二者由同一 viewport 驱动。插件声明 desktop-only。

Reader 的导航列提供真实页面缩略图与 PDF.js `getOutline()` 层级目录，两者都可跳页。目录展示由 `ReaderOutlineModel` 承担：PDF 原生多级 `path[]` 优先且不重复推断，只有整份 outline 都是单级 path 时才保守推断编号或明确的中文章节层级，推断仅用于展示树、视觉深度与当前项定位，不写回 PDF、不改摘录章节归属与 Canvas 同步。目录样式提供「级联树 / 子弹线」两种呈现，随设置即时作用于已打开的导航，无需重新打开 PDF。页面缩放同时支持适合宽度和适合高度；Reader 自身的 `ResizeObserver` 在宿主 leaf 重排后重算当前 fit mode，手动缩放则退出自动适配。

Canvas 仍是 Obsidian 所有的相邻 leaf。Canvas 摘录经 `TargetService` 持久化后，应用组合边界打开原生目标并聚焦返回的 node id；Reader 内的目标管理只是辅助 overlay，不渲染 Canvas 替身。

## 原因

CDN 会引入离线、隐私与 CSP 风险；内置 worker 在 vault 复制部署后仍可用。当前生产 worker 为 2.1 MiB，主 bundle 约 1.1 MiB（2026-09-18 实测）；这个体积成本换来真实 metadata、page rendering、outline、text selection 和旋转坐标的一致 PDF 引擎。

## 实现与 CSP 路径

`PdfRenderer` 通过 `vault.adapter.getResourcePath(<plugin-dir>/pdf.worker.mjs)` 设置 `GlobalWorkerOptions.workerSrc`，然后以 `getDocument({ data, isEvalSupported: false, useWorkerFetch: Boolean(workerUrl) })` 打开阅读 PDF。元数据提取器使用同一安装目录 worker，但禁止 worker fetch（`useWorkerFetch: false`），所以它不依赖远端字体、CMAP 或 CDN。构建脚本从 `node_modules/pdfjs-dist/build/pdf.worker.mjs` 复制 worker；部署必须把根目录 `main.js`、`manifest.json`、`styles.css` 与 `pdf.worker.mjs` 四件一起复制。

## Apple Pencil 与回退

本版本 desktop-only，Apple Pencil 链路不作为可通过声明。Pointer Events 只用于裁剪/拖放，不拦截 Canvas 或 Excalidraw 自己的笔输入。若 resource URL 不可用，PDF.js 会走其可用的本地 worker/fake-worker 路径；若 PDF 损坏则进入错误态而不伪造文本层。这个回退是库的运行时行为，不是已在受 CSP 限制环境中完成的验收声明。
