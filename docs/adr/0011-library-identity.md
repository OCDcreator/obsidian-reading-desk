# ADR 0011：稳定书目身份、字段来源与书库增量组织

- 日期：2026-10-02
- 状态：Accepted
- 范围：LibraryIndex、只读 AnnotationSearchService；补充 ADR 0003 与 ADR 0004。

## 决定与 owner

`LibraryIndex` 是书目、分类、阅读列表及其关联关系的唯一写入入口。`MetadataExtractor` 继续只提取文件信息；不处理人工编辑、文献身份或标注。`LibraryMetadata` 和 `LibraryImport` 是 LibraryIndex 使用的纯合并/校验模块，没有独立持久化或第二套索引。`LibraryTypes` 定义服务输入和输出。

`AnnotationStore` 仍是摘录、标签与评论的真源。新 `AnnotationSearchService` 每次从 `listAll()` 与 `comments()` 读取当前内容，不维护可编辑副本、缓存索引或目标写入路径。全库界面由 shelf owner 实现。`main.ts` 管 Vault 事件、用户确认入口、AnnotationStore/待写/回收站路径映射与目标文件重写，不直接修改书目。

## 标题、作者与来源

`autoMetadata` 保存自动标题和作者；`metadataOverrides` 保存人工值，显示字段取人工值优先。作者覆盖为 `''` 是有效的主动清空，不能用 truthiness 回退。`updateBook`/`batchUpdate` 的 title/author 编辑创建覆盖；`clearMetadataOverride(id, fields)` 按字段移除覆盖并恢复最新自动值。

扫描、文件更新及封面重试保留人工覆盖并更新文件自动值。解析失败保留已知自动信息、页数与封面，同时记下诊断；重试成功可恢复。已有 `source` 与 `autoMetadata` 时，标题/作者采用文献源的自动值，文件扫描仅刷新文件/封面/页数诊断；下一次文献导入更新文献自动值。`source` 的 provider/id/DOI/ISBN/citationKey 保留来源证据，不用 DOI、ISBN、标题或文件名自动合并实体。

旧记录尚无来源字段时以当前 title/author 建立自动基线。历史人工编辑与历史自动提取无法从旧结构确定区分；本决策不猜测历史字段来源。

## 路径、缺源与重新关联

book ID 是实体身份，path 是可变关联。全扫描不再把未出现的记录删除，改为 `missing: true`；原 ID、组织、进度与标注仍可被重新关联。增量 `scanFiles` 不以未传入文件推断缺失。源文件重新出现时清除 missing，指纹未变化可直接复用已提取信息。`markMissing` 仅标记指定路径/文件夹下书目，不移除标注。

路径 Map 可重建，单次文件查找不遍历全库。LibraryIndex 所有写操作在自身队列内顺序执行。`readBooks()` 整体换对象时自动重建；宿主以同一个对象恢复书库后须调用 `rebuildPathMap()`。持久化失败后也按适配器实际保留/回滚的书库重建 Map，后续队列可继续。

`findRelinkCandidates` 只提供同名/相同 mtime-size 的候选，二者均不证明文件身份。离线 `relink` 要求 `confirmed: true`，保留原 book ID；新路径已被另一记录占用时默认拒绝。用户确实确认替换该候选书目后，可传 `replaceBookId`，服务才移除被替换的书目记录。宿主确认界面必须披露候选已有身份，并协调候选关联数据；服务绝不根据候选同名自动合并。未经明确替换确认，全扫描后原缺源实体与新路径实体各自保留。

在线 Vault rename 使用 `renamePaths`，按精确路径或以 `/` 为界的子路径迁移单文件/整个文件夹，不提取元数据；与迁移范围外实体的新路径冲突时整批拒绝。`relink` 也支持 `skipExtraction`，用于宿主已确定源身份的情况。

路径迁移提供纯同步 `mutateRelated(oldPath, newPath)` 回调，与书目写入处于同一次 `LibraryPersistence.commit`。宿主在回调里只映射内存高亮、待写、回收站及目标引用，文件重写另由 TargetService 协调。回调异常上抛；关联状态与书目的事务回滚由 Repository 保证，LibraryIndex 不另建事务数据库或补偿副本。

## 增量批次与导入

- `scan(files, folders, retryRecoverable?)` 保留全扫描对账；缺源只标记，不删除。
- `scanFiles(files, folders = [], retryCovers = false)` 只提取新增/变化文件；同路径输入取最后一个，一批变化一次 commit。
- `applyFileEvents(events, folders = [])` 接收 `{ type: 'upsert', file }` / `{ type: 'delete', path }`，同路径最后事件生效，提取与缺源标记一批提交。main 的宿主事件防抖可直接调用 scanFiles。
- `applyImportedBooks(books)` 先用纯计划校验整批，再由 LibraryIndex 单次 commit；`updateImport(update)` 复用此入口。

文献重复导入以 `(source.provider, source.id)` 匹配，显式书目 ID/确认路径也参与身份检查。不同线索指向不同实体、重复 source ID、路径改动或不同文献源占用路径都拒绝提交整批。路径变化必须先完成 relink。更新保留当前人工覆写、进度、评分、分类、阅读状态和列表，标签取去重并集；明确的导入自动字段刷新 `autoMetadata`。导入计划由 portability owner 生成与确认，不能把未确认同名建议直接当写入计划。

## 批量组织与列表

`batchUpdate(ids, patch)` 对全批书目、评分范围、分类/列表引用先校验，失败时不提交部分结果。标签与列表都支持 `append`/`replace`/`remove`，默认 replace；trim 后去空去重。categoryId/rating 可用 null 清除。评分沿用已有 0–10 数据范围，UI 选项仍由前端决定。

`LibraryList` 仅包含 id/name，书目通过 `listIds` 多对多关联，列表不复制书籍实体。`listLists/createList/renameList/deleteList/setListMembership` 管列表；删除列表只移除成员引用。`readingStatus` 是显式状态，进度更新不机械改变它。`readLists` 为可选持久化 API，旧适配器可继续扫描与编辑已有字段；若缺少 readLists，列表写入明确报错，不创建不落盘的内存列表。

## 全库检索

`new AnnotationSearchService(annotationStore, library?)` 的同步 `search(query)` 支持 text/tags/color(s)/chapter/bookId(s)/pdfPath(s) 组合，过滤维度之间取 AND。text 按空白拆分为多个词，所有词须在同一条摘录及其评论合并文本中命中；标签默认 all，可选 any。chapter 为完整章节路径的子串，chapterPath 为准确祖先前缀。文本与标签规范化大小写/Unicode，路径与稳定 ID 精确匹配。

每个结果返回 highlightId、pdfPath、page 与可选书目信息、摘录、标签、章节、评论/命中评论。结果数组和评论复制后交给呈现层，修改结果不能改变真源。无书目或缺源记录的摘录仍可按文本和路径检索。评论修改/删除、高亮改色/改标签/删除后，下一次查询直接反映当前状态。结果按源路径、页面、创建时间、稳定 ID 排序。

## 验证

定向测试覆盖人工标题及空作者、独立恢复、文件变化/提取失败/封面重试、万本库单文件提取、增量不误删、批次去重单提交、缺源保留与复现、路径 Map 重建、慢扫描与编辑顺序、确认 relink/同名不合并、文件夹 rename/占用冲突、同事务 related 回调与失败、批量组织/多列表/状态、导入幂等/整批冲突、全库评论检索即时更新与只读结果。

单次提交的测试不等同于跨文件原子性或多设备冲突验收；Repository 与 TargetService 的恢复/写入机制由各自 owner 的测试保证。
