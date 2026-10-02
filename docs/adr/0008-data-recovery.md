# ADR 0008：数据可靠性与完整备份恢复

日期：2026-10-02。状态：采用。

## 背景

旧 Repository 接受任意非空对象，保存失败后无法区分内存与已保存状态，且初始化后的整库快照会覆盖另一实例的更新。书架导出只有图书与分类，不能保护标注、评论或目标中的手写内容。此决定补充 ADR 0004 的标注真源和目标反查原则，不改变 AnnotationStore / TargetService / LibraryIndex 的职责。

## 模块职责

- `src/data/ReadingDeskRepository.ts`：单实例串行提交、原始版本比较、未保存快照、重试、重载、状态订阅与原件保护。
- `src/data/DataValidation.ts`、`DataValidationSupport.ts`、`DataRecordValidation.ts`：JSON 与领域记录形状校验、schema 0 → 1 的缺省集合/配置迁移、原始内容的规范比较。
- `src/data/RepositoryStatus.ts`：恢复状态、错误和覆盖前备份宿主契约。
- `src/portability/ReadingDeskBackupService.ts` 与 `Backup*`：完整 JSON 备份、凭据排除、路径映射、引用与重复检查、恢复冲突策略与应用前校验。
- `main.ts` 及主代理提取的宿主模块：真实 loadData/saveData、vault 文件清单、私有原件备份文件、导出与界面接线。Repository 和 BackupService 不读写目标笔记。

## 可靠加载与提交

`initialize(): Promise<void>` 在有效输入上迁移缺失字段；损坏形状或读取异常进入 `blocked`，保留诊断且不保存空库，使宿主仍能显示恢复界面。未知未来 schema 被阻止。原始已加载值由 `recoverySnapshot(): unknown` 返回独立副本。缺失文件的 null/undefined 可以作为新库；已存在但字段类型错误的文件不能被当成缺失。

`status()` 提供 `uninitialized / ready / saving / pending / conflict / blocked`、pending、revision、可显示的指纹、错误和校验路径。`subscribe(listener)` 立即发送当前状态，返回取消订阅函数；界面监听器的异常不改变持久化结果。

`commit(() => void)` 保持现有同步闭包契约。执行前重读 sink 并比较原始规范 JSON；mutator 抛错或产出无效结构时恢复提交前快照。保存失败时内存更改保留，验证后的完整快照进入 pending，调用方收到拒绝。后续正常提交包含仍未保存的更改，队列不会永久 rejected。`retry()` 重试快照，不重新运行可能生成 ID、修改外部对象的闭包。sink 如果实际写入后才报错，重试识别完全相同的已落盘快照并确认成功。

成功提交不替换现有对象引用，以兼容已排队闭包。mutator 必须同步；调用方应在闭包内通过 read* 取得当前数据。不要在 reload、replaceData 或回滚之后继续复用旧对象引用，不要在 commit 之外直接修改 read* 返回的数据。Repository 不能撤销闭包对外部对象、文件或宿主的副作用。

`reload({ discardPending?: boolean, expectedSignature?: string })` 默认拒绝丢弃 pending；明确丢弃时才加载新内容。数据管理入口在调用时没有 pending 的情况下使用普通重载，出队时若出现新 pending 仍会拒绝；已有 pending 时先保留原始完整 snapshot 的签名（包含凭据），成功备份后传入 expectedSignature，出队时再次比较，变化则拒绝并保留未保存内容。新读取失败或无效仍保留内存待保存快照。`replaceData(value, { recoverInvalid?: boolean })` 接受完整且有效的 schema 1 快照；有 pending 时拒绝恢复，避免覆盖本地未保存更改。损坏原件的显式恢复要求 recoverInvalid、已成功读取的原始值、以及 beforeOverwrite 回调。无法读取/解析原件时，宿主先修复或保存原文件，再 reload；本服务不绕过读失败直接覆盖未知内容。

readLists/readDeletedAnnotations/readPendingTargetWrites 分别提供列表、删除恢复记录和持久化目标写入意图。目标写入与 data.json 不能组成跨文件事务：TargetService/AnnotationStore 负责意图的创建、核对、恢复和清除；Repository 只保证其数据提交遵守同样的保护。

## 外部版本检测与原件备份

`new ReadingDeskRepository(sink, { beforeOverwrite })` 的可选回调为 `(original: unknown, context: { reason: 'commit' | 'retry' | 'replace'; fingerprint: string }) => Promise<void>`。每次实际覆盖已存在数据前传递完整原值，回调失败阻止写入并保留 pending。回调后再次重读 sink；主宿主把原值写到插件私有 recovery 目录中的唯一文件，本轮不自动删除。

比较使用完整的规范 JSON 文本，排序对象键并忽略 JSON 不保存的 undefined 字段；状态 fingerprint 只是短摘要用于呈现，不承担冲突判定或密码学完整性。Repository 不宣称 CAS、跨设备锁或原子 compare-and-save：外部写者仍可能在最后一次读取与 save 之间竞争。检测到差异后拒绝覆盖，展示 conflict，先导出未保存快照再重载。持续多设备自动合并不在此契约内。

## 完整备份格式与恢复

备份 envelope：`format: 'reading-desk-backup'`、`schemaVersion: 1`、ISO createdAt、credentialsIncluded、`filesIncluded: false` 和完整 data。包含图书稳定 ID/元数据、分类/列表、高亮的零起始 page 与归一化 rects[]、评论、摘录卡状态、删除记录、待写目标意图、目标引用和必要设置。原记录中的额外 JSON 字段保留；已知凭据字段会递归排除。

普通 `exportBackup`/`serializeBackup` 默认移除 accessKeyId、secretAccessKey、secret 字段；只有显式 includeCredentials 才输出凭据。恢复无凭据备份保留当前本机 storage 凭据。自动私有原件备份保留完整原值，由宿主负责私有文件存放，不将其作为普通公开导出。必要配置与凭据不同：端点、bucket、viewer、libraryFolders、模板等仍在完整备份内。

PDF page 全程为 0-based，第 1 页必须保留 0；可见页码只由展示层加一。此规则也适用于 pendingTargetWrites 和 deletedAnnotations，不因迁移或路径映射改变。坐标保留 x/y/width/height，不保存屏幕像素。

`parseBackup` 对 envelope、完整集合、schema 和记录校验；JSON 文本中的重复键在 JSON.parse 丢弃它们之前被检测并拒绝。`previewRestore(input, current, options)` 返回 canApply、候选 data、changes、duplicates、conflicts、issues、pathChanges 与 warnings。

恢复模式为 replace 或 merge；稳定 ID 内容相同为重复但可应用，不同内容默认阻止，需明确 keep-current 或 use-backup。缺失分类/列表、孤儿评论/卡片状态、重复分类/列表/评论 ID、重复图书路径、同一目标对象的冲突引用、有效/删除状态重叠等阻止应用。允许尚未索引的 PDF 引用并给警告，避免将书库之外的合法标注丢弃。跨集合的有效/删除冲突不自动选择赢家。

路径映射按最长来源前缀且只应用一次，同时更新书路径、封面、PDF 标注、目标引用、删除记录、pending 意图和 libraryFolders。拒绝绝对路径、反斜杠、控制字符和 ..；映射后的重复图书路径阻止恢复。existingPaths 应由宿主提供所有 vault 文件；源文件/目标/封面缺失为可见警告，JSON 恢复仅保留引用。

`restore(preview, host)` 只使用服务保存的内部计划；修改预览显示对象不能改变应用内容。应用前核对当前 snapshot 和仓库状态，必须成功调用 `backupBeforeRestore(backup)`，等待备份后再次核对，再调用 `replaceData(data, { recoverInvalid, expectedSignature: plan.currentSignature })`。Repository 在替换操作出队后、最新 sink 检查完成且赋值前，同步比较当前内存的规范 JSON 签名与 expectedSignature；如果此前排队的评论等提交已经完成，拒绝旧恢复并要求重新预览，保留已保存的新增内容。签名检查和赋值之间不插入 await。

expectedSignature 为可选参数，旧调用方与只接受 data 的第三方回调继续兼容；需要排队保护的宿主必须把 options 转发给 Repository，或在自己的原子替换边界履行同样检查。该签名保护本实例队列顺序，不改变跨设备最后读与写之间的竞争限制。签名不匹配时没有新 replacement pending，也不覆盖原数据；恢复候选被接受但实际保存失败时仍进入 pending，retry 重试已接受快照，不再次比较预览旧签名。显式损坏原件恢复在相同安全视图签名下仍要求 recoverInvalid 和原件备份回调。备份失败、pending、保存中、外部冲突或旧预览均不替换。调用方直接使用 replaceData 时应同样重建并验证预览，宿主原件备份回调仍必需。

## 文件内容边界

完整备份保护 Reading Desk 的全部插件数据，但不是整套 vault 文件归档。PDF/EPUB、封面图片、Markdown 人工文字、Canvas/Excalidraw 节点内容没有嵌入 JSON。必须把原书与目标笔记文件另行随 vault 备份；仅恢复插件数据不能重建目标内的手写文字或源文件。恢复后由原职责模块核对目标写入意图，不在备份服务中重写目标。

## 验证

定向 vitest 覆盖损坏数据禁止覆盖、旧 schema 与第 1 页加载、save 失败与闭包只执行一次、回滚、两实例旧快照、备份期间外部变化、写后报错重试、无凭据完整往返、引用/重复/路径冲突、旧预览与备份失败、以及显式损坏原件恢复。队列竞争回归使用真实 Repository/AnnotationStore 与可控暂停：备份回调暂停，评论入队且尚未执行，备份放行后恢复入队，评论先成功保存，旧恢复随后因签名差异拒绝；断言内存和 sink 均保留评论、没有第二次覆盖。另测 accepted replacement 保存失败后的 retry、签名不匹配不创建 pending，以及安全视图签名下损坏原件恢复仍先备份原值。源模块低于 650 行，单函数低于 220 行。真实磁盘错误、同时最后读与写之间的跨设备竞争仍需要宿主端集成验收；单元测试不把这些场景包装为分布式事务保证。
