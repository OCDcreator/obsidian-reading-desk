# ADR 0017：豆瓣在线元数据丰富与 ADR 0011 的调和

- 日期：2026-10-08
- 状态：Accepted
- 范围：`src/library/metadata/`（DoubanClient、MetadataEnricher）、`LibraryIndex.enrichBooks`、`LibraryMetadata.applyEnrichment`、`BookCard` 待确认角标、设置页书库 tab、宿主接线（`DoubanRequestTransport`、`main.ts`）。补充并显式调和 ADR 0011；书架形态仍以 ADR 0007 为准。

## 决定与 owner

ADR 0011 禁止的是**实体合并**：不凭 DOI、ISBN、标题或文件名把两条书目记录合成一条。本 ADR 明确允许的是**对既有单本书的字段级补全**：在线丰富只写空白字段，绝不触碰 `metadataOverrides`，绝不改写已有 `source` 身份字段（无来源的书命中后才写入 `provider: 'douban'` 的来源证据），绝不合并书目记录。两者共存：**不自动合并实体，允许字段级补全 + 低置信待确认**。

`DoubanClient` 是唯一豆瓣协议 owner：`subject_suggest` 搜索 + 条目页 HTML 解析（JSON-LD 与 `#info`/og meta 双通道）+ 带条目页 `Referer` 的封面下载；transport 注入，宿主经 `DoubanRequestTransport` 走 Obsidian `requestUrl`。**不复制 wanxp/obsidian-douban（GPL-3.0）任何代码**，仅参考其端点事实。

`MetadataEnricher` 是刮削策略 owner：置信度判定（ISBN 一致或「标题全等 + 作者相符/无本地作者」为高置信，其余为低置信）、串行队列 + 4–8s 随机间隔、HTTP 403 触发当日熔断（`blockedUntil` 持久化到设置，本地次日零点恢复）。它只产出字段级 patch，写入一律经 `LibraryIndex.enrichBooks` 单队列提交；`applyEnrichment` 纯函数落实只补空白：书名仅在自动值为空或等于文件名启发值时补，作者仅在自动值为空时补，评分（豆瓣 10 分制直存，库内 rating 本就 0–10）/页数/封面仅在缺失时补。

低置信命中与「全部标记待确认」设置开启时的全部命中写入 `needsReview`，书卡封面右上角显示只读「待确认」角标；任意一次人工书目编辑（`applyBookPatch`）即视为已确认并清除该标记。`enrichment` 记录（时间、matched/missed/failed、置信度）用于 30 天自动重试冷却，不作为书目身份证据。

触发面（蓝图 D4）：手动（设置页「刮削缺失信息的书目」、P2 书卡右键「重新刮削」）+ 扫描后新书自动；存量全库批量只经手动入口，不做静默全库刮削。

附带修正：持久化校验的 `rating` 上限由 5 改为 10，与 ADR 0011「评分沿用 0–10」及台账 UI 一致（此前评分 >5 的书目在 Repository commit 校验中会被拒）。

## 验证

- 单测（mock transport，零网络）：ISBN 命中高置信、标题命中高置信、作者冲突低置信 `needsReview`、reviewAll 全标记、只补空白（人工覆盖/作者/评分/封面不动）、未命中只记录、403 熔断与当日短路、串行 4–8s 间隔、自动路径过滤（有来源/元数据完整/冷却中跳过）、未知书目拒绝与单次提交、校验层接受 douban 来源与 0–10 评分。
- 实机：testvault 真实刮削中文书，核对字段、封面写盘与界面刷新；证据进 `docs/self-check/`。

## 参考

- 蓝图与决策：`docs/reports/reading-desk-upgrade-2026-10.md`（D1–D4）
- 身份边界：ADR 0011；书架形态：ADR 0007；端点事实：蓝图 §3（2026-10-07/08 两次实测）
