# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: TypeScript + Obsidian Plugin API + vanilla DOM；目标是 Obsidian Electron 的 desktop web surface，`isDesktopOnly` 是明确的发布约束。

## Users

需要长期阅读 PDF、整理摘录并在 Obsidian 中组织研究材料的研究者。典型场景是白天坐在书桌前，将屏幕上的 PDF 与已有的 Canvas、Excalidraw 或 Markdown 笔记并置。

## Product Purpose

Reading Desk 是一个插件内完成的书架与阅读工作台：它自动发现电子书、提取可用元数据，并把 PDF 原文的选区可靠地连接到用户可编辑的笔记目标。成功意味着用户能从书架进入阅读，在不丢失原文锚点的前提下摘录、评论、归类、回跳和重新组织信息。

## Positioning

书架和阅读器共享同一个 LibraryIndex 与 AnnotationStore；摘录不是副本，而是可持久化、双向可跳转且可反向删除的原文锚点。这是普通 PDF 浏览或手工 Markdown 摘录不能等价提供的机制。

## Operating Context

用户在 Obsidian vault 内维护 PDF、EPUB、`.canvas`、`.excalidraw.md` 与 Markdown 文件。插件扫描指定文件夹，使用 pdfjs-dist 的渲染/文本层/outline，并通过 vault 文件事件与目标文件同步。对象存储与 AI 是可选能力，不能阻塞本地阅读。

## Capabilities and Constraints

- 已确认范围为 P0–P3：书架、真实 PDF 渲染与标注、Canvas/Excalidraw/Markdown 目标、裁剪、存储、可选 AI、导入和导出。
- UI 必须是中文、Obsidian 原生 vanilla DOM，不引入 React、Svelte、Vue 或外部 UI 库。
- 坐标只存归一化 PDF 空间 `rects[]`；文本可跨行。
- 插件 id 为 `obsidian-reading-desk`，从 0.1.0 开始，`isDesktopOnly` 为 true。
- 元数据默认自动提取；不可提取时可编辑补齐，不阻塞入库。
- 对象存储真实上传需要用户凭据；无凭据时功能可配置、签名可测试，但真实上传不能被宣称已验证。

## Brand Commitments

显示名 Reading Desk；中文、平静且准确的操作性文案；融入用户已有 Obsidian light/dark 主题。不得复用旧 Bookshelf 的视觉、文案、CSS 类名、数据模型或存储位置。

## Evidence on Hand

- 功能与逐字稿基线：`/Volumes/SDD2T/obsidian-vault-write/技术学习/转录总结/PDF Flow 插件功能全解（对标开发参考）.md`。
- 70 张逐帧截图：`/Volumes/SDD2T/obsidian-vault-write/技术学习/zattachments/pdf-flow/`。
- 不存在可合法复用的参考插件源码、CSS 或安装包；观察不到的交互由项目自研决策记录。

## Product Principles

1. 原文、笔记与书架必须共享可验证的真源，而不是三个彼此漂移的副本。
2. 先使本地阅读、保存和回跳可靠；可选云端与 AI 绝不能伪造可用性。
3. 原生 Obsidian 文件仍归用户所有：目标文件写入要保留用户节点与内容，旧数据导入不破坏来源。
4. 让密集研究工作可扫读、可键盘操作、可恢复，而不是用装饰替代状态。

## Accessibility & Inclusion

所有交互控件有中文可访问名称、键盘焦点环和不只依赖颜色的状态；错误、加载、空态、禁用态与长文本均有可读反馈。PDF 文本层保留原生选择能力。
