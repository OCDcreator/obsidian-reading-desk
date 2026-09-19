# 独立原生功能验收记录

当前最新结论：**2026-09-19 00:41 上海时间**，候选 `0.1.1+2026-09-18T16:32:50.656Z`。完整目录预生成与裁剪可信拖放均已补验通过，详情见文末。以下按时间保留发现、失败与修复记录，历史“待补丁”不是当前未修缺陷。最终 verify 日志为 **17 文件 / 69 tests PASS**；四件部署产物由本代理独立重算，见 `functional-final-release-artifacts.json`。

目标：Test Vault 的 Reading Desk。基线构建 `0.1.0+2026-09-18T15:28:08.037Z`。时间 2026-09-18 15:31–15:40 UTC。本轮界面操作由 functional gate 独占，Reader 实现者已明确移交；视觉代理尚未接手。

## 操作层级

- `functional-cdp.mjs` 只连接标题包含 `testvault`、URL 为 `app://obsidian.md/index.html` 的 CDP page。
- 用户交互用 Chromium `Input.dispatchMouseEvent`、键盘事件及 `Input.insertText`；日志保留完整命令与坐标。该层级比 `element.click()` / `new DragEvent()` 更接近真实指针输入；不声称是人手操作。
- `Runtime.evaluate` 用于观察 app、DOM、持久化结果，或准备测试场景（激活已知 Reader/打开合成 fixture/关闭本轮空叶片）。未用它直接调用摘录/标题/折叠来冒充用户动作。
- 源改名使用 Obsidian CLI `move`，触发真实 Vault 文件事件；不是直接调用生产事件处理器。
- 只创建/移动 Test Vault 下的合成 `Reading Desk Fixtures/functional-outline*.pdf`。未修改无关主 vault 资料。

## 环境根因与预置

初始 active leaf 为 empty，已有 Reader 隐藏，持久化 layout 为 focus，因此“无 title/fold 控件”不是实现缺失。激活正确 Reader，真实点击“分栏目标”后，split 摘录面板与标题/折叠控件出现。

Test Vault 的 **Canvas 核心插件原来 enabled=false**。第一次原生打开返回 empty，没有 canvas view。执行 `obsidian vault=testvault plugin:enable id=canvas filter=core` 后可打开真实 Canvas。按主代理授权保留启用；不改其它插件。证据 `functional-native-canvas-error.json`、`functional-canvas-enabled.json`。

只读枚举 Test Vault `.obsidian/plugins/*/manifest.json` 与 `community-plugins.json`，Excalidraw 未安装/未启用。没有为验收擅自安装外部插件。因此 Excalidraw 仅能确认标准 scene/压缩格式解析和文件写入映射，原生打开/聚焦保持 BLOCKED（缺可选依赖），不借 Canvas 的 PASS 代替。

## 已独立通过

| 合同 | 动作与检查 | 证据 |
| --- | --- | --- |
| split 实际摘录面板 | 真实点击“分栏目标”，layout=split，3 个 title inputs 与 fold/focus 控件可见 | `functional-live-split-click.json`、`functional-live-split-state.json` |
| 摘录标题编辑 | 聚焦输入框、全选、输入“独立验收标题 1532”、Enter；Canvas text 第一行与 readingDesk.title 实际保存 | `functional-native-title-input.json`、`functional-native-title-saved.json` |
| 原生 Canvas 节点聚焦 | 真实点“定位目标”；active=canvas，精确 objectId 在 Canvas.selection，屏幕矩形可见 | `functional-native-focus-click-final.json`、`functional-native-canvas-focus-pass.json` |
| 原生卡片反链 | 实际点 Canvas 原文链接；打开 Reader，正确 PDF、page=1，匹配持久化 highlightId 的 rects 可见 | `functional-native-backlink-click.json`、`functional-native-backlink-result.json` |
| 原生跨行拖拽摘录 | 先用 Input 指针选两行，再 hold/move 到 dropzone；诊断记录 `dragstart/drop isTrusted=true`，生成真实 Canvas 与 persisted highlight | `functional-native-text-selection-state.json`、`functional-native-drag-final-stream.json`、`functional-native-drag-final-result.json` |
| outline 解析及最具体章节归属 | 合成有效 3 页 PDF，4 outline 条目；第二页摘录归属 Methods → Details，目标有 2 章节节点、chapter edge 与 excerpt edge | `functional-outline.pdf`、`functional-outline-open.json`、`functional-outline-nodes.json` |
| 源改名的存储/目标反链 | CLI move PDF；book id/进度保留，highlight.pdfPath、Canvas metadata/source URI 更新成新路径 | `functional-live-source-rename.json` |

拖拽第一次快速指针序列未产生 drop，记录为未成功；第二次增加短暂按住与目标区域重复 move 后产生 trusted drop。没有把失败第一次算 PASS，也没有回退到 synthetic DragEvent 冒充成功。

## 已确认失败，等待补丁重验

| ID | 症状 | 精确证据 / 修复责任 |
| --- | --- | --- |
| N-01 原生折叠 | Reader 摘要已收起、store/metadata folded=true，但 Canvas 原生 text 保持全文、height 240 → 240，实际节点未折叠 | `functional-native-title-saved.json`、`functional-native-fold-saved.json`、`functional-native-canvas-focus-pass.json`、`functional-native-canvas-fold-before.png`；目标适配 owner 已提供 72px 紧凑高度补丁，待部署 |
| N-02 反删实时重绘 | 实际选中 Canvas 节点按 Delete，原生节点删除；Canvas 保存后 AnnotationStore 也删除，但 2 个现有 Reader 合计仍有 30 个旧高亮矩形 | `functional-native-delete-input.json`、`functional-native-reverse-delete-settled.json`；main/Reader 添加 refreshAnnotations 通知中 |
| N-03 已开 Reader 的源改名 | 索引与目标反链正确更新，但仍打开的 Reader.activePath 保持不存在的旧 PDF；后续摘录可能再次持久化旧源 | `functional-live-source-rename.json` 的 readerActivePath；main/Reader 添加 handleSourceRename 中 |

原生删除只删除本任务此前通过 synthetic drag 产生的测试摘录卡；保留主标题/折叠测试卡供补丁验收。持久化删除延迟来自 Canvas 的保存 debounce：15:36:21 store 尚未更新，15:36:34 store 已删但 Reader 仍未重绘。因此 N-02 基于已稳定保存后的状态，不是时序误报。

## 下一个独占窗口的最小验收

1. 统一部署 N-01/N-02/N-03 补丁；核 build identity 后重新打开测试 Reader。
2. 同一标题卡折叠 72px、展开恢复计算高度，text/source 不丢；实际原生视图确认。
3. 新建/使用本任务测试摘录，原生删除后等 Canvas 保存，store 和现有 Reader rects 一起消失。
4. 源改名更新已打开 Reader；插件 reload 后原高亮按持久化坐标重绘；最后删除合成源触发记录清理与 Reader 错误/空态。
5. 输出最新 PASS/FAIL，释放 UI 给独立视觉最终确认。OSS/COS 实际请求继续 BLOCKED（缺凭据），不反复 mock 请求浪费验证时间。

## 候选 15:54:23 回归（本地日期已跨至 2026-09-19）

构建 `0.1.0+2026-09-18T15:54:23.292Z`，真实运行验收在 UTC 15:55–16:01 / 上海 2026-09-18 23:55 至 2026-09-19 00:01。

- **N-01 PASS**：以当前真实 bounds 点击 Reader 折叠控件，原生 Canvas `height`、屏幕矩形与磁盘 JSON 同为 72；再点展开恢复 240。标题与完整 text/source URI 均保留。证据 `functional-final-fold-72.json`、`functional-final-unfold-native.json`、`functional-final-native-fold72.png`。较早 `functional-final-native-fold-pass.json` 文件名虽然含 pass，但其点击坐标过期、结果仍 expanded；该尝试不作为通过证据，以明确 72px 结果为准。
- **N-02 PASS**：实际 Delete 键删除选中的原生 excerpt，待 Canvas 保存后 highlight store 不存在、Reader marks=0、excerpt cards=0；章节节点未删除。见 `functional-final-delete-key.json`、`functional-final-reverse-delete.json`。
- **N-03 PASS**：真实 Vault rename 之后已打开 Reader.path 与 store 一致变更、page2/marks4 保留。删除合成源后 book 清除、Reader.path 为空、marks0，中文提示“源 PDF 已删除，无法继续摘录”。见 `functional-final-active-reader-rename.json`、`functional-final-source-delete.json`。
- **重载持久化 PASS（明确范围）**：候选 reload 后重新打开既有高亮，其 page2、4 normalized rects、Methods/Details 章节、先前标题仍存在并渲染。见 `functional-reload-outline-reopened.json` 和 `functional-final-candidate-open.json`。没有声称 Obsidian 整个 workspace session 自动恢复已测。

## Excalidraw 原生互操作当前结论

主代理随后明确授权在 Test Vault 安装必要依赖。官方 `obsidian-excalidraw-plugin` **2.27.3** 已安装并启用，安装前不存在；未改主 vault。原先“缺依赖 BLOCKED”不再适用。

- **标准合成 scene 打开 PASS**：`Reading Desk Fixtures/functional-excalidraw.excalidraw.md` 含 `# Excalidraw Data / ## Text Elements / %% / ## Drawing / json fence / %%`，用官方 `openDrawing(file,'new-pane',true)` 得到真实 excalidraw view、excalidrawAPI。见 `functional-excalidraw-native-api.json`、`functional-excalidraw-focus-contract.json`。
- **新建 Reading Desk 目标 FAIL（已交修）**：用 Reader 中 Excalidraw 类型、可信 Input 文本选择及色盘点击创建真实 annotation/file。type 选择本身因原生 select 的 CDP按键未改变值，改用 DOM select/change；此层级单独记录在 `functional-excal-type-change.json`，不冒称全流程都为物理输入。
- 新 target `Reading Desk/摘录-1789747210828.excalidraw.md` 缺 `## Drawing` / `%%` 正式区段。官方 `isExcalidrawFile=true` 且 metadata cache 正确，但 native open 报 `Error loading drawing: No number after minus sign in JSON at position 1`，回退 markdown，无 scene elements。强制原生 view 同样失败，排除了慢加载/错误 active leaf。
- 证据：`functional-excal-created-native.json`、`functional-excal-native-settled.json`、`functional-excal-new-format-diagnosis.json`、`functional-excal-new-forced-view.json`。该失败证明之前纯适配器格式测试不覆盖实际插件 parser，不能被单元绿覆盖。
- 责任人 app_integration 已获成功模板与精确根因。待修复统一部署后，仅补新场景原生 elements、highlight mapping/source URI、native selection/focus 和回跳；其余通过项不重跑。

## 0.1.1 最终 Excalidraw 回归

本地 2026-09-19 00:05–00:10；最终构建 `0.1.1+2026-09-18T16:06:21.819Z`。

- 新生成的正式 envelope 在官方 Excalidraw 2.27.3 原生 view 解析成功，真实 scene 中可见带 `customData.readingDesk.highlightId` 的文字元素，source URI 保持正确。见 `functional-excal-011-fresh-scene.json`。该 fresh file 使用真实 main/target service 在运行实例创建，属于 runtime 集成证据；不声称这个特定 file 的创建全程都是 Input。
- 官方加载时会把长 text element id 改成 8 位 id；曾导致 target.objectId 直接查找失效。修正后主插件按稳定 highlightId 找 live element，再调用官方定位方法。`functional-excal-final-focus-pass.json` 实测 stored objectId 为 `rd-excalidraw-d5cd…`、live id=`8z0bMFSa`，`selectedElementIds={8z0bMFSa:true}`，viewport 已缩放到元素。**精确 native focus PASS**。
- source URI 经系统 `open 'obsidian://reading-desk-highlight?...'` 路由，Obsidian console 实际收到 `Received URL action`，新 active Reader 正确 source/page1，匹配该 highlight 的 mark=1。**URI 端到端 PASS**，证据 `functional-native-url-action-result.json`。
- **手势边界仍保留**：本轮 Excalidraw header“打开所选元素链接”与 Command-click 后 tooltip 链接的 Input 点击，没有观察到新 Reader；不把系统 URI 打开冒充该手势通过。元素 `.link` 正确、官方 native scene/focus 与 Obsidian URI 路由均已独立确认，具体宿主点击路径为未证明项。见 `functional-excal-final-link-observe.json`、`functional-excal-tooltip-link-pass.json`（文件名含 pass 但其内容仍为 active=excalidraw，因此不作为 PASS 证据）。
- 旧的 0.1.0 简化 envelope 测试文件曾再次触发旧错误；最终 fresh file 与映射修正是通过结论的依据，未把旧文件失败覆盖新版本。

00:11 功能代理释放 UI 给独立视觉最终确认。已确认的原生 N-01/N-02/N-03、Canvas 链接、可信指针拖拽、outline 归属等结果不因 Excalidraw 手势未证而撤销，也不据此夸大整体 DoD。

## 0.1.1 完整目录与裁剪可信拖放最终补验

候选 `0.1.1+2026-09-18T16:32:50.656Z`。本地 2026-09-19 00:39–00:41（UTC 2026-09-18 16:39–16:41）获得短时独占 UI，只补验这两项，随后明确释放给主代理、部署代理与视觉代理。无再次build/reload。

- **完整目录预生成 PASS**：合成源 `Reading Desk Fixtures/functional-excal-source.pdf` 为3页/4个outline条目。新目标 `Reading Desk Fixtures/functional-complete-outline.canvas` 初始nodes/edges均为空。Reader“选择已有目标文档”通过DOM原生select value/change触发生产监听器，未直接调用目录同步服务。目标产生Introduction、Methods、Methods/Details、Results全部4个章节节点与1条Methods→Details层级边，源路径/zero-based page/chapterPath正确，excerptCount=0。切回空选项再重选同一目标后，完整序列化内容相同、节点不增长。该选择是运行接线证据，不冒称原生下拉框物理点选。证据：`functional-complete-outline-setup.json`、`functional-complete-outline-select.json`。
- **pointer-up只准备预览 PASS**：真实`Input.dispatchMouseEvent`点击裁剪并按下/移动/释放选框，生成342×148的实际PNG预览Blob（20679 bytes，`image/png`），有有效prepared token。松开后新PNG列表为空，既有Canvas仍为4个章节节点。normalized rect为`{x:0.09802979849726776,y:0.12671298668032788,width:0.3797814207650273,height:0.12295081967213115}`。证据：`functional-crop-native-pointer-select.json`、`functional-crop-prepared-no-write.json`。
- **裁剪手柄可信拖放 PASS**：真实Input held/move/release把预览手柄拖到已选既有Canvas的目标面板。诊断观察到`dragstart/drop isTrusted=true`，drop数据包含`application/x-reading-desk-crop+json`，未注入`new DragEvent`或直接调用commit。目标节点4→5，原4章全部保留；新增`type:file`原生节点`rd-crop-1789749659580-tz8afc`指向`Reading Desk/裁剪/裁剪-1789749659580-tz8afc.png`，实际PNG20679 bytes且magic为`[137,80,78,71,13,10,26,10]`，源PDF/page0/normalized rect与预览完全一致，prepared token数归零。这里的拖放表面是Reading Desk已选目标面板，持久化目标是真实既有`.canvas`文件，不扩张成原生Canvas画布任意位置都已实测。证据：`functional-crop-trusted-drag-input.json`、`functional-crop-trusted-drop-result.json`。

最新完整verify日志`.obsidian-debug/final-verify-0.1.1-crop-host.log`包含docs/owner/version/lint（`--max-warnings=0`）/17文件69 tests/tsc与esbuild；启动日志`.obsidian-debug/final-release-startup-proof-0.1.1-crop-host.log`明确记录当前build。最终四件root构建产物与Test Vault副本SHA-256完全匹配，详细值与当前src摘要在`functional-final-release-artifacts.json`。

本代理已确认并登记的功能缺陷剩余**0**；OSS/COS真实授权请求缺凭据BLOCKED、AI真实模型会话未运行、Excalidraw元素链接点击手势未证明等边界继续保留。以上不构成全部DoD无条件通过，视觉验收由独立视觉代理给出。
