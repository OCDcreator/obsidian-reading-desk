# ADR 0009：目标核验保护、可恢复删除与目标写入恢复

日期：2026-10-02。状态：Accepted。

## 背景与约束

依据 `docs/research/reading-desk-enhancement-review-2026-10-02.md` 的前三项数据保护边界，实现目标 metadata/标记损坏保护、人工内容保护和跨目标/data.json 写入恢复。此决定补充 ADR 0004，保留合法删除目标卡片后的反向清理，不改变 AnnotationStore 的唯一标注真源、TargetService 的目标文件写入所有权及归一化 PDF `rects[]`。

## 目标核验

`TargetService.reconcileTarget(target, candidates, store)` 返回 `{ removedIds, diagnostics }`；旧 `removeMissingTargetHighlights` 委托该方法并继续返回 ID 数组。只核验当前 AnnotationStore 中仍属于相同路径、相同格式的候选，避免旧事件删除已转移的标注。

- 完整、可解析文档中摘录卡片确实不存在：先归档，再清理活动高亮、评论和卡片状态。
- Markdown 标记残缺、嵌套、错配、重复，JSON 缺失/损坏、ID 不一致或孤立 metadata：保留标注，诊断待修复。标记被整体移除但回链仍在，也属于身份损坏。
- Canvas nodes/edges、Excalidraw scene/elements 结构损坏或 ID 歧义：整文件保护；不把解析失败视为空目标。
- 原 objectId 对应的对象仍在而 metadata 被删改：保留对应标注。Excalidraw 有效对象的 `isDeleted: true` 表示合法删除，可恢复时复用其对象 ID。
- 正在等待目标写入的标注不参与反向删除，防止 Reading Desk 自写或恢复过程中触发的 modify 事件误删真源。
- 文件暂缺或读取失败：保留标注/评论，诊断待修复。`FileGateway.read(path): Promise<string | undefined>` 是可选只读探测，`undefined` 表示暂缺，不创建文件。兼容旧 gateway 时可使用 atomicTransform 读取，但宿主必须在核验前检查实际文件存在；生产主接线提供 read。

`reportMissingTarget(path, candidates?)`、`listPendingRepairs()` 提供宿主删除事件与数据面板所需的诊断接口。诊断包含 target、highlightIds、reason、message；成功重新核验或写入清除该路径的旧诊断。诊断是可重建的运行时状态，不另建标注持久化来源。

## 可恢复删除

`AnnotationPersistence` 增加可选 `readDeletedAnnotations(): Record<string, DeletedAnnotation>` 与 `readPendingTargetWrites(): Record<string, PdfHighlight>`，由 Repository 和 main 的持久化接线提供。

`AnnotationStore.remove(id, reason?)` 默认 reason 为 `user-deleted`；`removeMissingTargetIds(ids)` 使用 `target-deleted`，整批在一个 commit 中存下 Detached 高亮、评论、卡片状态、deletedAt 和 reason，然后移除活动记录与该 ID 的待写意图。同 ID 已删除时不覆盖既有恢复记录。

`listDeleted(): DeletedAnnotation[]` 返回隔离副本；`restoreDeleted(id): Promise<PdfHighlight>` 在 Repository commit 闭包内重新取得最新墓碑并检查活动 ID，复制该时刻的高亮、评论和卡片，清理该墓碑，并返回实际提交的高亮。恢复不在入队前捕获旧 record，所以前序 queued rename/remap 或替换墓碑不会被旧路径/旧评论覆盖。如果原来有 target，同时创建待写意图，避免恢复后立刻被反向核验再次删除。活动 ID 冲突时拒绝覆盖。

兼容旧 AnnotationPersistence 的删除恢复记录只存在内存；生产必须提供 readDeletedAnnotations 才能重启恢复。目标写入事务没有这种降级：缺少 readPendingTargetWrites 时拒绝开始可恢复写入。

## 持久化目标写入

`TargetService.writeAndSaveExcerpt(target, highlight, store, options?)` 返回原 `TargetWriteResult`，并承担整个流程，ReaderExcerptWriter 只调用此入口：

1. `store.stageTargetWrite(highlightWithTarget, card?)` 成功保存高亮和意图，并返回本次写入的 `AnnotationTargetWrite` 凭据；显式 title/folded 同时保存在 excerptCards，显式 chapterPath 写入高亮。没有活动标注且没有墓碑的初次创建仍合法；排队期间活动数据改变或 ID 已删除时拒绝旧 stage。
2. 检查存在的目标文件，使用凭据的固定高亮快照和最新文件内容原子、幂等写入目标。
3. `store.completeTargetWrite(receipt, writtenTarget, card?)` 在一个 Repository commit 闭包中重新读取当前高亮、墓碑、待写意图和卡片，验证意图对象身份及内容签名、当前高亮和卡片签名。验证成功后仅给当前高亮补入目标 objectId，并保存目标实际标题/折叠状态、清除本次对应意图；不在 I/O 后全量覆盖高亮，不再分开 save/finish。

任何一步失败都抛错；初次意图保存失败时绝不写目标。completion 返回 `completed | pending | deleted`：并发 rename/remap、改色、tags 或卡片变化使旧写入过期时，保留最新活动数据/意图并返回 pending；旧意图未变化而活动数据变化时，用当前活动快照更新待写意图以供 retry。较新意图即使内容完全相同也不能被旧凭据清除。并发 remove 后 completion 不创建活动高亮、不修改墓碑或评论，返回 deleted。TargetService 只有 completed 才正常返回，其余状态抛可重试/已删除提示，不报告旧操作保存成功。

目标写入和上述阶段受相同路径串行锁保护；跨路径写入与 Repository 排队修改的最后完成判定仍必须在提交闭包内。`finishTargetWrite(id)` 保留兼容 API，但也捕获并验证本次调用观察到的意图/源数据，不能按 ID 无条件清除后来替换的意图。

原子 completion 的持久化失败时，磁盘仍保留先前 durable 意图。对于先改内存再保存的端口，Store 用一个本地失败 ID 集合让 listPendingTargetWrites 继续呈现当前活动高亮供手动重试，不在 Repository 队列外补写/修改 pending record。重试重新 stage 当前活动数据，成功 completion 清除该集合；删除也清理该集合。Repository 自身仍管理未保存快照与保存重试。

`listPendingTargetWrites()` 给数据面板查询；`retryPendingTargetWrites(store)` 逐项调用同一事务并返回 `{ highlightId, status: 'recovered' | 'pending', message? }[]`，单项失败不阻塞其余项。单条手动重试可直接调用 writeAndSaveExcerpt。重试优先使用当前真源高亮、已有卡片状态与当前模板 getter；稳定 highlightId 使已完成目标写入可再次执行而不产生副本。

若提供 files.read 且目标暂缺，写入和重试都报 unavailable，保留意图且不创建空文件。main.createTarget 负责先创建新目标。默认不进行启动自动重试；恢复目标由用户手动触发。跨文件没有事务原子性，本方案提供可检查的先行日志和幂等重放。临时 sourceLink/template 覆盖不存入 PdfHighlight；重启恢复按当前模板设置和稳定原文链接重建。需要永久自定义这两个字段时须另立持久化契约。

## 目标内容更新与旧数据迁移

TargetCardMetadata 可附加 `managedText`，记录上次插件生成的正文基线。格式适配器只替换可靠识别的管理正文；标题和折叠取目标当前状态，只有调用方显式 title/folded 时改变它们。其余手写内容保留。Canvas 的折叠映射继续使用原生 72 高度；Excalidraw 同步 text、originalText 和 link，保留外层 Markdown/frontmatter 和场景字段。

Markdown 旧块没有 managedText 时，仅去掉确定的旧标题行、正文前端精确匹配的原文和已知回链；剩余内容原样保留。Canvas/Excalidraw 或改过的管理正文无法完整匹配时，保留整段旧内容并补入新管理正文；可能保留旧引文副本，这是避免猜测删除人工文字的保守取舍。后续更新使用新基线，不重复吞掉或累积笔记。

删除适配器只能删匹配版本 metadata、highlightId 和指定 objectId 的插件卡片，不能凭 objectId 删除普通用户对象或其他摘录。

## 模板与宿主接线

`new TargetService(files, { template?, onRepair?, onRecovery? })`：template 是 `() => string | undefined`；onRepair 接收完整当前诊断数组；onRecovery 接收一批重试结果。宿主回调失败不改变已进行的持久化事务。事件监听、读取 Vault、Notice 和面板呈现仍归 main/UI。

`ExcerptTemplate` 提供 `EXCERPT_TEMPLATE_PLACEHOLDERS`、`DEFAULT_EXCERPT_TEMPLATE`、`excerptTemplateValues`、`previewExcerptTemplate` 和 `renderExcerptTemplate`。允许 `{{title}}`、`{{text}}`、`{{page}}`（显示页码）、`{{pdfPath}}`、`{{sourceLink}}`、`{{color}}`、`{{chapterPath}}`、`{{tags}}`。单次占位符替换，不递归解释原文，不执行 JS、不求值表达式；预览列出未知占位符，写入时拒绝未知占位符。

## 模块与验证

- `src/annotations/AnnotationStore.ts`：活动真源、删除快照、恢复 API、待写意图及原子 completion。
- `src/annotations/AnnotationTargetWrite.ts`：固定写入快照、意图身份/规范化签名和 completion 状态。
- `src/targets/TargetService.ts`：目标事务、路径串行锁、只读核验、重试和运行时诊断。
- `src/targets/TargetRepair.ts`：诊断类型、metadata 校验、保守正文更新策略。
- `src/targets/MarkdownTargetAdapter.ts`、`CanvasTargetAdapter.ts`、`ExcalidrawTargetAdapter.ts`：各格式数据校验、用户文字保护及幂等写入/删除。
- `src/targets/ExcerptTemplate.ts`：安全固定占位符与预览。
- `test/annotations/AnnotationRecovery.test.ts`：删除快照、评论/卡片/几何恢复、冲突与持久化意图。
- `test/targets/TargetProtection.test.ts`：损坏/暂缺/身份丢失保护、合法删卡恢复、人工文字/折叠保护及过期事件候选。
- `test/targets/TargetWriteRecovery.test.ts`：stage/target/原子 completion 顺序、故障恢复、退出后重放、失败后继续、幂等性和自写 modify 串行边界。
- `test/targets/TargetWriteConcurrency.test.ts` 与 `TargetConcurrencyFixtures.ts`：真实 Repository paused I/O / queued remap/recolor/tags/delete、较新同内容意图、卡片保护、初次创建和 retry。
- `test/annotations/AnnotationQueuedRecovery.test.ts`：queued rename 后恢复最新墓碑、queued 删除/活动 ID 冲突和实际返回数据。
- `test/targets/TargetRepositoryRecovery.test.ts`：真实 Repository 的目标保存失败重启恢复与恢复快照失败重试。
- `test/targets/ExcerptTemplate.test.ts`：占位符、未知表达式、无 JS 执行及模板更新保留笔记。

门禁包含项目文档、职责检查、局部 ESLint、定向 Vitest 和 TypeScript 检查；最终运行结果由本次交付报告记录。此代理只修改获准 targets/annotations、相应测试和本 ADR；宿主/阅读器/数据面板接线由其文件 owner 实施。本次不 commit/push/deploy。
