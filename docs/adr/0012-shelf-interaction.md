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

## 0.5 修复补充

分类与视图按钮同步 `aria-pressed` 和既有选中样式类；翻页只把焦点送到当前页书卡或表格首行选择控件，继续阅读轨不参与。书卡书名使用非标题元素，遵守 DESIGN 的 Heading-Root Rule。

`ShelfBookDrafts` 只保存叶片内尚未提交的控件值与版本，不能作为书籍元数据源；`ShelfBookEditor` 负责把这些草稿绑定到重建后的控件与局部保存反馈。标题、作者、标签、评分、分类、阅读状态统一按书籍 ID 与字段标识草稿。每字段提交串行，成功仅清除所提交的版本，期间输入的新版本、其它字段和页面上的草稿均保留。旧请求失败不覆盖新稿；失败保留原操作供重试，包括“恢复自动”操作。翻页或切换视图保留叶片内草稿，销毁叶片释放草稿和控件监听。正式写入继续经过 LibraryIndex host；草稿不会作为元数据加入持久化或备份。

## 0.5 阅读列表与视图恢复

阅读列表管理调用 LibraryIndex.renameList/deleteList；删除先呈现所影响书籍数量和只移除列表关系的说明，再显式确认。书籍、文件、标注不随列表删除。失败保留名称或确认状态供重试，隐藏的确认控件不进入对话框键盘循环。

`settings.shelf` 保存最近操作的书架默认视图：mode、书籍组合查询和页码。ShelfStatePersistence 通过 readShelfState/saveShelfState host 端口读取与提交，UI 不直接访问 Repository。旧数据默认卡片、标题排序、第一页；读取迟到不覆盖用户已经输入的查询。恢复及书库刷新会移除不存在的分类/列表过滤，页码按当前结果夹取。每次操作以 500ms 合并，单个保存请求串行处理最新快照，旧失败不覆盖新请求状态；失败保留待保存视图并显示重试。关闭叶片取消计时并等待最新提交尝试。此状态不包含批量选择、元数据草稿或摘录检索文本；多叶片继续拥有各自交互状态。

## 宿主契约

ShelfItemView 将 LibraryIndex 的 listLists/createList/renameList/deleteList/batchUpdate/clearMetadataOverride 适配成书架 host；主宿主提供 openSettings、searchAnnotations(query)、openHighlight(path,id)、listSourcePaths()（或 candidateFiles()）、relinkBook(id,path)。检索结果用稳定 highlightId 和 pdfPath 回到原文。

## 验证与限制

交互回归覆盖卡片与 select 冒泡、IME、分类面板焦点、40节点分页、跨页批量选择、列表替换/标签追加、重关联确认、480/640/900px 工具栏折叠/disabled/实际入口，以及设置失败重试与旧请求竞态。测试用隔离 DOM 验证事件与宿主契约；实际主题、高 DPI 和 Obsidian leaf 视觉验收需要宿主集成环境，本工作不部署。
