# 0.1.1 最终 DoD 证据索引

本页只索引已发生的证据与明确边界；不把未做的原生手势或没有凭据的云端请求写成通过。

## 冻结构建链

- 版本：`0.1.1`（`package.json`、`package-lock.json`、`manifest.json` 同步）。
- 完整门禁：`.obsidian-debug/final-verify-0.1.1-v03-v06-reactive.log`，docs/owner/version/lint、18 个 Vitest 文件 / 73 tests 和 production build 均通过。
- 最新部署：`.obsidian-debug/final-release-deploy-0.1.1-v03-v06-reactive.sha256`。root build 与 Test Vault 的 `main.js`、`manifest.json`、`styles.css`、`pdf.worker.mjs` 四对 SHA-256 完全一致。
- 运行时首行：`.obsidian-debug/final-release-startup-proof-0.1.1-v03-v06-reactive.log`，`Margin v0.1.1 build 0.1.1+2026-09-18T17:18:51.094Z`。其关联错误采样为 `No errors captured`。

构建日为本地 2026-09-19；BUILD_ID 使用构建器记录的 UTC 2026-09-18 时间戳，二者并不矛盾。

## 本地功能与原生验收

- 独立数据、主接线、目标回归：`docs/self-check/functional-gate.md` 及其引用的 8/8、12/12、22/22 受控/真实文件证据。
- PDF 真实文本层、色盘、右键、评论与裁剪：`docs/checkpoints/phase-2.md` 的实际 Reader smoke 记录。
- Test Vault 重扫后，三个 PDF 都生成封面 PNG：`.obsidian-debug/metadata-rescan-cover-final.json`。封面目录并发创建 race 已修正为幂等。最新运行时复验通过 `vault.adapter.getResourcePath`：Shelf 的 6 个封面均为 `app://` URL、`complete=true`，自然宽度为 210、209、209、210、215、105px。
- 令牌化裁剪的真实 Test Vault host 验收：`.obsidian-debug/final-crop-runtime-0.1.1-crop-host.json`。预览为 `blob:` URL；向既有 Canvas 提交使节点 1→2，保存规范化 rect；相同令牌的第二次提交被拒绝为已失效。
- Canvas 完整目录的原子/idempotent host 验收：`.obsidian-debug/final-outline-runtime-0.1.1-crop-host.json`。首次同步创建两个 `readingDesk.kind=chapter` 节点，重跑的 `createdNodeIds` 为空。
- 本轮 DOM 数值：Reader 页面 `clientWidth=scrollWidth=732px`；五色 toolbar 色板均为 28×28px且背景色不同；设置标题/导语分别为 20px/14px；评论浮层背景不透明、opacity=1、完全在视口内并获得焦点；Shelf composition 事件后搜索框 `sameNode=true`、`focused=true`（`.obsidian-debug/final-portal-runtime-0.1.1-crop-host.json` 与 `.obsidian-debug/final-ime-runtime-0.1.1-crop-host.json`）。
- V03/V06 收口复验：`.obsidian-debug/final-v03-v06-reactive-runtime-0.1.1.json`。828px 的真实 Reader 分栏中 body 为 828/828px、PDF host 514/514px、目标栏 248/248px；评论浮层在浅色打开后直接切换暗色（不重建）仍重新计算五个前景，浅色/暗色十项对比度均至少 4.5，暗色靛色为 6.716。
- 独立视觉定点复核已将 V-03/V-06 判为 resolved：Reader body/toolbar 884/884px、PDF 514/514px、目标栏 266/266px；同一评论浮层的浅色最低对比度为 4.594、暗色最低为 5.595，靛色在主题切换后从 4.623 重算至 6.716，且节点身份保持。该结论只关闭已登记的 V-01–V-10 缺陷，不宣称新的全表面视觉审查。
- Canvas 原生对象定位、折叠/展开、反向删除刷新、源 rename/delete Reader 生命周期、可信 CDP drag 都由功能门禁在最终候选上验收；详见该 gate 后续报告和 `docs/self-check/functional-native-*.json`。
- Excalidraw 2.27.3 的新标准 scene 能原生打开；官方重写 element id 后，按 `customData.readingDesk.highlightId` 映射到 live element 的原生选择已通过。macOS 原生 URL action 也打开正确 Reader/页/高亮：`docs/self-check/functional-native-url-action-result.json`。

## 测试库依赖状态

- Obsidian core Canvas 在 Test Vault 原先为 disabled；验收时启用并保留启用，因为 Canvas 是 Reading Desk 的必需目标能力。
- 官方 `obsidian-excalidraw-plugin` v2.27.3 仅安装并启用于 Test Vault，用于 P2 原生目标验收；它不是 Reading Desk bundled dependency。
- 其它插件未被本轮更改。

## 明确保留的限制

- 未提供 OSS/COS 凭据，因此真实授权 PUT、公开读取与 Markdown 真剪贴板外链仍是唯一外部凭据阻塞。签名、配置禁用态、错误态和 mock/受控请求已有验证，但不代替真实账号请求。
- 未运行真实 AI 模型会话；可选 AI bridge 的可用性/禁用态和受控契约已有验证，但不代替提供商模型端到端会话。
- Excalidraw element 的 `sourceLink` 字符串、customData、原生场景和精确聚焦已验；官方 header/tooltip 的物理“打开链接”手势没有在本轮稳定触发 Reader。独立的 Obsidian native URL action 已端到端验证同一 URI 路由。
- 旧生成的简化 Excalidraw 文件不做自动迁移；从 0.1.1 起新建与 Reading Desk adapter 写回均使用官方 `# Excalidraw Data / ## Drawing / %%` envelope。
