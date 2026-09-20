# ADR 0005: Reading Desk 原文深链

状态：接受（2026-09-20）

## 决策

`src/reader/ReadingDeskLinks.ts` 是 Reading Desk 原文深链格式、1-based 可见页校验和参数解析的唯一 owner。现有 `reading-desk-highlight` protocol 保持兼容：`highlight` 参数优先解析稳定 `highlightId`；新增 `page` 参数表示 1-based 可见页，并可携带稳定 `book` id 与路径 fallback。

`main.ts` 继续作为宿主组合边界，拥有协议注册、LibraryIndex 解析、Reader leaf 打开和系统剪贴板反馈。Reader 和高亮抽屉只请求复制，不解析协议。目标适配器通过 `createSourceLink` 间接复用同一 highlight link owner。

## 理由与边界

- 高亮跳转先查 `AnnotationStore` 的稳定 ID，因此源 PDF 重命名后仍能解析；高亮删除后明确报错。
- 页跳转先以 `LibraryIndex` 的稳定 book id 找当前路径，路径只是未入索引时的 fallback；超界页由 Reader 夹取并提示。
- 深链只读，不写 PDF、不创建注释、不建立第二套索引，也不修改 `rects[]` 或目标文件。
- 当前页筛选及 mark/list 预览是每个 Reader leaf 的瞬态 DOM 状态，不进入持久化 schema。

## 后果

任何新的原文链接变体都必须先扩展并测试 `ReadingDeskLinks`，不得在 Canvas、Markdown、抽屉或命令回调中各自拼接 URI。协议 handler 的宿主副作用仍留在 `main.ts`。
