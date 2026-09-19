# ADR 0003：PDF/EPUB 自动元数据与封面

## 决定

PDF 用 pdfjs `getMetadata()` 的 metadata 与 Info 字典补齐 title/author，用 `numPages` 获取页数，用第 1 页真实渲染生成封面。EPUB 用 JSZip 查找 `META-INF/container.xml`、OPF manifest/spine，并取 title、creator 与 cover item；EPUB 页数留空。封面缓存使用源路径及 mtime/size 指纹失效。

## 降级

解析或封面失败不会阻塞索引：标题回退到文件名，作者/页数/封面为空，用户可编辑字段补齐。无内置 zip API 的情况由 JSZip 满足，失败状态保留可读错误。
