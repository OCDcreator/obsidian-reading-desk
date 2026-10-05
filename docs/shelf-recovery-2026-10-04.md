# Reading Desk A/B/C 书架恢复与 Margin 0.5 整合

用户于 2026-10-04 授权以此目标替换此前 0.5 收尾方向。用户已在应用中更新当前目标为 A/B/C + Margin 0.5 整合；本文件记录详细交付标准。

恢复并整合 Reading Desk Margin 的目标书架效果，完成交付。

仓库：/Volumes/SDD2T/obsidian-vault-write/custom-project/obsidian-reading-desk。
目标界面以 origin/zcode/shelf-abc-rework（起始 b998888c449ea2c61046dbb16040ab65a269e1a7）的 A/B/C 书架及已接受 ADR 0007 为标准：卡片、台账、导航三种布局。保留当前 main（起始 aedd5a2bf2d5aa334e8ec55ce7d657e6dbcf4da4）的 Margin 0.5 可靠性功能、列表管理、筛选、草稿保护、注释搜索、持久化和设置工作流。

在隔离工作树中整合两条历史，人工解决文本及语义冲突，不回退 main，不整文件覆盖两边新功能，不调用 OpenCode，保留用户修改。保留两条历史的真实祖先关系。

执行源码和文档门禁，随后仅在唯一确认的 Test Vault /Volumes/SDD2T/obsidian-vault-write/testvault 上验收真实 A/B/C 界面及 0.5 工作流，要求 UI 输入、磁盘读回和 fresh Reading Desk BUILD_ID。构建产物按 main.js、manifest.json、styles.css、pdf.worker.mjs 顺序部署到 Reading Desk 专属目录并逐项验 SHA-256。不得重启整个 Obsidian 或切 Restricted Mode，除非用户另行授权；恢复和清理用隔离夹具，不覆盖当前用户数据或删除用户 recovery 文件。

验收通过后将整合提交合入 main，推送 origin/main，同步用户已指定的 FA880 专属克隆 C:\Users\letain\custom-projects\obsidian-reading-desk，证明 Mac HEAD = FA880 HEAD = origin/main 且两端工作树干净。只有 origin/main 包含每个候选分支且交付验收通过后，才安全清理所有非 main 本地及远端分支，保留 main、origin/main、origin/HEAD，不强制删除。

完成结论区分源码门禁、真实桌面验收、跨机同步及尚未验证边界。

## 整合起点证据（历史）

- 整合起点：main 与 origin/main 均为 `aedd5a2bf2d5aa334e8ec55ce7d657e6dbcf4da4`；A/B/C 分支为 `b998888c449ea2c61046dbb16040ab65a269e1a7`。
- 两边独有提交数为 8 / 6。隔离工作树中的未提交合并保留父提交关系。
- 6 处文本冲突：assets/styles.css、ADR 0007、LibraryIndex、main、ShelfItemView、ShelfView。自动合并文件仍需语义检查。
- 整合后的源码门禁及本机书架验收已有下述新记录；FA880 同步、main 合并及分支清理仍待完成。旧分支的验收记录仅作为目标参考。

## 源码整合记录

三种布局共用当前 ShelfBookDrafts/ShelfStatePersistence；旧 table 状态对应台账，navigation/historyOnly 可持久化；旧全局偏好仅作读取迁移。新 vault 默认最近阅读，已有 vault 排序优先保留。LibraryIndex 的分类改名和删除经过其队列及 Repository，删除保留书籍；导航优先用真实零基保存页 + 1。摘录检索保持独立入口，0.5 高级筛选和批量整理在可展开区，台账更多信息保留标题/状态/列表/重关联。

已有 0.5 设置、Reader、目标写入和恢复流程未改实现。2026-10-04 第一轮完整源码门禁通过 109 文件 / 604 测试（新增整合测试与旧分支测试），后续 category 菜单与默认排序变更将再执行完整门禁。真实桌面、FA880/main 合并及清理仍待证据。

## 用户视觉纠正与验收范围

用户截图揭示首次候选在封面叠加的「选择 / 分类 / 未分类」破坏了 A/B/C 视觉标准。该候选的部署及 604 测试不能作为视觉完成证据。修正后默认封面无表单控件，批量选择由显式入口进入；16px 复选框仅出现在选择态，分类在台账/批量编辑修改；台账去掉冗余文本标签。当前 Test Vault 实测默认封面控件数为 0，1086px shelf 的 scrollWidth 为 1086，书名固定两行约 41.6px。字体检测发现的 22/18/10px 三处偏离均改为已登记的 20/20/11px，不登记新例外掩盖问题。

最终候选已完成下述真实书架 UI 验收；不将检测输出、单元测试或一次截图当作全部样式的保证。

## 2026-10-05 凌晨本机验收与当时边界

最终候选 `0.5.0+2026-10-04T16:16:57.110Z`：`npm run verify` 通过全部门禁、109 文件 / 605 测试。顺序部署 4 文件并验证 SHA-256，Test Vault 出现本次 Reading Desk scoped 启动标识，Repository ready 且 pending=false。完整读回在 [验收记录](self-check/shelf-recovery-2026-10-05/acceptance.json)。

原生鼠标、键盘及粘贴验收：作者准确存盘；显式批量选择和 16px 复选框；书单新建/改名/取消删除/确认删除；仅对选中图书追加标签；分类新建/改名/台账选择/右键删除并保留图书；台账 8 列；导航读取真实保存页；A/B/C 状态及查询写盘；关闭重开保持导航模式和查询。暂停夹具图书的作者保存后切换台账，草稿和保存中提示保留，放行后只提交一次并磁盘读回。摘录入口能检索现有 5 条标注。

最后样式修正重新部署后，在实际 Obsidian 1086px 与 532px 叶片确认：默认封面控件数 0，书架根 scrollWidth 不超过 clientWidth；台账 1100px 表格在局部 auto 容器横向滚动，页数/大小 nowrap；窄分类面板 484px × 400px，无横向溢出。分类菜单脱离主题按钮阴影，方向键移动焦点、Escape 关闭并返回触发标签。截图位于同目录，均为此次候选；较早 shelf-rework 截图继续只作为设计目标参考。

0.5 设置连接、保存状态、快照清单刷新及清理预览通过原生控件；仅预览，不执行当前用户仓库的整库恢复、文献导入或快照删除。这些未改服务保持既有隔离测试和源码证据。本轮未切换整个 Obsidian 主题，最终候选的视觉证据限定于当前主题及上述宽度。

所有本轮夹具图书、分类、书单、文件、生成封面和临时分屏已清理，磁盘仍为原有 7 本书，shelf 恢复原值，Repository ready/pending=false。正常产生的自动恢复快照保持插件默认保留策略，未删除恢复目录中的用户文件。

FA880 在 2026-10-05 再次实测：.252 在 SSH banner exchange 超时，.49 连接超时。跨机 SHA 和干净状态不能确认。整合候选保留真实两个父提交；主工作树、origin/main 与各待清理分支继续保留，待 FA880 可达后再完成 main 合并、两端 fast-forward、精确读回及安全分支清理。

## 2026-10-05 收尾完成

FA880 的 SSH 在当天 11:25 恢复，指定克隆 `C:\Users\letain\custom-projects\obsidian-reading-desk` 的机器名、main 和干净状态均重新核实。重新完整执行 `npm run verify` 通过 109 文件 / 605 测试。Mac main 快进到整合提交 `6e040c21ec76312569d324c1c13b94b91b145c48` 并推送，FA880 main 从 origin/main 快进；两端 HEAD、origin/main 精确相等且工作树分别干净。

最终构建 `0.5.0+2026-10-05T03:29:06.195Z` 的代码经字节比较与已完成原生验收的构建仅 BUILD_ID 不同，样式、manifest 和 worker 字节一致。4 文件再次按指定顺序部署及 SHA-256 验证，记录新的 Reading Desk 启动标识；实际打开原有 Test Vault 书架，根宽度/scrollWidth 均 1086px，默认封面控件为 0，仍为原有 7 本书且 ready/pending=false。此前原生输入、磁盘读回和窄布局证据继续适用，未扩大恢复应用或主题验证的范围。

确认每条待删分支均为 origin/main 的祖先后，使用普通 `git branch -d` 删除 Mac 4 条与 FA880 1 条旧本地分支；原子删除远端 5 条已合入分支，再在两端 prune。两端仅保留 main、origin/main、origin/HEAD；远端仅保留 main。整合工作树已由 Codex 归档，任务日志与忽略文件中的验收数据已先复制回主工作树保存。

收尾数据见 [closeout.json](self-check/shelf-recovery-2026-10-05/closeout.json)，完整门禁输出见 [verify-premerge.log](self-check/shelf-recovery-2026-10-05/verify-premerge.log)，最终原生截图见 [native-final-main.png](self-check/shelf-recovery-2026-10-05/native-final-main.png)。本段与上述收尾记录只更新文档；随后同步文档提交时再次核对两端最终 HEAD 与干净状态。
