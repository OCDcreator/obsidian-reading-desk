# Margin 0.4 模块与恢复契约

本页记录 2026-10-02 调研后实现的模块边界；详细决策见 ADR 0008–0013。所有持久坐标继续为归一化 PDF `rects[]`。`PdfHighlight.page` 为 0 起始，阅读器 UI/搜索页码为 1 起始。

| 模块 | 所有权与边界 |
| --- | --- |
| ReadingDeskRepository / DataValidation / RepositoryStatus | 唯一插件数据提交队列、旧数据迁移与形状校验、外部快照比较、未保存状态和重试；损坏原件阻止写入，不用空库覆盖。 |
| ReadingDeskBackupService / Backup* | 完整插件数据备份、凭据排除、路径映射、引用与身份检查、差异预览和恢复计划。计划在 apply 时再次校验，不信任 UI 编辑后的对象。 |
| ReadingDeskDataManagement | 协调导入、恢复、模板与重试的领域流程，消费 Repository/LibraryIndex/AnnotationStore/TargetService；文件清单、预备份写入和 UI 刷新均由宿主注入。 |
| AnnotationStore | 唯一标注真源，持久目标写入意图、删除恢复记录、高亮/评论/卡片恢复。 |
| TargetService / 原生 adapters | 唯一目标写入、异常诊断与核验。先保存意图再更新目标，成功后清意图；合法删除卡片保持反向同步，损坏标记或暂缺文件进入待修复。 |
| ExcerptTemplate | 固定占位符的一次替换，不执行脚本；管理文本更新保留用户编辑区域。 |
| LibraryIndex / LibraryMetadata / LibraryImport | 唯一书籍元数据索引。人工覆盖、自动提取来源、路径映射、增量批次、列表和阅读状态、幂等来源导入及显式重关联。 |
| BibliographicImportService / parsers | CSL JSON、BibTeX、Zotero 导出 JSON 的纯解析与计划，不读取外部附件，不调用云 API；写入仍走 LibraryIndex。 |
| AnnotationSearchService | 每次从 AnnotationStore 读取的只读检索视图，搜索结果使用稳定 highlightId；不产生第二可编辑标注库。 |
| ReaderView / reader 与 crop 模块 | 每个 leaf 的 PDF 交互、摘录几何、页内定位、搜索请求生命周期、内链预览和历史；ReaderView 负责协调，分离的控制器仍属阅读器。 |
| PdfRenderer / PdfCanvasBudget / PdfLinks / PdfTextIndex | PDF.js 生命周期、画布预算、PDF 链接/文本层。PDF 内链不执行动作脚本，外部 URL 只提供显式点击。 |
| ShelfView / ui/shelf | 过滤排序、分页 DOM、批量交互、紧凑继续阅读、列表和检索入口；书籍修改通过 LibraryIndex host，重关联由宿主协调跨真源路径。 |
| ReadingDeskSettingTab / SettingSaveFeedback / ui/portability | 设置控件、保存状态与恢复/导入/导出预览；UI 不直接写 vault。 |
| main.ts / host helpers | Vault 事件、命令、协议、Obsidian 文件操作和回调接线。VaultChangeBatch 合并重复事件；SourcePathRemap 是原子迁移回调的纯计算；DataPanelPresentation 只生成 UI 摘要。 |

## 保存、删除与恢复

- 提交前对比最新 data 值，防止检测到的旧快照覆盖；比较到写入之间依然可能发生跨进程竞争，不能宣称分布式 CAS 或自动合并。
- 保存失败的有效快照保留为 pending，不重放原 mutator；用户可重试。重载前保存 pending 的备份，UI 需要明确二次确认。
- 覆盖前将原值写入插件目录 `recovery/` 的唯一 JSON 文件；备份失败阻止覆盖。私有原件快照可能包含本机凭据，应随插件数据保管；分享用完整数据导出默认去掉凭据。
- 完整数据备份包含书籍、分类、列表、高亮、评论、卡片、删除恢复、目标待写意图与必要配置。`filesIncluded: false` 明确不含 PDF/EPUB、封面或原生笔记；这些文件需要 vault 备份。
- 源文件与整个目标文件暂缺时保留书目和标注，不反向删除。合法删除目标卡片的反向同步仍符合 ADR 0004，同时保存可恢复记录。
- 重命名或明确重新关联在同一提交中迁移书籍与当前/待写/已删除标注路径，再通过目标意图重写回链。已被另一书目占用的路径不自动合并。

## 验证范围

单元/集成测试覆盖错误保存、损坏数据、旧快照、恢复前备份失败、导入旧预览、模板安全、人工值保护、单页/裁剪几何、取消与延迟渲染，以及键盘和分页交互。Mac `testvault` 的产物哈希、fresh startup、实机界面及功能 smoke 另保留在 `.obsidian-debug/enhancement-20261002/`；不能把固定夹具验收当成所有 PDF、主题、设备或同步服务的保证。
