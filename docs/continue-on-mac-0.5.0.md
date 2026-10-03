# Margin 0.5.0 当前续接入口

2026-10-03：功能分支已经按门禁快进合入 `main` 并推送，Mac 的书签、书架、隔离设置与源锚点剩余验收已执行。最新证据、构建身份、有限验收边界和清理阻塞见 [验收记录](acceptance-0.5.0-2026-10-03.md)。实现历史见 [10 月 2 日记录](implementation-0.5.0-2026-10-02.md)。

## 当前仓库与工作方式

- Mac：`/Volumes/SDD2T/obsidian-vault-write/custom-project/obsidian-reading-desk`。
- 用户后续指定 Windows 机器 FA880，实际专用克隆：`C:\Users\letain\custom-projects\obsidian-reading-desk`，SSH 机器名已读回。
- 原 Windows `C:\Users\lt\Desktop\Write\custom-project\obsidian-reading-desk` 不在 FA880 证据覆盖内；不要声称核验了该原路径。
- 当前工作分支为 `main`。后续修复直接提交 main，不再创建或保留旧功能分支用于验收。
- 保留任何新用户修改，先核对两端 status/HEAD/upstream/origin。没有使用 OpenCode，继续时不要调用。
- 仍需阅读 AGENTS.md、审查/实现记录、`docs/enhancement-modules.md` 与所引 ADR，按已有实现继续，不要重新实现完成的功能。

## 已完成的剩余验收

书签输入 helper 已改为平台全选 → 选区读回 → Backspace 清空读回 → 精确 insertText 读回，预期仍为 `Pointer renamed`。最新真实创建/改名/删除均有磁盘读回，和内部 API 核心测试分开记录。

`margin-workflow-settings.mjs` 已补齐，书架/设置 workflow 在审查隔离与清理后接入 smoke runner。列表按稳定 ID 管理并读回磁盘，搜索 + PDF 格式 + table 模式保存后重开，夹具 leaf 的延迟保存保留作者草稿与焦点。恢复、文献和快照执行只使用实际领域模块背后的隔离内存 Repository/Gateway，用户 recovery 文件未删除。

macOS 原生 select 菜单不能靠本轮 CDP 键盘事件完成。workflow 需 `RD_NATIVE_SELECT_QUEUE` 和 CUA 原生菜单控制器；每项校验唯一 CDP 目标及 vault，再匹配 request id，输入后读回真实 select 值。不允许 DOM 赋值替代。

有限视觉检查发现窄书签按钮固定高度溢出，产品修复仅为对应规则的内容自适应高度。修复前 30px 按钮容不下 37.5px 两行文字；修复后实际 49px，文字边界完全包含，真实书签链重跑通过。全量 verify 为 106 文件 / 571 项。

最新部署 BUILD_ID：`0.5.0+2026-10-03T06:25:17.394Z`，四产物顺序部署与 SHA、仅 Reading Desk reload/fresh startup 证据在验收记录。不能把部署哈希、源码门禁或隔离领域检查替代桌面验收。

## 尚未完成：安全分支清理

必须抓取实际所有 heads，不能只相信原 Mac 的有限 fetch refspec：

```bash
git fetch --prune origin 'refs/heads/*:refs/remotes/origin/*'
git branch -a --merged origin/main
git branch -a --no-merged origin/main
```

`origin/zcode/shelf-abc-rework` 尚未被 main 包含，有六个独有提交。按用户要求，一旦发现未合并分支，**停止整个清理流程**。目前未删除任何候选，不强删、不擅自合并该旧分支，永远保留 main/origin/main/origin/HEAD。需先明确旧分支处理，再重新逐个检查包含关系；源码/UI 验收通过不能授权绕过此门禁。

最终三方 HEAD 与干净状态以实时 Git 及本机 `final-parity.json` 为准。存在此未合并分支时，不能宣布“无遗留非 main 分支”或整体目标完成。

## Test Vault 与重跑安全

Mac Test Vault：`/Volumes/SDD2T/obsidian-vault-write/testvault`。必须唯一匹配标题包含 testvault 的 `app://obsidian.md/index.html`，再读取实际 vault 完整路径。不要选择第一个窗口，不重启运行中的 Obsidian，不切 Restricted Mode。仅部署/重载 Reading Desk。

```bash
RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/domain node scripts/margin-workflow-isolation-check.mjs
RD_CDP_URL=http://127.0.0.1:9222 RD_VAULT_PATH=/Volumes/SDD2T/obsidian-vault-write/testvault RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/reader node scripts/enhancement-smoke-cdp.mjs margin-reader
RD_CDP_URL=http://127.0.0.1:9222 RD_VAULT_PATH=/Volumes/SDD2T/obsidian-vault-write/testvault RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/source node scripts/enhancement-smoke-cdp.mjs margin-source
```

重跑前确认没有上次仍运行的脚本、pending native 请求或 retained fixture。失败先看 live handle、ledger 和确切范围，不用整库 restore 隐藏失败。按捕获 ID/专属路径清理，用户 recovery 与覆盖前快照原件继续保留，不触碰其他插件。

## 本机证据

根目录：`.obsidian-debug/margin-0.5/fa880-continuation-20261003/`，不加入 Git。

- `source-gate-approved.json`、`mac-ff-merge.json`、`fa880-main-sync.json`：门禁与基线合并同步。
- `verify-mac-bookmark-layout.log`：修复后的完整验证。
- `workflow-isolation-domain.json`：隔离领域检查。
- `workflow-final/`：连续 workflow 行为、内存隔离范围、窄预览、精确 cleanup 与 native 请求记录。
- `bookmark-layout-before/`、`bookmark-layout-after/`：真实布局失败/修复对照，后者含书签输入与磁盘链。
- `deploy-bookmark-layout.json`、`layout-runtime/reload.json`：最终部署与 fresh startup。
- `final-parity.json`：最终 Mac/FA880/origin 提交与清理候选证据。

当前证据不覆盖 Windows 原生 UI、OS 文件对话框、真实用户库恢复/快照删除、所有主题/PDF/DPI 或跨进程同步竞争；原 Windows 路径也未借 FA880 的结果冒充核验。
