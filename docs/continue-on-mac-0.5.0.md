# 在 Mac 继续 Margin 0.5.0

用户要求：修复 0.4 审查全部问题，再增加功能；最后要求当前收尾提交/推送/同步 Mac，剩余工作在 Mac 继续。当前产品实现已完成，继续任务重点是收完实机验收和验收中发现的问题，不要从头实现。

## 仓库与基线

- Mac 仓库：`/Volumes/SDD2T/obsidian-vault-write/custom-project/obsidian-reading-desk`
- Windows 仓库：`C:/Users/lt/Desktop/Write/custom-project/obsidian-reading-desk`
- 分支：`codex/margin-0-5-reliability-workflows`；远程 `https://github.com/OCDcreator/obsidian-reading-desk.git`。
- 当前版本 Margin 0.5.0，base commit 为 6cba7d4。先检查 Git 状态和远程提交，保留任何用户新增修改。不要默认合并 main。
- 读 AGENTS.md、`docs/review-0.4.0-2026-10-02.md`、`docs/implementation-0.5.0-2026-10-02.md`、`docs/enhancement-modules.md` 和 ADR 0008–0014、0016。
- 没有使用 OpenCode，用户没有要求时不要调用。

## 已完成实现与验证

原审查 S1–S6、T1–T3 和既有表格草稿丢失均已修复。新增快照管理/显式清理、逐对象恢复、逐条文献导入/唯一附件批量确认、列表管理/书架现场、精确读位/书签、印刷页码、源文件 stat/锚点诊断。

完整 `npm run verify` 最终通过 106 文件 / 570 项；源码、模块所有权、版本、ESLint、TypeScript 与生产构建通过。三个代理交叉审查通过，期间补修了书签恢复失败后的持久化暂停、导航首选标签覆盖，以及读位/旧进度双写。所有相关源码均已保存。

Mac Obsidian 1.13.7，目标 vault：`/Volumes/SDD2T/obsidian-vault-write/testvault`。部署插件仅 `obsidian-reading-desk`。最后已核实运行 BUILD_ID `0.5.0+2026-10-02T14:52:59.636Z`；源四文件与插件 SHA-256 一致。不要把磁盘版本当成实际已加载构建，继续时重新确认。

最终构建产物 SHA-256：

- main.js `9e04db25de09ab5ac08f70410d29dbb179b5596200fbc6f297ed58153d7c8022`
- manifest.json `3278a607204ff58526455463192fde6d5362b56ec240175b2965af9d41f82d8f`
- styles.css `f2c894b4d7053698ed8e240c861a68f49cd4b10e277b1fdf323a34dfaace00ac`
- pdf.worker.mjs `7c237f83fa56bce645d8af51d183c9c56ba7b2d2928ff42754dc7020bea36323`

部署前原四文件和 data.json 备份：插件 `recovery/pre-0.5.0-20261002-224323/`。仅用于显式恢复参考，不要覆盖当前数据。

## 剩余实机工作（按顺序）

1. **修正并重跑书签真实输入测试。** `scripts/margin-reader-scenarios.mjs` 的 350 页核心路径已经通过：全部缩略图往返、正文、印刷标签、重复消歧、旋转90/scale1.5、精确重开、内部 API 书签增删改跳转。真实 CDP 输入步骤重命名预期 `Pointer renamed`，实际保存 `Pointer bookmarkPointer renamed`，说明全选替换未生效；先调整 Mac 键盘选择/清空动作，检查输入框实际值后再点击保存。不要为了让测试绿而改写预期为拼接名称。重跑真实输入创建/改名/删除及磁盘读回。
2. **完成书架/设置 QA 草稿。** `scripts/margin-workflow-ui-scenarios.mjs` 已有列表 CRUD、筛选重开、人工延迟保存下草稿保护和源诊断流程，但未执行，且依赖未完成的 `margin-workflow-settings.mjs`，不能直接运行。先完成或拆成更小场景、审查 cleanup，再把 `runWorkflowScenarios` 接入 smoke runner。覆盖恢复清单/清理预览（不删用户快照）、文献选择与附件确认、逐对象恢复预览（不替换用户全库）、源诊断展开/引文搜索。确实需要执行恢复或清理的场景用隔离 Repository/Gateway/专属夹具。
3. **实际 UI 视觉核验。** 书签、列表管理、设置预览在窄窗口及当前主题的可见性/焦点/长文字换行；使用有限一轮检查与修正，不扩大成重设计。
4. **如发现产品问题再修、回归、构建、顺序部署四文件、SHA 核对、重载并确认新 fresh BUILD_ID。** 仅脚本修改无需重建产品；证据不能把旧构建冒充新构建。
5. 更新实现记录、列出已验/未验边界，提交并推送当前分支。用户后续是否合并 main 再按当时指令处理。

## 工具与命令

Mac 上 CDP 在 `http://127.0.0.1:9222`，Windows 曾用 SSH tunnel `19222`；Mac 继续不需要该隧道。先检查 `/json/list`，必须唯一匹配 `app://obsidian.md/index.html` 且标题包含 testvault，再核对运行时 vault 完整路径。不要选第一个窗口，不要重启整个 Obsidian。

```bash
npm run verify
RD_CDP_URL=http://127.0.0.1:9222 RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/mac-continuation node scripts/enhancement-smoke-cdp.mjs inspect
RD_CDP_URL=http://127.0.0.1:9222 RD_EVIDENCE_DIR=.obsidian-debug/margin-0.5/mac-reader-r3 node scripts/enhancement-smoke-cdp.mjs margin-reader
```

`margin-reader` 会创建真实 PDF 夹具，运行前读 `withFunctionalFixture` 和 cleanup；脚本超时可能仍在执行，先看状态/ledger，不要直接重跑。真实输入测试与内部 API 测试必须分开报告。当前最后运行的 fixture 已全部清理，原活动 leaf 已恢复；收尾核验为 7 本书、5 条标注、2 组评论、pending=0。

## 本机证据（单独同步，不入 Git）

- `.obsidian-debug/margin-0.5/deploy.json`：最后构建/部署/hash。
- `.obsidian-debug/margin-0.5/final-runtime/reload.json`：fresh startup。
- `.obsidian-debug/margin-0.5/handoff-runtime/inspect.json`：收尾 runtime 状态。
- `.obsidian-debug/margin-0.5/reader-runtime-r2/functional-scenarios.json`：核心成功数值、真实输入失败、cleanup 全部通过。
- `.obsidian-debug/review-20261002-followup/`：原审查复现、阶段单测 JSON 等。
- `.slim/deepwork/margin-0.5.md`：本轮分工、gate、实施进度。

自动恢复备份里会保留夹具运行时的历史快照，这是原件保护行为；不要为了清理测试而擅自删用户 recovery 文件。只清理夹具稳定 ID 和专属路径，不把旧整个 snapshot 恢复回去。不要触碰其他插件。
