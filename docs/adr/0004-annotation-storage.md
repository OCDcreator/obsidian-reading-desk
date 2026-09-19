# ADR 0004：标注真源与目标反查

## 候选

1. 仅插件 `data.json`：统一但移动目标后难反查。
2. PDF 旁挂 JSON：随源文件移动，但多目标/评论会分散，并污染图书目录。
3. 仅目标节点 metadata：目标可追踪但 Markdown 与多目标索引不一致。

## 决定

采用混合：插件 `data.json` 中 `AnnotationStore` 是高亮、评论、标签、章节和目标引用的唯一真源；真实 Canvas/Excalidraw/Markdown 中写入最小 `readingDesk` metadata 或可解析链接。TargetService 对目标文件串行原子写入，监听 vault modify 后将不存在的流式卡片反向删除相应高亮。

Reading Desk 自己生成的反链使用 `obsidian://reading-desk-highlight?file=<encoded>&highlight=<encoded>`，由 `main.ts` 的 Obsidian protocol handler 打开 Reader 并按 stable `highlightId` 定位。页面只作为显示信息，持久化与协议定位不依赖易产生 off-by-one 的可见页码。

## 坐标与一致性

每个高亮保留页面、旋转、文本与 PDF 空间的归一化 `rects[]`，绝不保存屏幕像素。Canvas 使用真实 nodes/edges；Excalidraw 用自有 `highlightId` mapping，不假称 Canvas node id。删除是有意目标卡片移除时的同步动作，不能删用户的普通节点。
