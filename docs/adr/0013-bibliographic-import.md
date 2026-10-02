# ADR 0013：本地文献来源与数据面板

- 状态：Accepted
- 日期：2026-10-02
- 依据：`docs/research/reading-desk-enhancement-review-2026-10-02.md`

## 决定与职责

`src/portability/BibliographicImportService.ts` 只适配本地数据、生成导入计划，不持有 Repository、Vault、文件读写或云连接。`BibliographicParsers.ts` 适配 JSON 与来源字段；`BibtexParser.ts` 负责有限的 BibTeX 文法；`BibliographicTypes.ts` 定义结果与稳定身份。图书写入始终经过 `LibraryIndex.applyImportedBooks(resultBooks)`，不会另建书目数据库。`LibraryBook.source` 的公开形状由 contracts owner 提供：`{provider:'csl'|'bibtex'|'zotero',id,doi?,isbn?,citationKey?}`。

`src/ui/portability/ImportExportPanel.ts` 保留旧 Bookshelf 一次性导入和书架 Markdown/JSON 清单导出，按可选 `DataPanelHost` 方法挂载 `BibliographicImportPanel`、`BackupRestorePanel`、`RepositoryRecoveryPanel` 和 `ExcerptTemplatePanel`。`PanelSection` 负责稳定 live region、异步忙碌状态、销毁边界和每页 100 项的预览；所有行都有翻页入口，路径编辑跨页保留。新组件只调用 host，不依赖 main、SettingsTab 或持久化实现。宿主资源 URL、服务适配、数据面板 builder 与应用接线属于 main / `ReadingDeskDataManagement` 的 owner。

## 支持的本地格式

- CSL JSON：条目数组；读取 `id/type/title/author/DOI/ISBN/citation-key`。CSL 作者的 literal 与 family/given/particle/suffix 适配为显示作者。接受导出附加的本地附件提示字段，但不把提示当作文件访问授权。
- BibTeX：支持括号条目、嵌套花括号、引号值、数字、百分号注释、`@comment`、`@string`、`#` 字符串连接与标准月份宏。作者按花括号外的 `and` 分割；支持 `file/pdf/path` 附件提示和 Zotero/JabRef `label:path:mime`。保留 citation key 为来源身份。仅处理常用文字格式命令；任意 TeX 宏、完整 TeX 排版、crossref 继承和 LaTeX 编译不在本适配器范围。
- Zotero JSON：支持条目数组、`{items:[]}` 和外层 key + data 条目；读取公开 item 字段 `key/uri/libraryID/itemID/itemType/title/creators/DOI/ISBN/attachments`，跳过 note/attachment/annotation 作为独立文献；支持 parentItem 附件关联。也接受 Zotero 自带 CSL JSON 导出并保持 provider 为 zotero。

解析只处理文本；不执行模板、脚本、TeX、命令或网络请求。当前文献文件限制 10 MiB、20000 条，数据面板文件选择也限制 10 MiB。错误通过 diagnostics 呈现；存在任何解析错误时整个计划的 resultBooks 为空，避免把坏文件当作成功导入。未知的非关键字段忽略，不声称完成全量 CSL schema 验证。

## 身份与计划

公开 API：

```ts
parse(provider, text): BibliographicParseResult
plan(parsed, existingBooks, {
  availableFiles?: Array<{path, stat?: {mtime, size}}>,
  availablePaths?: string[],
  pathMappings?: Record<string, string>
}): BibliographicImportPlan
```

`provider:id` 是匹配来源身份，DOI/ISBN 不自动合并不同来源或不同 ID。来源原生 ID 优先；缺失时以规范化 DOI、ISBN、最后以题名/作者/年份的确定性双 32-bit hash 回退。Zotero URI 优先于 key，已知 libraryID 会限定 key 范围。metadata hash 回退会显式警告：身份字段变化后需要再次确认；它不是安全散列。缺少 libraryID/URI 的 Zotero key 与 BibTeX citation key 也依赖导出文件作者保证在该来源内稳定且唯一。

计划包含 entries、summary、diagnostics、hasErrors、resultBooks。每条预览是新增、更新、无变化、冲突或无附件；还提供 suggestedPaths、pathConfirmed、changes、protectedFields、reason。附件文件名仅用于建议，首次关联必须由 `pathMappings['provider:id']` 明确确认库内 PDF/EPUB；绝对路径、协议路径、`..`、控制字符与非书籍文件均不能直接应用。host 应传 Vault 当前文件与 stat，以避免把已失效的索引路径误认为存在。

已有 source 自动沿用该书籍身份与原路径，重复导入无变化时不产生 writes。关联已有尚无 source 的书籍时保留原图书 ID、标签、分类、评分、阅读进度、列表和标注关联。`metadataOverrides.title/author` 包括空字符串始终优先；新的上游值保存到 `autoMetadata`，使后续清除手写覆盖时可以回到最新来源值。

同 source 的不同导出内容、重复现有 source、被另一图书/来源占用的路径、多个来源映射到同一路径、生成 ID 冲突都进入 conflict，不能自动覆盖或合并。已有 source 路径改变必须先通过 LibraryIndex.relink 完成书籍/标注/目标路径协调，再导入；plan 不以 metadata 导入替代 relink。无附件条目可明确关联现有本地书籍，否则保留预览并跳过。

主侧 `ReadingDeskDataManagement` 保存原 parsed/mappings 与当前书库签名，apply 前再次校验并重新 plan，然后调用 LibraryIndex 唯一写入口。UI 将预览原对象直接交还 host；不得 clone、序列化再还原或拼造计划，以免破坏 WeakMap 预览身份和过期预览检查。

## 完整备份、可靠性与模板入口

新增可选 host 方法为 `prepareBibliographicImport/applyBibliographicImport`、`exportBackup/previewBackup/restoreBackup`、`repositoryStatus/retryRepository/reloadRepository`、`recoveryStatus/retryTargetWrite/restoreDeletedAnnotation/recheckTarget`、`excerptTemplate/previewExcerptTemplate/saveExcerptTemplate`。旧 host 的四个 Bookshelf/导出方法保持必需，新能力缺失时对应组件不挂载或动作禁用。

BackupPanelPreview 是呈现适配器：`summary:string[]`、`paths:{key,originalPath,mappedPath?,kind?}[]`、`warnings:string[]`、`canApply:boolean`、`plan:unknown`、`filesIncluded?:false`。plan 内的服务原始预览也保留对象身份。`previewBackup(text,mappings,options?)` 的第三参数为 `BackupPanelOptions:{mode?:'replace'|'merge',conflictPolicy?:'error'|'keep-current'|'use-backup'}`。UI 默认 replace/use-backup，明确完整替换会覆盖当前插件数据并移除仅有于当前数据的项；切换 merge 默认 error，遇到差异冲突时阻止应用，用户可选择保留当前或使用备份。模式或策略变化立即使旧预览和确认失效并重新预览；路径编辑亦使旧预览不可应用。重新预览后必须勾选已备份和核对差异，再点击两次确认恢复（可取消）。实际恢复验证、原快照备份与应用由数据服务负责，备份失败必须停止恢复；只有 host 恢复成功后 UI 才声明“已自动备份”。

“完整备份”明确指 Reading Desk 插件数据，含书目、标注、评论、摘录状态与必要配置；不含 PDF/EPUB、原生目标文件、其他插件或整个 vault，不能冒充文件备份。书架 JSON 清单不再宣称是完整备份。选择文件后先呈现差异和路径映射，不提供 JSON 大 textarea 输入。

Repository 状态展示未保存、保存中、外部冲突、阻塞与诊断，支持重试。重载有独立二次确认及放弃未保存变更提示。RecoveryPanelStatus 展示 pendingTargets、deletedAnnotations 和可选 repairs；分别调用待写重试、标注恢复和以目标 path 为 id 的重新检查，不在 UI 推断“损坏目标即用户删除”。

摘录模板只允许目标 renderer 提供的固定占位符。使用 4000 字符上限的小型编辑控件，预览以 textContent 显示；不执行 JS、不把模板当 HTML。未知占位符或编辑后尚未重新预览时禁用保存。渲染算法属于目标模块，本面板只显示 renderer 的样本输出。

## 验证

文献回归覆盖 CSL/BibTeX/Zotero、稳定 ID、作者角色、嵌套/宏/附件、无效与超限输入、未确认路径、无附件、冲突、幂等更新、手写字段（含空作者）及 LibraryIndex 真入口。面板回归覆盖文件选择、路径改动使旧计划失效、原计划对象身份、恢复前确认、异步忙碌/备份失败、Repository 重试与二次重载、三类恢复动作、固定占位符和旧 host 兼容。分页用例核验超过 200 条文献/路径和超过 100 条修复项可访问，跨页编辑不会丢失。

此验证使用合成数据与 DOM double。真实 Obsidian 文件对话框、下载落盘、跨设备备份恢复和主题视觉仍需主代理统一验收。本轮不 commit、push 或 deploy。

## 一手字段依据

以下仅用于核对公开导出形状，未复制外部实现，也未调用云或私有 API（读取日期 2026-10-02）：

- CSL 官方 schema：<https://github.com/citation-style-language/schema/blob/master/schemas/input/csl-data.json>
- Zotero 官方 CSL JSON translator：<https://github.com/zotero/translators/blob/master/CSL%20JSON.js>
- Zotero 官方 BibTeX translator：<https://github.com/zotero/translators/blob/master/BibTeX.js>
- Zotero 官方公开 item JSON 数据实现：<https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/data/item.js>
