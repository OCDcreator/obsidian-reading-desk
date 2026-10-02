# ADR 0014：精确读位、书签与 PDF 印刷页码

- 日期：2026-10-02
- 状态：已接受
- 关联：ADR 0010、0011

## 持久化与身份

LibraryIndex 是书库读位和书签的唯一存储入口。LibraryBook 的可选 lastReadPosition / bookmarks 与书籍稳定 ID 同行，重命名、重关联和完整备份保留；旧数据缺字段表示未保存，不影响打开。ReaderStatePort.read(path) 只在打开时选择 bookId，后续 savePosition/saveBookmark/removeBookmark 全部写捕获的 bookId，不能迟到时再以旧路径查找另一本文档。ReaderHost 定义放在 reader/ReaderHost.ts，ReaderView 保持接线和 per-leaf 生命周期。

ReaderPersistenceController 每 leaf 独立维护 400ms 滚动去抖和待写队列，切书或关闭刷新已捕获的变化，不因关闭一个未交互的旧窗口制造更新的时间戳。失败项保留待重试，显示中文通知，书签页提供重试入口。保存按调用时的稳定身份执行；多个窗口不互相覆盖整本书，字段写入由 LibraryIndex 的提交队列读取当前数据后执行。书签按 ID 增删改，不整体替换另一个窗口的书签列表。

## 坐标与恢复

ReaderSavedPosition 保存零基物理页、有限有符号显示空间比例 x/y、旋转、scale、fitMode 和 updatedAt。x/y 的负值表示当前中心页的起点尚在视口下方/右方，不能裁成 [0,1]。校验只用宽松合理范围拒绝损坏值。physical page 不使用印刷标签。

普通书库打开和 workspace 恢复使用最后保存位置；显式页链接、选中摘录和高亮入口优先。恢复顺序为旋转→手动 scale 或 fit 模式→实际页面渲染→页内偏移；fit 会针对当前窗口重新计算，manual 保持倍率。恢复期间不写入中间几何，完成后重新监听滚动。冷页、取消与切书的渲染所有权继续遵守 ADR 0010。

书签位于 PDF 导航的第三页签，提供当前位置命名、名称保存、删除与跳转。名称、保存失败、空态和未索引 PDF 均有明确反馈。删除只删除书签，不删除标注或源文件。

## 印刷标签

PdfRenderer 使用 PDF.js getPageLabels 获取标签，ReaderPageLabels 负责显示与解析；没有标签时回退物理页。页码输入可输入罗马数字、数字标签或 #N 物理页。重复标签不隐式选择第一项，提示全部物理候选供消歧。

导航缩略图、目录和工具栏展示标签；工具栏 title 同时说明物理页。复制本页链接在标签不同于物理页时生成可读 Markdown 文本，反斜线、方括号转义，换行合并；URI 中 page 仍是原来的一基物理页。摘录冻结时写 PdfHighlight.pageLabel，模板使用 pageLabel 占位符，旧摘录回退 page+1。标签不参与身份、几何、历史或回链解析。

## 验证边界

单元测试覆盖旧字段缺省、去抖/关闭刷新、保存失败重试、rename 后同名另一书不串写、多 leaf 迟到写入、书签 CRUD/跳转、旋转与缩放恢复顺序、显式物理页优先、罗马/数字/重复标签与 Markdown 转义。scripts/margin-reader-scenarios.mjs 生成 350 页真实 PDF，供部署后的 CDP 集成验收；只有真实执行结果才能标为实机已验证。

## 源文件与锚点核验

新摘录保存 Reader 实际载入字节对应的文件 stat：打开前后 mtime/size 相同才冻结，否则保留未知。拖动摘录将冻结 stat 与原页/坐标一起携带。高亮抽屉的独立折叠诊断面板对比当前文件 stat；不同只表示需要核验，无指纹为 unknown，相同不证明内容完全一致。查找引文打开既有 PDF 搜索，不自动修改持久化 rects。
