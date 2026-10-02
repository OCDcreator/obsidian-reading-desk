# ADR 0012：书库交互与局部保存反馈

- 状态：Accepted
- 日期：2026-10-02

## 决策

书架继续使用中文 vanilla DOM，并复用宿主主题 token。ShelfView 只协调叶片内查询、分页、选择和交互；src/ui/shelf 的独立组件负责卡片/表格、查询、批量整理、摘录检索及确认面板。LibraryIndex 是唯一书目真源，AnnotationStore 是唯一标注真源，全库检索调用只读 AnnotationSearchService，不持久化第二套标注副本。

继续阅读最多展示六个横向紧凑卡。无封面/加载失败使用书名排印、格式和明确的无封面提示，保持几何尺寸。分类创建/排序按需展开，关闭后焦点回到实际入口。卡片仅处理自身 Enter/Space，内嵌 input/select/button 保留原生键盘行为。

组合筛选支持格式、书籍标签、最低评分、人工阅读状态、阅读列表、缺失文件和原有文本/分类。排序明确升降方向，同值按书名、稳定 ID 决定顺序。阅读状态不从进度机械推导。每页至多 40 本，继续阅读最多六本；检索结果也分页为 40 条，单结果预览至多三条评论。选择跨页保留，选中筛选结果不额外挂载书卡。标签输入的候选最多 40 条，仍允许输入任意精确标签；摘录检索的书名/路径文本筛选在内存中解析 ID，避免万本书的 option 节点。

批量整理只提交启用的字段：标签和列表显示追加/替换/移除语义，分类可以清空，状态可独立指定。确认前显示变更摘要，失败保留输入供重试。LibraryIndex.batchUpdate 在一次提交内应用各书的追加/替换/移除，UI 不循环持久化单本以模拟批量。

人工标题和作者在表格中标明来源并提供恢复自动字段入口；主动清空作者仍为人工覆盖。缺失文件不触发普通打开，UI 显示原路径与候选路径，用户再次确认后调用 ShelfNavigation.relinkBook(id,path)。main 宿主协调 LibraryIndex、标注路径迁移与目标刷新，UI 不单独调用 index.relink。候选路径由 listSourcePaths/candidateFiles 提供，路径占用等冲突由宿主拒绝，UI保留重试。

ReaderToolbar 的显示选项与 more 共用动作定义，more 读取按钮的实时 disabled 状态并检查隐藏祖先。目标浮层记录可见的实际触发按钮（包括 more）；关闭后返回该入口。DOM 宽度状态与 980/500px 容器查询共同控制折叠。Mac 主题下 900px 实测曾使末尾设置按钮溢出，因此中等宽度的次要动作也移入更多菜单，保留所有动作可达。链接和搜索预览 CSS 只负责呈现，坐标和导航仍属于阅读器。

SettingSaveFeedback 在设置行内呈现保存中、成功、失败和重试，保留控件、草稿与焦点。每行串行保存，只让最新草稿状态影响 live region，旧失败不覆盖新成功。ReadingDeskSettingTab 的数据页通过 plugin.dataPanelHost() 接线 ImportExportPanelHost；备份/迁移/恢复逻辑仍由数据与互操作服务承担。

## 宿主契约

ShelfItemView 将 LibraryIndex 的 listLists/createList/batchUpdate/clearMetadataOverride 适配成书架 host；主宿主提供 openSettings、searchAnnotations(query)、openHighlight(path,id)、listSourcePaths()（或 candidateFiles()）、relinkBook(id,path)。检索结果用稳定 highlightId 和 pdfPath 回到原文。

## 验证与限制

交互回归覆盖卡片与 select 冒泡、IME、分类面板焦点、40节点分页、跨页批量选择、列表替换/标签追加、重关联确认、480/640/900px 工具栏折叠/disabled/实际入口，以及设置失败重试与旧请求竞态。测试用隔离 DOM 验证事件与宿主契约；实际主题、高 DPI 和 Obsidian leaf 视觉验收需要宿主集成环境，本工作不部署。
