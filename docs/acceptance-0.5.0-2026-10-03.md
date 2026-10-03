# Margin 0.5.0 合并与桌面验收续接记录

主功能分支已按源码门禁快进合入 `main`。Mac 剩余桌面场景已执行；分支清理因 `origin/zcode/shelf-abc-rework` 未合并而停止，未删除任何候选分支。源码门禁、桌面行为和 Git 同步分别记录，不能互相替代。

## 合并和 Windows 目标

- 功能基线：`463503643608788d55e1dd15596f28545e289e1f`，对应 `codex/margin-0-5-reliability-workflows`。
- 合并前 Mac 与 FA880 的新鲜 `npm run verify` 均通过 106 个测试文件 / 571 项；两端干净，祖先关系、上游距离及 `git diff --check` 通过。随后 Mac `--ff-only` 合入 `main` 并推送，FA880 快进到同一提交。
- 用户后续指定 FA880。实际 SSH 机器名为 `FA880`，Reading Desk 专用克隆位于 `C:\Users\letain\custom-projects\obsidian-reading-desk`。原 `C:\Users\lt\Desktop\Write\custom-project\obsidian-reading-desk` 属于原 Windows 目标，不能将 FA880 的证据说成该原路径的干净状态。
- 合并只证明源码门禁；本节不构成桌面验收。合并后修复和验收脚本直接提交 `main`。
- 最终三方提交、上游距离及两端干净状态以本机 `final-parity.json` 和实时 Git 读回为准；不在验收文档内预填自身提交 SHA。

## 单元、构建与隔离领域验证

- Mac 在书签布局修复后再次运行完整 `npm run verify`：106 文件 / 571 项，以及文档、owner guard、版本、lint、TypeScript、生产构建通过。原始输出为 `verify-mac-bookmark-layout.log`。
- 新增 QA `.mjs` 单独运行 `node --check`；它们不属于仓库现有 TypeScript lint 的覆盖范围。
- `node scripts/margin-workflow-isolation-check.mjs` 使用实际 Repository、DataManagement、BackupService、RecoverySnapshotService，宿主只有内存 sink/gateway。验证活动/删除族冲突需显式决策、标注与评论整体恢复、恢复前备份、预览凭据脱敏、102 条文献仅导入两个明确选择、count/days 清理计划及最新/手工/恢复前/损坏/目录保护、原计划与单次使用约束。
- 上述领域验证没有连接 Obsidian，不证明真实 UI、`data.json` 或 recovery 文件 I/O。

## Test Vault UI 与权威读回

目标为 Mac Obsidian 1.13.7，`/Volumes/SDD2T/obsidian-vault-write/testvault`。CDP 严格筛选唯一标题包含 testvault 的 `app://obsidian.md/index.html`，随后读取 `app.vault.adapter.getBasePath()` 核对完整路径。启动前确认 Obsidian 已退出，直接启动应用并打开此 vault；没有关闭运行中的应用，没有切换 Restricted Mode。仅部署并重载 Reading Desk。

| 场景 | 实际动作与读回 | 证据 |
| --- | --- | --- |
| 真实书签创建、改名、删除 | CDP 鼠标/键盘/insertText；全选后读选区，Backspace 后读空值，再读精确输入。名称始终为 `Pointer bookmark` → `Pointer renamed`；三阶段分别读回内存与磁盘。 | `bookmark-layout-after/functional-scenarios.json` 的 `bookmarkInput` |
| Reader 核心路径 | 专属 350 页 PDF，内部 API 遍历、标签/消歧、旋转/缩放、读位重开与 API 书签操作。和上行真实输入分开记录。 | 同文件的 `reader`；不是人工操作验收 |
| 阅读列表管理 | 真实输入创建和改名，取消删除及确认删除；按稳定列表 ID 比较内存/磁盘名称与不存在状态。 | `workflow-final/functional-scenarios.json` 的 `shelf.list` |
| 书架现场与草稿 | 搜索 + PDF 格式 + table 模式保存到磁盘，关闭并重开读回。只在夹具 leaf host 延迟标题保存，作者新草稿和焦点保留，随后磁盘读回两字段。 | 同文件的 `shelf` |
| 文献导入 | 实际 ImportExportPanel，CDP 文件入口；102 条逻辑内存附件候选须显式确认，取消/全选、跨页选 0 和 100，实际仅应用这两条。 | 同文件的 `settings.bibliography` |
| 逐对象恢复 | 实际控件选择合并/策略及标注族 keep-current/use-backup，重新预览、失效保护、取消及双确认；内存 Repository 中恢复前备份、评论族状态读回。 | 同文件的 `settings.backup` |
| 快照管理与清理 | 实际刷新、载入预览、count/days 预览、取消、改变策略使确认失效、双确认；仅内存 gateway 删除两个旧自动快照，五个保护对象保留。 | 同文件的 `settings.recovery` |
| 源锚点诊断 | 专属真实 PDF 的标注注入旧 stat，真实打开高亮列表、展开诊断并查找引文；出现“文件信息变化”和 `cross span phrase`，几何在内存与磁盘保持一致。 | 同文件的 `source` |

macOS 的原生 `<select>` 弹出菜单不能由本轮 CDP 键盘事件完成：隔离探针收到可信 ArrowDown 后，后续 Enter 未到页面且无 change。`margin-native-select-bridge.mjs` 每项重新核对唯一目标/vault，以稳定请求 ID 对接 CUA 原生菜单输入，再由 CDP 独立读回精确值。workflow 的证据因此标记为 **CDP 鼠标/键盘 + CUA 原生菜单**，不是纯 CDP 或内部赋值。

Settings 面板挂载到 Test Vault 的隔离容器，使用真实产品 DOM 与领域模块，但没有将 `app`、vault、文件系统或真实 `plugin.dataPanelHost()` 传给恢复/导入/清理宿主。候选附件和 recovery 路径是逻辑内存夹具，不能宣称为真实文件导入/删除验收。OS 文件选择对话框仍未验证。

## 清理与窄布局

- `withFunctionalFixture` 按专属 PDF/目标/封面及记录 ID ledger 清理。列表只按捕获 ID + 精确夹具名称清理，出现用户关系或名称变化即保留并失败；场景清理失败会阻止外围夹具删除并留下 ledger。
- 保存拦截只在专属 shelf leaf 的 host；关闭前释放并等待本轮保存，核对 wrapper 身份后恢复。书架偏好仅在当前单字段仍等于本轮最后保存值时恢复，避免覆盖其他 leaf 的更新。没有旧整库快照覆盖。
- Settings teardown 销毁自身面板、容器和 global key；本机两份输入文件在 SHA-256 与专属路径核对后删除。没有删除任何真实用户 recovery 文件，运行造成的原件保护快照继续保留。
- 连续 workflow 清理后剩余夹具记录为 0、夹具目录已移除、原活动 leaf 恢复；插件读回为 7 本书、5 条标注、2 组评论、列表/deleted/pending 为 0，Repository `ready`，原 persisted fingerprint 为 `9ff39713:8870`。
- 当前主题下，列表管理在约 610px leaf 与恢复预览在 360px 独立容器进行了有限一轮截图核验；窄预览 `clientWidth = scrollWidth = 360`。截图包括 `workflow-list-manager.png`、`workflow-settings-narrow.png`、`workflow-source.png`。
- 该轮发现书签跳转按钮固定高 30px、两行文字高 37.5px，真实 DOM 断言失败。最小产品修复仅在 `assets/styles.css` 的书签按钮规则加入内容自适应高度，保留 30px 最小高度。重新部署后的按钮高 49px、两行文字完全包含，真实书签链与磁盘读回通过；对照证据为 `bookmark-layout-before` 和 `bookmark-layout-after`。

## 构建部署与证据适用范围

修复后最终 BUILD_ID：`0.5.0+2026-10-03T06:25:17.394Z`。顺序部署 `main.js → manifest.json → styles.css → pdf.worker.mjs`，逐项 SHA-256 一致；仅重载 Reading Desk 后该标识出现在新的 `[Reading Desk]` 启动日志，Repository ready，Reading Desk scoped errors 为 0。

| 产物 | 源与部署 SHA-256 |
| --- | --- |
| main.js | `b9fe443fc86b375ab7b45ddca907547437c96d6786e6857df00ccf3fdf1fabe3` |
| manifest.json | `3278a607204ff58526455463192fde6d5362b56ec240175b2965af9d41f82d8f` |
| styles.css | `e7520d917760fa0e24769b83102a43acf15100c18d7e51a1730b5573734a0474` |
| pdf.worker.mjs | `7c237f83fa56bce645d8af51d183c9c56ba7b2d2928ff42754dc7020bea36323` |

完整 workflow 在 `0.5.0+2026-10-03T06:11:10.031Z` 连续通过，UTC 06:15–06:20。之后产品变化只有书签按钮的高度规则，`src/` diff 为空，恢复、文献、书架与源诊断模块没有变化；因此保留该轮的明确构建身份与作用范围。书签布局及真实输入在最终 06:25 构建重新运行通过（06:27），不将早期 workflow 冒充为新构建重跑。其他插件错误不计入 Reading Desk 失败。

本机证据根：`.obsidian-debug/margin-0.5/fa880-continuation-20261003/`，原始日志/截图不入 Git。哈希只证明产物部署，测试只证明各自覆盖范围；上表行为结论来自 UI 与权威读回。

## 分支清理阻塞与尚未验证边界

原 Mac fetch refspec 只覆盖部分分支；本轮额外抓取所有 `refs/heads/*` 后发现 `origin/zcode/shelf-abc-rework` 没有被 `origin/main` 包含。基线扫描 `origin/main...origin/zcode/shelf-abc-rework` 为 7/6，右侧六个独有提交为：

`1382c82`、`0a133aa`、`bafe88a`、`7577d5b`、`ad33e2e`、`b998888`。

它们包含 ADR 0007、书架 A/B/C 重构、分类管理与后续修复。按用户“发现任何未合并分支，停止清理”要求，所有候选分支均保留，不强制删除、不擅自合并旧分支；永远保留 main/origin/main/origin/HEAD。已合并候选证据和未合并证据分别保存。下一步需要先明确该旧分支的处理，再重新执行包含关系门禁。

没有把这些有限夹具外推为所有 PDF、主题、DPI、Windows 原生 UI、OS 文件对话框、真实用户库恢复/清理、跨进程文件事务或同步竞争的保证。原 Windows 路径的状态仍不在 FA880 证据覆盖内。“不存在非 main 分支”尚未达成，整体目标不能标记完成。

## 后续重跑

`margin-workflow` 在 Mac 需要明确的原生菜单控制器。设置 `RD_NATIVE_SELECT_QUEUE` 后，runner 写出请求并等待；控制器核对请求对应窗口、控件与 live 进程，用 CUA 输入并以相同 ID 写响应，CDP 再核验值。没有控制器时会明确失败，不能用 DOM 赋值代替真实输入。

```bash
RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/domain node scripts/margin-workflow-isolation-check.mjs
RD_CDP_URL=http://127.0.0.1:9222 RD_VAULT_PATH=/Volumes/SDD2T/obsidian-vault-write/testvault RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/reader node scripts/enhancement-smoke-cdp.mjs margin-reader
RD_CDP_URL=http://127.0.0.1:9222 RD_VAULT_PATH=/Volumes/SDD2T/obsidian-vault-write/testvault RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/source node scripts/enhancement-smoke-cdp.mjs margin-source
```

若脚本中断，先检查 live 进程和 retained ledger。原场景清理阻塞必须先解决；不可直接重跑或用全库 restore 隐藏失败。
